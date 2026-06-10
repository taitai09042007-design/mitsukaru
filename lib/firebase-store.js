// Firebase Realtime Database ストア
// 起動時に全データをメモリへ読み込み、変更があるたびにFirebaseへ書き戻す。
// サーバーが再起動・再デプロイされてもデータが消えない。
const Store = require('./store');

class FirebaseStore extends Store {
  constructor(db, rootPath) {
    super(null); // ファイル保存は使わない
    this.ref = db.ref(`${rootPath}/data`);
    this.pendingSave = null;
  }

  // 起動時にFirebaseから全データを読み込む
  async init() {
    const snapshot = await this.ref.get();
    const raw = snapshot.val();
    if (raw) {
      // RTDBは配列をオブジェクトで返すことがあるため両対応で復元する
      this.data = {
        foundItems: Object.values(raw.foundItems || {}),
        lostRequests: Object.values(raw.lostRequests || {}).map((r) => ({
          matchedItemIds: [],
          ...r,
        })),
        seq: raw.seq || { found: 1, lost: 1 },
      };
    }
    console.log(`[firebase] データ読み込み完了: 拾得物${this.data.foundItems.length}件 / 探し物${this.data.lostRequests.length}件`);
  }

  // 連続する変更をまとめてFirebaseへ書き込む(デバウンス)
  save() {
    clearTimeout(this.pendingSave);
    this.pendingSave = setTimeout(() => {
      this.ref.set(this.data).catch((err) => {
        console.error('[firebase] 保存失敗:', err.message);
      });
    }, 200);
  }
}

module.exports = FirebaseStore;
