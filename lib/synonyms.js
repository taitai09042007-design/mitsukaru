// 日本語シノニム辞書
// COCO-SSD の英語ラベルと、日本語の言い換え・表記ゆれを1つのカテゴリに束ねる

const CATEGORIES = [
  {
    id: 'bottle',
    label: '水筒・ボトル',
    emoji: '🥤',
    cocoClasses: ['bottle', 'cup', 'wine glass'],
    synonyms: ['水筒', 'すいとう', 'スイトウ', 'ボトル', 'ぼとる', 'ペットボトル', 'マグ', 'マグボトル', 'コップ', 'カップ', 'タンブラー'],
  },
  {
    id: 'umbrella',
    label: '傘',
    emoji: '☂️',
    cocoClasses: ['umbrella'],
    synonyms: ['傘', 'かさ', 'カサ', '折りたたみ傘', '折り畳み傘', 'ビニール傘', 'アンブレラ', '日傘'],
  },
  {
    id: 'bag',
    label: 'かばん・バッグ',
    emoji: '🎒',
    cocoClasses: ['backpack', 'handbag', 'suitcase'],
    synonyms: ['かばん', 'カバン', '鞄', 'バッグ', 'リュック', 'リュックサック', 'ランドセル', '手提げ', 'トート', 'ポーチ', '袋', 'ふくろ', 'ナップサック'],
  },
  {
    id: 'book',
    label: '本・ノート',
    emoji: '📚',
    cocoClasses: ['book'],
    synonyms: ['本', 'ほん', 'ノート', 'のーと', '教科書', 'きょうかしょ', '参考書', '問題集', '手帳', 'ドリル', 'プリント', 'ファイル'],
  },
  {
    id: 'phone',
    label: 'スマホ・携帯',
    emoji: '📱',
    cocoClasses: ['cell phone'],
    synonyms: ['スマホ', 'すまほ', 'スマートフォン', '携帯', 'けいたい', 'ケータイ', '携帯電話', 'アイフォン', 'iphone', 'アンドロイド', 'android'],
  },
  {
    id: 'device',
    label: 'パソコン・タブレット',
    emoji: '💻',
    cocoClasses: ['laptop', 'keyboard', 'mouse', 'remote', 'tv'],
    synonyms: ['パソコン', 'ぱそこん', 'ノートパソコン', 'pc', 'タブレット', 'アイパッド', 'ipad', 'クロームブック', 'chromebook', '充電器', 'じゅうでんき', 'ケーブル', 'マウス', 'キーボード'],
  },
  {
    id: 'watch',
    label: '時計',
    emoji: '⌚',
    cocoClasses: ['clock'],
    synonyms: ['時計', 'とけい', '腕時計', 'うでどけい', 'ウォッチ', 'スマートウォッチ'],
  },
  {
    id: 'stationery',
    label: '文房具',
    emoji: '✏️',
    cocoClasses: ['scissors'],
    synonyms: ['文房具', 'ぶんぼうぐ', '筆箱', 'ふでばこ', 'ペンケース', 'ペン', 'シャーペン', 'シャープペン', 'えんぴつ', '鉛筆', 'ボールペン', '消しゴム', 'けしごむ', '定規', 'じょうぎ', 'はさみ', 'ハサミ', 'のり', 'マーカー', '蛍光ペン'],
  },
  {
    id: 'sports',
    label: 'スポーツ用品',
    emoji: '⚽',
    cocoClasses: ['sports ball', 'frisbee', 'skateboard', 'baseball glove', 'baseball bat', 'tennis racket'],
    synonyms: ['ボール', 'ぼーる', 'サッカーボール', 'バスケットボール', 'バレーボール', '野球ボール', 'グローブ', 'バット', 'ラケット', '縄跳び', 'なわとび', 'ゼッケン', 'シューズ', '上履き', 'うわばき', '体育館シューズ'],
  },
  {
    id: 'plush',
    label: 'ぬいぐるみ・小物',
    emoji: '🧸',
    cocoClasses: ['teddy bear'],
    synonyms: ['ぬいぐるみ', 'ヌイグルミ', '人形', 'にんぎょう', 'マスコット', 'キーホルダー', 'ストラップ', 'お守り', 'おまもり'],
  },
  {
    id: 'clothing',
    label: '衣類・身につけるもの',
    emoji: '🧥',
    cocoClasses: ['tie'],
    synonyms: ['服', 'ふく', '上着', 'うわぎ', 'ジャージ', '体操服', 'たいそうふく', '制服', 'せいふく', 'セーター', 'カーディガン', 'パーカー', 'ネクタイ', 'リボン', '帽子', 'ぼうし', 'キャップ', 'マフラー', '手袋', 'てぶくろ', '靴下', 'くつした', 'タオル', 'ハンカチ', 'マスク', '靴', 'くつ'],
  },
  {
    id: 'glasses',
    label: 'メガネ',
    emoji: '👓',
    cocoClasses: [],
    synonyms: ['メガネ', 'めがね', '眼鏡', 'サングラス', 'メガネケース'],
  },
  {
    id: 'wallet',
    label: '財布・貴重品',
    emoji: '👛',
    cocoClasses: [],
    synonyms: ['財布', 'さいふ', 'サイフ', 'ウォレット', '小銭入れ', 'お金', 'コインケース'],
  },
  {
    id: 'key',
    label: '鍵',
    emoji: '🔑',
    cocoClasses: [],
    synonyms: ['鍵', 'かぎ', 'カギ', 'キー', '自転車の鍵', '家の鍵'],
  },
  {
    id: 'earphone',
    label: 'イヤホン',
    emoji: '🎧',
    cocoClasses: [],
    synonyms: ['イヤホン', 'いやほん', 'ヘッドホン', 'ヘッドフォン', 'エアポッズ', 'airpods', 'ワイヤレスイヤホン'],
  },
  {
    id: 'card',
    label: '定期・カード類',
    emoji: '🪪',
    cocoClasses: [],
    synonyms: ['定期', '定期券', 'ていき', 'icカード', 'スイカ', 'suica', 'パスモ', 'pasmo', 'イコカ', 'icoca', 'カード', '生徒手帳', '学生証', '名札', 'なふだ'],
  },
  {
    id: 'other',
    label: 'その他',
    emoji: '❓',
    cocoClasses: [],
    synonyms: [],
  },
];

