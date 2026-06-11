// 動作確認用スクリプト: 登録→検索→マッチ通知→返却→統計 の一連フロー
const BASE = 'http://localhost:3100';

// 1x1ピクセルの最小JPEG(バイナリ)
const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA' +
  'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==',
  'base64'
);

async function json(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

function assert(cond, label) {
  if (!cond) throw new Error('FAIL: ' + label);
  console.log('OK:', label);
}

(async () => {
  // 0. メタ情報
  const meta = await json('GET', '/api/meta');
  assert(meta.categories.length > 0 && meta.colors.length === 12, 'メタ情報取得');

  // 1. 探し物登録(まだ何もないのでマッチ0件)
  const lost = await json('POST', '/api/lost', { keywords: '青い水筒', contactName: 'テスト太郎' });
  assert(lost.request.category === 'bottle', '探し物: カテゴリ自動判定(水筒)');
  assert(lost.request.color === 'blue', '探し物: 色自動判定(青)');

  // 2. 拾得物登録(画像付き・マルチパート)
  const fd = new FormData();
  fd.append('image', new Blob([TINY_JPEG], { type: 'image/jpeg' }), 'item.jpg');
  fd.append('category', 'bottle');
  fd.append('color', 'blue');
  fd.append('tags', JSON.stringify(['ボトル']));
  fd.append('description', 'キャラクターのシール付き');
  fd.append('locationFound', '体育館');
  fd.append('storagePlace', '職員室前の落とし物棚');
  const foundRes = await fetch(BASE + '/api/found', { method: 'POST', body: fd });
  const found = await foundRes.json();
  assert(foundRes.ok && found.item.id > 0, '拾得物登録(画像アップロード)');
  assert(found.item.imagePath && found.item.imagePath.startsWith('/uploads/'), '画像パス保存');
  assert(found.notified === 1, '待機中の探し物1件へマッチ通知');

  // 3. 自由文検索
  const search = await json('GET', '/api/found?q=' + encodeURIComponent('青い水筒'));
  assert(search.results.length === 1 && search.results[0].score >= 75, '自由文検索(カテゴリ+色一致)');

  // 4. 関係ない検索ではヒットしない
  const miss = await json('GET', '/api/found?q=' + encodeURIComponent('赤い傘'));
  assert(miss.results.length === 0, '無関係な検索は0件');

  // 5. 探し物の即時マッチ確認
  const lost2 = await json('POST', '/api/lost', { keywords: '水筒なくした' });
  assert(lost2.matches.length === 1, '後から登録した探し物にも即時マッチ');

  // 6. 返却記録
  const returned = await json('POST', `/api/found/${found.item.id}/return`, { returnedTo: '2-3 テスト' });
  assert(returned.status === 'returned', '返却記録');

  // 6.5 保管担当: 返却履歴(PIN未設定時はそのまま閲覧可)
  const history = await json('GET', '/api/staff/history');
  assert(history.items.length === 1, '返却履歴に1件記録');
  assert(history.items[0].returnedTo === '2-3 テスト', '受け取った人の名前が記録されている');

  // 一般向けAPIには受取人名が含まれないこと(プライバシー)
  const publicView = await json('GET', `/api/found/${found.item.id}`);
  assert(publicView.returnedTo === undefined, '一般向けAPIに受取人名は含まれない');

  // 7. 統計
  const stats = await json('GET', '/api/stats');
  assert(stats.total === 1 && stats.returned === 1 && stats.returnRate === 100, '統計(返却率100%)');
  assert(stats.byCategory.bottle.returned === 1, 'カテゴリ別集計');

  // 8. レート制限(連打すると429が返る)
  let limited = false;
  for (let i = 0; i < 20; i++) {
    const res = await fetch(BASE + '/api/lost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: 'レート制限テスト' }),
    });
    if (res.status === 429) {
      limited = true;
      break;
    }
  }
  assert(limited, 'レート制限(429)が動作');

  console.log('\n全テスト合格 🎉');
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
