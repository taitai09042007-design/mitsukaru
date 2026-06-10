// トップページ: 検索 + 最近の拾得物ギャラリー
(async () => {
  const { $, fetchJSON, loadMeta, itemCardHTML, openItemModal, toast } = App;
  const meta = await loadMeta();

  const searchInput = $('#search-input');
  const searchBtn = $('#search-btn');
  const resultsSection = $('#results-section');
  const resultsGrid = $('#results-grid');
  const resultsEmpty = $('#results-empty');
  const resultsCount = $('#results-count');
  const recentGrid = $('#recent-grid');
  const recentEmpty = $('#recent-empty');

  function bindCards(root) {
    root.querySelectorAll('.item-card').forEach((card) => {
      card.addEventListener('click', () => {
        openItemModal(Number(card.dataset.id), meta, refreshAll);
      });
    });
  }

  async function loadRecent() {
    const data = await fetchJSON('/api/found');
    recentGrid.innerHTML = data.results.slice(0, 12).map((item) => itemCardHTML(item)).join('');
    recentEmpty.style.display = data.results.length ? 'none' : 'block';
    bindCards(recentGrid);
  }

  async function doSearch() {
    const q = searchInput.value.trim();
    if (!q) {
      resultsSection.style.display = 'none';
      return;
    }
    const data = await fetchJSON(`/api/found?q=${encodeURIComponent(q)}&status=stored`);
    resultsSection.style.display = 'block';
    resultsGrid.innerHTML = data.results.map((item) => itemCardHTML(item, { score: item.score })).join('');
    resultsEmpty.style.display = data.results.length ? 'none' : 'block';
    resultsCount.textContent = data.results.length ? `${data.results.length}件みつかりました` : '';
    bindCards(resultsGrid);
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function refreshAll() {
    loadRecent();
    if (searchInput.value.trim()) doSearch();
  }

  searchBtn.addEventListener('click', doSearch);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
  });

  // リアルタイム更新: 新しい拾得物・返却があったら一覧を更新
  const socket = io();
  socket.on('found-registered', () => {
    toast('🧺 新しい落とし物が届きました');
    refreshAll();
  });
  socket.on('item-returned', refreshAll);

  await loadRecent();
})();
