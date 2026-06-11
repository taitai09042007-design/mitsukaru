// 保管担当ページ: PIN認証 → 返却履歴の表示
(async () => {
  const { $, esc, fetchJSON, loadMeta, colorDot, colorLabel, fmtDate, toast } = App;
  const meta = await loadMeta();

  const pinForm = $('#pin-form');
  const pinInput = $('#pin-input');
  const pinError = $('#pin-error');
  const historySection = $('#history-section');

  const PIN_KEY = 'mitsukaru_staff_pin';

  function historyRowHTML(item) {
    const img = item.imagePath
      ? `<img src="${esc(item.imagePath)}" alt="" style="width:72px; height:54px; object-fit:cover; border-radius:8px; background:#eef4f3" loading="lazy">`
      : `<div style="width:72px; height:54px; border-radius:8px; background:#eef4f3; display:flex; align-items:center; justify-content:center; font-size:1.5rem">${item.categoryEmoji || '❓'}</div>`;
    return `
      <div class="card" style="display:flex; gap:14px; align-items:center; margin-bottom:10px; padding:14px">
        ${img}
        <div style="flex:1; min-width:0">
          <div style="font-weight:700">${item.categoryEmoji || ''} ${esc(item.categoryLabel)} ${colorDot(item.color)} ${esc(colorLabel(meta, item.color) || '')}</div>
          <div style="font-size:0.8rem; color:var(--text-sub)">
            返却: ${fmtDate(item.returnedAt)} ・ 受け取った人: <strong>${esc(item.returnedTo)}</strong>
          </div>
          <div style="font-size:0.78rem; color:var(--text-sub)">
            届けた人: ${esc(item.reporterName)} ・ 拾った場所: ${esc(item.locationFound || '不明')} ・ 保管: ${esc(item.storagePlace || '不明')}
          </div>
        </div>
      </div>`;
  }

  async function loadHistory(pin) {
    const data = await fetchJSON('/api/staff/history', {
      headers: pin ? { 'x-staff-pin': pin } : {},
    });

    pinForm.style.display = 'none';
    historySection.style.display = 'block';
    $('#stat-returned').textContent = data.items.length;
    $('#stat-stored').textContent = data.storedCount;
    $('#demo-notice').style.display = meta.staffPinRequired ? 'none' : 'block';

    $('#history-list').innerHTML = data.items.map(historyRowHTML).join('');
    $('#history-empty').style.display = data.items.length ? 'none' : 'block';
  }

  pinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = pinInput.value.trim();
    try {
      await loadHistory(pin);
      sessionStorage.setItem(PIN_KEY, pin); // このタブを閉じるまで記憶
    } catch (err) {
      pinError.textContent = err.message;
    }
  });

  // 初期表示: PIN不要ならそのまま表示、必要なら記憶済みPINで試す
  if (!meta.staffPinRequired) {
    await loadHistory('');
  } else {
    const savedPin = sessionStorage.getItem(PIN_KEY);
    if (savedPin) {
      try {
        await loadHistory(savedPin);
        return;
      } catch (_) {
        sessionStorage.removeItem(PIN_KEY);
      }
    }
    pinForm.style.display = 'block';
  }
})();
