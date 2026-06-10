// 共通ヘルパー(全ページで読み込む)
const App = (() => {
  let metaCache = null;

  const COLOR_CSS = {
    red: '#ef4444',
    orange: '#f97316',
    yellow: '#eab308',
    green: '#22c55e',
    lightblue: '#38bdf8',
    blue: '#2563eb',
    purple: '#8b5cf6',
    pink: '#ec4899',
    brown: '#92400e',
    white: '#f8fafc',
    gray: '#9ca3af',
    black: '#111827',
  };

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $all(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function esc(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  async function fetchJSON(url, options) {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `エラー (${res.status})`);
    return data;
  }

  // /api/meta(カテゴリ・色・シノニム)をキャッシュ付きで取得
  async function loadMeta() {
    if (!metaCache) metaCache = await fetchJSON('/api/meta');
    return metaCache;
  }

  function colorLabel(meta, colorId) {
    const c = meta.colors.find((c) => c.id === colorId);
    return c ? c.label : '';
  }

  function colorDot(colorId) {
    if (!colorId || !COLOR_CSS[colorId]) return '';
    return `<span class="color-dot" style="background:${COLOR_CSS[colorId]}"></span>`;
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function toast(message, ms) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), ms || 2600);
  }

  // selectにカテゴリ/色の選択肢を構築
  function fillCategorySelect(select, meta, withEmpty) {
    select.innerHTML = (withEmpty ? '<option value="">えらんでください</option>' : '') +
      meta.categories.map((c) => `<option value="${c.id}">${c.emoji} ${esc(c.label)}</option>`).join('');
  }

  function fillColorSelect(select, meta) {
    select.innerHTML = '<option value="">わからない / なし</option>' +
      meta.colors.map((c) => `<option value="${c.id}">${esc(c.label)}</option>`).join('');
  }

  // クライアント側でも自由文からカテゴリ・色を推定(入力中のライブ表示用)
  function parseTextClient(meta, text) {
    const t = (text || '').normalize('NFKC').toLowerCase();
    let category = null;
    outer:
    for (const cat of meta.categories) {
      for (const syn of cat.synonyms || []) {
        if (t.includes(syn.normalize('NFKC').toLowerCase())) {
          category = cat.id;
          break outer;
        }
      }
    }
    return { category };
  }

  // 拾得物カードのHTML
  function itemCardHTML(item, extra) {
    const img = item.imagePath
      ? `<img class="thumb" src="${esc(item.imagePath)}" alt="" loading="lazy">`
      : `<div class="thumb">${item.categoryEmoji || '❓'}</div>`;
    const badge = item.status === 'returned'
      ? '<span class="badge badge-returned">返却済み</span>'
      : '<span class="badge badge-stored">保管中</span>';
    const score = extra && extra.score != null
      ? `<span class="badge badge-score">一致度 ${extra.score}</span>`
      : '';
    return `
      <div class="item-card ${item.status === 'returned' ? 'returned' : ''}" data-id="${item.id}">
        ${img}
        <div class="body">
          <div class="title">${item.categoryEmoji || ''} ${esc(item.categoryLabel)} ${colorDot(item.color)}</div>
          <div class="meta">${esc(item.locationFound || '場所不明')} ・ ${fmtDate(item.createdAt)}</div>
          <div class="meta" style="margin-top:6px">${badge} ${score}</div>
        </div>
      </div>`;
  }

  // 詳細モーダルを開く(返却記録ボタン付き)
  async function openItemModal(itemId, meta, onReturned) {
    const item = await fetchJSON(`/api/found/${itemId}`);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        ${item.imagePath ? `<img src="${esc(item.imagePath)}" alt="">` : ''}
        <h2 style="margin-bottom:10px">${item.categoryEmoji || ''} ${esc(item.categoryLabel)}</h2>
        <div class="detail-row"><span class="key">状態</span><span>${item.status === 'returned' ? '返却済み 🎉' : '保管中'}</span></div>
        <div class="detail-row"><span class="key">色</span><span>${colorDot(item.color)} ${esc(colorLabel(meta, item.color) || '不明')}</span></div>
        ${item.tags.length ? `<div class="detail-row"><span class="key">AIタグ</span><span>${item.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join(' ')}</span></div>` : ''}
        ${item.description ? `<div class="detail-row"><span class="key">特徴メモ</span><span>${esc(item.description)}</span></div>` : ''}
        <div class="detail-row"><span class="key">拾った場所</span><span>${esc(item.locationFound || '不明')}</span></div>
        <div class="detail-row"><span class="key">保管場所</span><span>📍 ${esc(item.storagePlace || '不明')}</span></div>
        <div class="detail-row"><span class="key">登録日時</span><span>${fmtDate(item.createdAt)}</span></div>
        <div style="display:flex; gap:10px; margin-top:18px; flex-wrap:wrap">
          ${item.status === 'stored' ? '<button class="btn btn-accent btn-sm" id="modal-return">✅ 返却記録をつける</button>' : ''}
          <button class="btn btn-ghost btn-sm" id="modal-close">とじる</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    $('#modal-close', overlay).addEventListener('click', () => overlay.remove());

    const returnBtn = $('#modal-return', overlay);
    if (returnBtn) {
      returnBtn.addEventListener('click', async () => {
        let staffPin = '';
        if (meta.staffPinRequired) {
          staffPin = prompt('保管担当のPINを入力してください');
          if (staffPin === null) return;
        }
        const name = prompt('受け取った人の名前(クラス・名前など)を入力してください');
        if (name === null) return;
        try {
          await fetchJSON(`/api/found/${item.id}/return`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ returnedTo: name, staffPin }),
          });
          toast('返却を記録しました 🎉');
          overlay.remove();
          if (onReturned) onReturned();
        } catch (err) {
          toast(err.message);
        }
      });
    }
  }

  // マッチ通知音(WebAudioで生成、音声ファイル不要)
  function playChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.14);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.14 + 0.5);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.14);
        osc.stop(ctx.currentTime + i * 0.14 + 0.55);
      });
    } catch (_) { /* 音が出なくても致命的ではない */ }
  }

  return {
    $, $all, esc, fetchJSON, loadMeta, colorLabel, colorDot, fmtDate,
    toast, fillCategorySelect, fillColorSelect, parseTextClient,
    itemCardHTML, openItemModal, playChime, COLOR_CSS,
  };
})();
