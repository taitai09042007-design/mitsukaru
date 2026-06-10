// エッジAIモジュール
// ブラウザ内で完結する 物体認識(TensorFlow.js COCO-SSD) + 主要色解析(Canvasピクセル解析)
// サーバーには画像処理の負荷をいっさいかけない
const AiTagger = (() => {
  let modelPromise = null;

  // COCO英語ラベル → 日本語表示名(タグ表示用)
  const COCO_JP = {
    'bottle': 'ボトル', 'cup': 'コップ', 'wine glass': 'グラス',
    'umbrella': '傘', 'backpack': 'リュック', 'handbag': 'バッグ',
    'suitcase': 'スーツケース', 'book': '本', 'cell phone': 'スマホ',
    'laptop': 'ノートPC', 'keyboard': 'キーボード', 'mouse': 'マウス',
    'remote': 'リモコン', 'tv': 'モニター', 'clock': '時計',
    'scissors': 'はさみ', 'sports ball': 'ボール', 'frisbee': 'フリスビー',
    'skateboard': 'スケートボード', 'baseball glove': 'グローブ',
    'baseball bat': 'バット', 'tennis racket': 'ラケット',
    'teddy bear': 'ぬいぐるみ', 'tie': 'ネクタイ', 'toothbrush': '歯ブラシ',
    'banana': 'バナナ', 'apple': 'りんご', 'orange': 'みかん', 'bowl': 'おわん',
    'fork': 'フォーク', 'knife': 'ナイフ', 'spoon': 'スプーン',
    'hair drier': 'ドライヤー', 'vase': '花びん', 'potted plant': '植木鉢',
  };

  // モデルの読み込み(初回のみ。CDNからモデル重みを取得)
  function loadModel() {
    if (!modelPromise) {
      if (typeof cocoSsd === 'undefined') {
        return Promise.reject(new Error('AIライブラリが読み込めませんでした(インターネット接続を確認)'));
      }
      modelPromise = cocoSsd.load({ base: 'lite_mobilenet_v2' });
    }
    return modelPromise;
  }

  // canvas を解析して { detections, best, color, tags } を返す
  async function analyze(canvas) {
    let detections = [];
    try {
      const model = await loadModel();
      detections = await model.detect(canvas, 5, 0.4);
    } catch (err) {
      console.warn('物体認識に失敗(手動選択にフォールバック):', err);
    }
    detections.sort((a, b) => b.score - a.score);
    const best = detections[0] || null;

    const color = extractDominantColor(canvas, best ? best.bbox : null);

    // タグ: 認識した物体の日本語名(重複除去)
    const tags = [];
    for (const det of detections) {
      const jp = COCO_JP[det.class] || det.class;
      if (!tags.includes(jp)) tags.push(jp);
    }

    return { detections, best, color, tags };
  }

  // --- 主要色の抽出 ---
  // 検出ボックス(なければ中央60%)のピクセルをHSV分類し、最頻色を返す
  function extractDominantColor(canvas, bbox) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let x, y, w, h;
    if (bbox) {
      // ボックスを中央に20%縮めて背景の混入を減らす
      const [bx, by, bw, bh] = bbox;
      x = bx + bw * 0.2;
      y = by + bh * 0.2;
      w = bw * 0.6;
      h = bh * 0.6;
    } else {
      x = canvas.width * 0.2;
      y = canvas.height * 0.2;
      w = canvas.width * 0.6;
      h = canvas.height * 0.6;
    }
    x = Math.max(0, Math.floor(x));
    y = Math.max(0, Math.floor(y));
    w = Math.min(canvas.width - x, Math.max(1, Math.floor(w)));
    h = Math.min(canvas.height - y, Math.max(1, Math.floor(h)));

    let data;
    try {
      data = ctx.getImageData(x, y, w, h).data;
    } catch (err) {
      return null;
    }

    const counts = {};
    const step = Math.max(1, Math.floor((w * h) / 4000)) * 4; // 最大約4000ピクセルをサンプリング
    for (let i = 0; i < data.length; i += step) {
      const colorId = classifyColor(data[i], data[i + 1], data[i + 2]);
      counts[colorId] = (counts[colorId] || 0) + 1;
    }

    let bestColor = null;
    let bestCount = 0;
    for (const [colorId, count] of Object.entries(counts)) {
      if (count > bestCount) {
        bestColor = colorId;
        bestCount = count;
      }
    }
    return bestColor;
  }

  // RGB → 12色分類(HSVベース)
  function classifyColor(r, g, b) {
    const { h, s, v } = rgbToHsv(r, g, b);

    if (v < 0.16) return 'black';
    if (s < 0.18) {
      if (v > 0.82) return 'white';
      if (v < 0.35) return 'black';
      return 'gray';
    }

    if (h < 15 || h >= 340) {
      // 明るくて淡い赤系はピンク扱い
      return s < 0.5 && v > 0.75 ? 'pink' : 'red';
    }
    if (h < 42) {
      // 暗いオレンジ系は茶色
      return v < 0.55 ? 'brown' : 'orange';
    }
    if (h < 70) return 'yellow';
    if (h < 165) return 'green';
    if (h < 200) return 'lightblue';
    if (h < 255) return 'blue';
    if (h < 290) return 'purple';
    return 'pink';
  }

  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d > 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h, s: max === 0 ? 0 : d / max, v: max };
  }

  function jpLabel(cocoClass) {
    return COCO_JP[cocoClass] || cocoClass;
  }

  return { loadModel, analyze, jpLabel };
})();
