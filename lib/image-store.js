// 画像ストア(ローカルディスク版 / Firebase版)
// どちらも save(filename, buffer, mime) / get(filename) -> {buffer, mime} | null の同じ形で使える
const fs = require('fs');
const path = require('path');

const SAFE_FILENAME = /^[\w.-]+$/; // パストラバーサル防止

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

// --- ローカルディスク版 ---
class LocalImageStore {
  constructor(dir) {
    this.dir = dir;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  async save(filename, buffer) {
    if (!SAFE_FILENAME.test(filename)) throw new Error('不正なファイル名');
    await fs.promises.writeFile(path.join(this.dir, filename), buffer);
  }

  async get(filename) {
    if (!SAFE_FILENAME.test(filename)) return null;
    try {
      const buffer = await fs.promises.readFile(path.join(this.dir, filename));
      return { buffer, mime: MIME_BY_EXT[path.extname(filename)] || 'image/jpeg' };
    } catch (_) {
      return null;
    }
  }
}

// --- Firebase Realtime Database版 ---
// 画像はbase64でRTDBに保存(縮小済みJPEGなので1枚あたり数百KB程度)
class FirebaseImageStore {
  constructor(db, rootPath) {
    this.ref = db.ref(`${rootPath}/images`);
    this.cache = new Map(); // 最近使った画像のメモリキャッシュ
    this.cacheLimit = 50;
  }

  // RTDBのキーに使えない文字を除去
  static toKey(filename) {
    return filename.replace(/[^\w-]/g, '_');
  }

  async save(filename, buffer, mime) {
    if (!SAFE_FILENAME.test(filename)) throw new Error('不正なファイル名');
    await this.ref.child(FirebaseImageStore.toKey(filename)).set({
      mime: mime || 'image/jpeg',
      data: buffer.toString('base64'),
      createdAt: new Date().toISOString(),
    });
    this.putCache(filename, { buffer, mime: mime || 'image/jpeg' });
  }

  async get(filename) {
    if (!SAFE_FILENAME.test(filename)) return null;
    if (this.cache.has(filename)) return this.cache.get(filename);

    const snapshot = await this.ref.child(FirebaseImageStore.toKey(filename)).get();
    const raw = snapshot.val();
    if (!raw || !raw.data) return null;

    const entry = { buffer: Buffer.from(raw.data, 'base64'), mime: raw.mime || 'image/jpeg' };
    this.putCache(filename, entry);
    return entry;
  }

  putCache(filename, entry) {
    this.cache.set(filename, entry);
    if (this.cache.size > this.cacheLimit) {
      this.cache.delete(this.cache.keys().next().value); // 一番古いものを削除
    }
  }
}

module.exports = { LocalImageStore, FirebaseImageStore };
