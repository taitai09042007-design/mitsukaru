// 落とし物マッチングAI「みつかる君」メインサーバー
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const multer = require('multer');
const { Server } = require('socket.io');

const Store = require('./lib/store');
const {
  CATEGORIES,
  COLORS,
  COCO_TO_CATEGORY,
  categoryById,
  findCategoryInText,
  findColorInText,
} = require('./lib/synonyms');
const {
  MATCH_THRESHOLD,
  matchLostToFound,
  searchFoundItems,
} = require('./lib/matcher');

const PORT = process.env.PORT || 3100;
// 返却記録を保管担当だけが操作できるようにするPIN(未設定なら誰でも記録可能=デモモード)
const STAFF_PIN = (process.env.STAFF_PIN || '').trim();
// 探し物リクエストの有効期限(古いものはマッチング対象から外す)
const LOST_EXPIRY_DAYS = 30;
// データ保存先。本番(Render等)では永続ディスクのマウント先を DATA_DIR に指定する
const DATA_DIR = process.env.DATA_DIR || __dirname;
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const STORAGE_PLACES = [
  '職員室前の落とし物棚',
  '事務室',
  '各学年職員室',
  '体育館入口',
  'その他',
];

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const store = new Store(path.join(DATA_DIR, 'data.json'));

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set('trust proxy', 1);

// セキュリティヘッダ
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

// --- 簡易レート制限(スパム登録・連打対策。外部依存なしのインメモリ方式) ---
const rateBuckets = new Map();
function rateLimit(limit, windowMs) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.method}:${req.path}`;
    const now = Date.now();
    const recent = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      return res.status(429).json({ error: '操作が多すぎます。少し待ってからもう一度試してください' });
    }
    recent.push(now);
    rateBuckets.set(key, recent);
    next();
  };
}
// 古いバケツを定期的に掃除(メモリ肥大防止)
setInterval(() => {
  const now = Date.now();
  for (const [key, times] of rateBuckets) {
    if (times.every((t) => now - t > 10 * 60 * 1000)) rateBuckets.delete(key);
  }
}, 10 * 60 * 1000).unref();

// --- 画像アップロード設定 ---
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[file.mimetype] || '.jpg';
      cb(null, `found_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype));
  },
});

// --- バリデーションヘルパー ---
const CATEGORY_IDS = new Set(CATEGORIES.map((c) => c.id));
const COLOR_IDS = new Set(COLORS.map((c) => c.id));

function cleanText(value, maxLen) {
  return String(value || '').trim().slice(0, maxLen);
}

function cleanCategory(value) {
  return CATEGORY_IDS.has(value) ? value : null;
}

function cleanColor(value) {
  return COLOR_IDS.has(value) ? value : null;
}

// 期限内かつ待機中の探し物だけをマッチング対象にする
function isActiveLost(request) {
  if (request.status !== 'waiting') return false;
  const age = Date.now() - new Date(request.createdAt).getTime();
  return Number.isFinite(age) && age < LOST_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
}

// --- メタ情報(カテゴリ・色・COCOマップをフロントへ提供) ---
app.get('/api/meta', (req, res) => {
  res.json({
    categories: CATEGORIES.map(({ id, label, emoji, synonyms }) => ({ id, label, emoji, synonyms })),
    colors: COLORS,
    cocoToCategory: COCO_TO_CATEGORY,
    storagePlaces: STORAGE_PLACES,
    matchThreshold: MATCH_THRESHOLD,
    staffPinRequired: Boolean(STAFF_PIN),
  });
});

// --- 拾得物の登録 ---
app.post('/api/found', rateLimit(15, 60 * 1000), upload.single('image'), (req, res) => {
  const body = req.body || {};
  const category = cleanCategory(body.category);
  if (!category) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'カテゴリを選択してください' });
  }

  let tags = [];
  try {
    const parsed = JSON.parse(body.tags || '[]');
    if (Array.isArray(parsed)) tags = parsed.map((t) => cleanText(t, 30)).filter(Boolean).slice(0, 10);
  } catch (_) { /* タグなし扱い */ }

  const item = store.createFoundItem({
    category,
    color: cleanColor(body.color),
    tags,
    description: cleanText(body.description, 200),
    locationFound: cleanText(body.locationFound, 100),
    storagePlace: cleanText(body.storagePlace, 100) || STORAGE_PLACES[0],
    reporterName: cleanText(body.reporterName, 50),
    imagePath: req.file ? `/uploads/${req.file.filename}` : null,
  });

  // 待機中の探し物とマッチング → 部屋ごとにリアルタイム通知
  let notified = 0;
  for (const lost of store.listLostRequests()) {
    if (!isActiveLost(lost)) continue;
    const { score, reasons } = matchLostToFound(lost, item);
    if (score >= MATCH_THRESHOLD) {
      lost.matchedItemIds.push(item.id);
      io.to(`lost-${lost.id}`).emit('match-found', {
        lostId: lost.id,
        item: publicItem(item),
        score,
        reasons,
      });
      notified++;
    }
  }
  store.save();

  io.emit('found-registered', publicItem(item));
  res.json({ item: publicItem(item), notified });
});

// --- 拾得物の検索・一覧 ---
app.get('/api/found', (req, res) => {
  const q = cleanText(req.query.q, 100);
  const status = req.query.status; // stored | returned | all
  let items = store.listFoundItems();
  if (status === 'stored' || status === 'returned') {
    items = items.filter((i) => i.status === status);
  }

  if (q) {
    const results = searchFoundItems(q, items);
    return res.json({
      query: q,
      results: results.map((r) => ({ ...publicItem(r.item), score: r.score, reasons: r.reasons })),
    });
  }
  res.json({ query: '', results: items.slice(0, 60).map(publicItem) });
});

