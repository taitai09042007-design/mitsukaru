// マッチングエンジン
// カテゴリ一致(+50) / 色一致(+25) / キーワード部分一致(+10×, 最大30) の加点方式

const {
  normalize,
  findCategoryInText,
  findColorInText,
  tokenize,
  categoryById,
} = require('./synonyms');

const MATCH_THRESHOLD = 50;

// 拾得物の検索対象テキストをまとめる
function foundItemText(item) {
  return normalize(
    [
      item.description,
      Array.isArray(item.tags) ? item.tags.join(' ') : '',
      item.locationFound,
      (categoryById(item.category) || {}).label,
    ].join(' ')
  );
}

// 検索クエリ(自由文)を {category, color, tokens} に解析
function parseQuery(text) {
  return {
    category: findCategoryInText(text),
    color: findColorInText(text),
    tokens: tokenize(text),
  };
}

// 解析済みクエリと拾得物のマッチスコアを計算
function scoreAgainstFound(parsed, item) {
  let score = 0;
  const reasons = [];

  if (parsed.category && parsed.category === item.category) {
    score += 50;
    reasons.push('カテゴリ一致');
  }
  if (parsed.color && item.color && parsed.color === item.color) {
    score += 25;
    reasons.push('色一致');
  }

  const text = foundItemText(item);
  let keywordScore = 0;
  for (const token of parsed.tokens) {
    if (text.includes(token)) keywordScore += 10;
  }
  keywordScore = Math.min(keywordScore, 30);
  if (keywordScore > 0) {
    score += keywordScore;
    reasons.push('キーワード一致');
  }

  return { score, reasons };
}

// 探し物リクエスト(登録済み)と拾得物のマッチ判定
function matchLostToFound(lostRequest, item) {
  const parsed = {
    category: lostRequest.category || findCategoryInText(lostRequest.keywords),
    color: lostRequest.color || findColorInText(lostRequest.keywords),
    tokens: tokenize(lostRequest.keywords),
  };
  return scoreAgainstFound(parsed, item);
}

// 自由文検索: スコア付きで降順ソートして返す
function searchFoundItems(query, items) {
  const parsed = parseQuery(query);
  const results = [];
  for (const item of items) {
    const { score, reasons } = scoreAgainstFound(parsed, item);
    if (score > 0) results.push({ item, score, reasons });
  }
  results.sort((a, b) => b.score - a.score || b.item.id - a.item.id);
  return results;
}

module.exports = {
  MATCH_THRESHOLD,
  parseQuery,
  scoreAgainstFound,
  matchLostToFound,
  searchFoundItems,
};
