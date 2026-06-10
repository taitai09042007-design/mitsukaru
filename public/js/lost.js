// 探し物登録ページ: 登録 → 即時マッチ表示 → Socket.IOでリアルタイム通知待機
(async () => {
  const { $, esc, fetchJSON, loadMeta, fillCategorySelect, fillColorSelect, parseTextClient, toast, playChime, itemCardHTML, openItemModal } = App;
  const meta = await loadMeta();

  const form = $('#lost-form');
  const keywordsInput = $('#keywords-input');
  const categorySelect = $('#category-select');
  const colorSelect = $('#color-select');
  const parseHint = $('#parse-hint');
  const watchSection = $('#watch-section');
  const matchesArea = $('#matches-area');

  fillCategorySelect(categorySelect, meta, true);
  fillColorSelect(colorSelect, meta);

  const socket = io();
  let currentLostId = null;
  const STORAGE_KEY = 'mitsukaru_lost_id';

  // 入力中にカテゴリを自動判定して反映
  keywordsInput.addEventListener('input', () => {
    const { category } = parseTextClient(meta, keywordsInput.value);
    if (category) {
      categorySelect.value = category;
      const cat = meta.categories.find((c) => c.id === category);
      parseHint.textContent = `カテゴリを「${cat.label}」と自動判定しました`;
    } else {
      parseHint.textContent = '';
    }
  });

  function matchCardHTML(match) {
    return `
      <div class="match-banner">
        <div style="font-weight:700; margin-bottom:10px">🎉 みつかったかも! <span class="badge badge-score">一致度 ${match.score}</span></div>
        <div class="grid" style="grid-template-columns: 1fr">
          ${itemCardHTML(match.item)}
        </div>
        <div style="font-size:0.85rem; margin-top:10px">
          📍 保管場所: <strong>${esc(match.item.storagePlace || '不明')}</strong> に取りにいってね
        </div>
      </div>`;
  }

  function bindMatchCards() {
    matchesArea.querySelectorAll('.item-card').forEach((card) => {
      card.addEventListener('click', () => openItemModal(Number(card.dataset.id), meta));
    });
  }

  function showWatchScreen(request, matches) {
    form.style.display = 'none';
    watchSection.style.display = 'block';
    $('#watch-keywords').textContent = request.keywords;
    matchesArea.innerHTML = (matches || []).map(matchCardHTML).join('');
    bindMatchCards();
  }

  function startWatching(lostId) {
    currentLostId = lostId;
    localStorage.setItem(STORAGE_KEY, String(lostId));
    socket.emit('watch-lost', lostId);
  }

  // 再接続時にも部屋に入りなおす
  socket.on('connect', () => {
    if (currentLostId) socket.emit('watch-lost', currentLostId);
  });

  // リアルタイムマッチ通知
  socket.on('match-found', (payload) => {
    if (payload.lostId !== currentLostId) return;
    matchesArea.insertAdjacentHTML('afterbegin', matchCardHTML(payload));
    bindMatchCards();
    playChime();
    toast('🎉 探し物が届いたかもしれません!');
    if (Notification && Notification.permission === 'granted') {
      new Notification('みつかる君', { body: '探し物が届いたかもしれません!画面を確認してね' });
    }
  });

  // --- 登録 ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const keywords = keywordsInput.value.trim();
    if (!keywords) return;

    try {
      const data = await fetchJSON('/api/lost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords,
          category: categorySelect.value,
          color: colorSelect.value,
          contactName: $('#contact-input').value,
        }),
      });

      showWatchScreen(data.request, data.matches);
      startWatching(data.request.id);

      if (data.matches.length > 0) {
        playChime();
        toast(`すでに ${data.matches.length} 件みつかっています!`);
      }
      if (window.Notification && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    } catch (err) {
      toast(err.message);
    }
  });

  // --- 解決してやめる ---
  $('#stop-btn').addEventListener('click', async () => {
    if (currentLostId) {
      await fetchJSON(`/api/lost/${currentLostId}/resolve`, { method: 'POST' }).catch(() => {});
    }
    localStorage.removeItem(STORAGE_KEY);
    currentLostId = null;
    watchSection.style.display = 'none';
    form.style.display = 'block';
    form.reset();
    toast('よかったね!登録を終了しました');
  });

  // --- 前回の待機を復元 ---
  const savedId = Number(localStorage.getItem(STORAGE_KEY));
  if (savedId) {
    try {
      const data = await fetchJSON(`/api/lost/${savedId}/matches`);
      if (data.request.status === 'waiting') {
        showWatchScreen(data.request, data.matches);
        startWatching(savedId);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (_) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
})();