app.get('/api/found/:id', (req, res) => {
  const item = store.getFoundItem(Number(req.params.id));
  if (!item) return res.status(404).json({ error: '見つかりません' });
  res.json(publicItem(item));
});

// --- 返却記録 ---
app.post('/api/found/:id/return', rateLimit(30, 60 * 1000), (req, res) => {
  // STAFF_PIN を設定している場合は保管担当だけが返却記録できる
  if (STAFF_PIN && cleanText((req.body || {}).staffPin, 30) !== STAFF_PIN) {
    return res.status(401).json({ error: '保管担当のPINが正しくありません' });
  }
  const item = store.getFoundItem(Number(req.params.id));
  if (!item) return res.status(404).json({ error: '見つかりません' });
  if (item.status === 'returned') return res.status(400).json({ error: 'すでに返却済みです' });

  store.updateFoundItem(item.id, {
    status: 'returned',
    returnedAt: new Date().toISOString(),
    returnedTo: cleanText((req.body || {}).returnedTo, 50) || '記録なし',
  });

  io.emit('item-returned', publicItem(item));
  res.json(publicItem(item));
});

// --- 探し物リクエストの登録(マッチング待機) ---
app.post('/api/lost', rateLimit(15, 60 * 1000), (req, res) => {
  const body = req.body || {};
  const keywords = cleanText(body.keywords, 100);
  if (!keywords) return res.status(400).json({ error: '探しているものを入力してください' });

  const request = store.createLostRequest({
    keywords,
    category: cleanCategory(body.category) || findCategoryInText(keywords),
    color: cleanColor(body.color) || findColorInText(keywords),
    contactName: cleanText(body.contactName, 50),
  });

  // 既存の保管中アイテムと即時マッチング
  const matches = [];
  for (const item of store.listFoundItems()) {
    if (item.status !== 'stored') continue;
    const { score, reasons } = matchLostToFound(request, item);
    if (score >= MATCH_THRESHOLD) {
      request.matchedItemIds.push(item.id);
      matches.push({ item: publicItem(item), score, reasons });
    }
  }
  store.save();
  matches.sort((a, b) => b.score - a.score);

  res.json({ request: publicLost(request), matches });
});

app.get('/api/lost/:id/matches', (req, res) => {
  const request = store.getLostRequest(Number(req.params.id));
  if (!request) return res.status(404).json({ error: '見つかりません' });

  const matches = [];
  for (const item of store.listFoundItems()) {
    if (item.status !== 'stored') continue;
    const { score, reasons } = matchLostToFound(request, item);
    if (score >= MATCH_THRESHOLD) matches.push({ item: publicItem(item), score, reasons });
  }
  matches.sort((a, b) => b.score - a.score);
  res.json({ request: publicLost(request), matches });
});

app.post('/api/lost/:id/resolve', (req, res) => {
  const request = store.updateLostRequest(Number(req.params.id), { status: 'resolved' });
  if (!request) return res.status(404).json({ error: '見つかりません' });
  res.json(publicLost(request));
});

// --- 統計 ---
app.get('/api/stats', (req, res) => {
  const items = store.listFoundItems();
  const total = items.length;
  const returned = items.filter((i) => i.status === 'returned').length;

  const byCategory = {};
  for (const cat of CATEGORIES) byCategory[cat.id] = { label: cat.label, emoji: cat.emoji, stored: 0, returned: 0 };
  for (const item of items) {
    const bucket = byCategory[item.category];
    if (!bucket) continue;
    if (item.status === 'returned') bucket.returned++;
    else bucket.stored++;
  }

  // 直近7日間の登録数
  const days = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({
      date: key,
      count: items.filter((it) => (it.createdAt || '').slice(0, 10) === key).length,
    });
  }

  const waitingLost = store.listLostRequests().filter(isActiveLost).length;

  res.json({
    total,
    returned,
    stored: total - returned,
    returnRate: total > 0 ? Math.round((returned / total) * 100) : 0,
    waitingLost,
    byCategory,
    last7days: days,
    recent: items.slice(0, 8).map(publicItem),
  });
});

// --- レスポンス整形(内部フィールドを隠す) ---
function publicItem(item) {
  const cat = categoryById(item.category) || { label: 'その他', emoji: '❓' };
  return {
    id: item.id,
    category: item.category,
    categoryLabel: cat.label,
    categoryEmoji: cat.emoji,
    color: item.color,
    tags: item.tags || [],
    description: item.description || '',
    locationFound: item.locationFound || '',
    storagePlace: item.storagePlace || '',
    imagePath: item.imagePath,
    status: item.status,
    createdAt: item.createdAt,
    returnedAt: item.returnedAt,
  };
}

function publicLost(request) {
  return {
    id: request.id,
    keywords: request.keywords,
    category: request.category,
    color: request.color,
    status: request.status,
    createdAt: request.createdAt,
  };
}

// --- エラーハンドリング(HTMLのスタックトレースを返さず、必ずJSONで返す) ---
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? '画像サイズは8MBまでです'
      : '画像のアップロードに失敗しました';
    return res.status(400).json({ error: message });
  }
  console.error('[server] 予期しないエラー:', err);
  res.status(500).json({ error: 'サーバーエラーが発生しました' });
});

// --- Socket.IO: 探し物の待機部屋 ---
io.on('connection', (socket) => {
  socket.on('watch-lost', (lostId) => {
    const id = Number(lostId);
    if (Number.isInteger(id) && id > 0) socket.join(`lost-${id}`);
  });
});

server.listen(PORT, () => {
  console.log(`みつかる君 サーバー起動: http://localhost:${PORT}`);
});
