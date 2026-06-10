// ダッシュボード: 統計とリアルタイム更新
(async () => {
  const { $, esc, fetchJSON, loadMeta, itemCardHTML, openItemModal } = App;
  const meta = await loadMeta();

  async function render() {
    const stats = await fetchJSON('/api/stats');

    $('#stat-total').textContent = stats.total;
    $('#stat-returned').textContent = stats.returned;
    $('#stat-rate').textContent = `${stats.returnRate}%`;
    $('#stat-waiting').textContent = stats.waitingLost;

    // カテゴリ別バー
    const rows = Object.values(stats.byCategory)
      .map((c) => ({ ...c, total: c.stored + c.returned }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);

    const maxTotal = Math.max(1, ...rows.map((c) => c.total));
    $('#category-bars').innerHTML = rows.length
      ? rows.map((c) => `
          <div class="bar-row">
            <div class="bar-label">${c.emoji} ${esc(c.label)}</div>
            <div class="bar-track">
              <div class="bar-fill" style="width:${(c.stored / maxTotal) * 100}%"></div>
              <div class="bar-fill returned" style="width:${(c.returned / maxTotal) * 100}%"></div>
            </div>
            <div class="bar-num">${c.total}件</div>
          </div>`).join('')
      : '<div class="empty-state">まだデータがありません</div>';

    // 直近7日間
    const maxDay = Math.max(1, ...stats.last7days.map((d) => d.count));
    $('#week-bars').innerHTML = stats.last7days.map((d) => {
      const label = `${Number(d.date.slice(5, 7))}/${Number(d.date.slice(8, 10))}`;
      return `
        <div class="bar-row">
          <div class="bar-label">${label}</div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${(d.count / maxDay) * 100}%"></div>
          </div>
          <div class="bar-num">${d.count}件</div>
        </div>`;
    }).join('');

    // 最近の落とし物
    const recentGrid = $('#recent-grid');
    recentGrid.innerHTML = stats.recent.map((item) => itemCardHTML(item)).join('') ||
      '<div class="empty-state">まだ落とし物は登録されていません</div>';
    recentGrid.querySelectorAll('.item-card').forEach((card) => {
      card.addEventListener('click', () => openItemModal(Number(card.dataset.id), meta, render));
    });
  }

  // リアルタイム更新
  const socket = io();
  socket.on('found-registered', render);
  socket.on('item-returned', render);

  await render();
})();