const COLORS = [
  { id: 'red', label: '赤' },
  { id: 'orange', label: 'オレンジ' },
  { id: 'yellow', label: '黄色' },
  { id: 'green', label: '緑' },
  { id: 'lightblue', label: '水色' },
  { id: 'blue', label: '青' },
  { id: 'purple', label: '紫' },
  { id: 'pink', label: 'ピンク' },
  { id: 'brown', label: '茶色' },
  { id: 'white', label: '白' },
  { id: 'gray', label: 'グレー' },
  { id: 'black', label: '黒' },
];

// 色の言い換え(「あお」「青い」「ブルー」など)
const COLOR_SYNONYMS = {
  red: ['赤', 'あか', 'レッド', '赤色'],
  orange: ['オレンジ', 'おれんじ', '橙', 'だいだい'],
  yellow: ['黄色', '黄', 'きいろ', 'イエロー', '金色', 'きんいろ', 'ゴールド'],
  green: ['緑', 'みどり', 'グリーン', '黄緑', 'きみどり', '深緑'],
  lightblue: ['水色', 'みずいろ', 'ライトブルー', '空色', 'そらいろ', 'スカイブルー'],
  blue: ['青', 'あお', 'ブルー', '青色', '紺', 'こん', 'ネイビー', '紺色'],
  purple: ['紫', 'むらさき', 'パープル', '藤色'],
  pink: ['ピンク', 'ぴんく', '桃色', 'ももいろ'],
  brown: ['茶色', '茶', 'ちゃいろ', 'ブラウン', 'ベージュ'],
  white: ['白', 'しろ', 'ホワイト', '白色'],
  gray: ['グレー', 'ぐれー', '灰色', 'はいいろ', 'シルバー', '銀色'],
  black: ['黒', 'くろ', 'ブラック', '黒色'],
};

// COCOクラス名 → カテゴリID の逆引きマップ
const COCO_TO_CATEGORY = {};
for (const cat of CATEGORIES) {
  for (const coco of cat.cocoClasses) {
    COCO_TO_CATEGORY[coco] = cat.id;
  }
}

function normalize(text) {
  return String(text || '')
    .normalize('NFKC')
    .toLowerCase()
    .trim();
}

function categoryById(id) {
  return CATEGORIES.find((c) => c.id === id) || null;
}

// テキストからカテゴリを推定(最初に見つかったもの)
function findCategoryInText(text) {
  const t = normalize(text);
  if (!t) return null;
  for (const cat of CATEGORIES) {
    for (const syn of cat.synonyms) {
      if (t.includes(normalize(syn))) return cat.id;
    }
  }
  return null;
}

// テキストから色を推定(最初に見つかったもの)
function findColorInText(text) {
  const t = normalize(text);
  if (!t) return null;
  // 「水色」を「水」+「色」と誤判定しないよう、長い語から先に照合する
  const entries = [];
  for (const [colorId, syns] of Object.entries(COLOR_SYNONYMS)) {
    for (const syn of syns) entries.push([colorId, normalize(syn)]);
  }
  entries.sort((a, b) => b[1].length - a[1].length);
  for (const [colorId, syn] of entries) {
    if (t.includes(syn)) return colorId;
  }
  return null;
}

// 検索キーワードをトークンに分割(空白・句読点区切り)
function tokenize(text) {
  return normalize(text)
    .split(/[\s、。,，.・/]+/)
    .filter((t) => t.length >= 2);
}

module.exports = {
  CATEGORIES,
  COLORS,
  COLOR_SYNONYMS,
  COCO_TO_CATEGORY,
  normalize,
  categoryById,
  findCategoryInText,
  findColorInText,
  tokenize,
};
