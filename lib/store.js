// JSONファイルによる軽量データストア(デモ・小規模運用向け)
// ネイティブ依存なしでどの環境でも動くことを優先している

const fs = require('fs');
const path = require('path');

class Store {
  constructor(file) {
    this.file = file;
    this.data = {
      foundItems: [],
      lostRequests: [],
      seq: { found: 1, lost: 1 },
    };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.file)) {
        const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        this.data = {
          foundItems: raw.foundItems || [],
          lostRequests: raw.lostRequests || [],
          seq: raw.seq || { found: 1, lost: 1 },
        };
      }
    } catch (err) {
      console.error('[store] 読み込み失敗。空データで開始します:', err.message);
    }
  }

  save() {
    // 一時ファイルに書いてからリネーム(書き込み中のクラッシュで壊れないように)
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
    fs.renameSync(tmp, this.file);
  }

  nextId(kind) {
    const id = this.data.seq[kind] || 1;
    this.data.seq[kind] = id + 1;
    return id;
  }

  // --- 拾得物 ---
  createFoundItem(fields) {
    const item = {
      id: this.nextId('found'),
      status: 'stored', // stored | returned
      createdAt: new Date().toISOString(),
      returnedAt: null,
      returnedTo: null,
      ...fields,
    };
    this.data.foundItems.push(item);
    this.save();
    return item;
  }

  getFoundItem(id) {
    return this.data.foundItems.find((i) => i.id === id) || null;
  }

  updateFoundItem(id, patch) {
    const item = this.getFoundItem(id);
    if (!item) return null;
    Object.assign(item, patch);
    this.save();
    return item;
  }

  listFoundItems() {
    return [...this.data.foundItems].sort((a, b) => b.id - a.id);
  }

  // --- 探し物リクエスト ---
  createLostRequest(fields) {
    const req = {
      id: this.nextId('lost'),
      status: 'waiting', // waiting | resolved
      createdAt: new Date().toISOString(),
      matchedItemIds: [],
      ...fields,
    };
    this.data.lostRequests.push(req);
    this.save();
    return req;
  }

  getLostRequest(id) {
    return this.data.lostRequests.find((r) => r.id === id) || null;
  }

  updateLostRequest(id, patch) {
    const req = this.getLostRequest(id);
    if (!req) return null;
    Object.assign(req, patch);
    this.save();
    return req;
  }

  listLostRequests() {
    return [...this.data.lostRequests].sort((a, b) => b.id - a.id);
  }
}

module.exports = Store;
