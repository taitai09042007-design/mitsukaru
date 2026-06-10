// 拾得物登録ページ: 撮影 → エッジAI解析 → 登録
(async () => {
  const { $, esc, fetchJSON, loadMeta, fillCategorySelect, fillColorSelect, toast, colorLabel } = App;
  const meta = await loadMeta();

  const video = $('#video');
  const canvas = $('#capture-canvas');
  const placeholder = $('#camera-placeholder');
  const startCameraBtn = $('#start-camera-btn');
  const shootBtn = $('#shoot-btn');
  const retakeBtn = $('#retake-btn');
  const fileInput = $('#file-input');
  const aiResult = $('#ai-result');
  const aiStatus = $('#ai-status');
  const aiChips = $('#ai-chips');
  const form = $('#register-form');
  const doneCard = $('#done-card');

  const categorySelect = $('#category-select');
  const colorSelect = $('#color-select');
  const storageSelect = $('#storage-select');

  fillCategorySelect(categorySelect, meta, true);
  fillColorSelect(colorSelect, meta);
  storageSelect.innerHTML = meta.storagePlaces
    .map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join('');

  let stream = null;
  let aiTags = [];
  let hasImage = false;

  // AIモデルを裏で先読みしておく(体感速度アップ)
  AiTagger.loadModel().catch(() => {});

  function setStep(n) {
    for (let i = 1; i <= 3; i++) {
      $(`#step${i}`).classList.toggle('active', i <= n);
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    video.style.display = 'none';
  }

  // --- カメラ起動 ---
  startCameraBtn.addEventListener('click', async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 } },
        audio: false,
      });
      video.srcObject = stream;
      video.style.display = 'block';
      canvas.style.display = 'none';
      placeholder.style.display = 'none';
      startCameraBtn.style.display = 'none';
      shootBtn.style.display = 'inline-flex';
      retakeBtn.style.display = 'none';
    } catch (err) {
      toast('カメラを起動できませんでした。「写真をえらぶ」を使ってください');
    }
  });

  // --- 撮影 ---
  shootBtn.addEventListener('click', () => {
    drawToCanvas(video, video.videoWidth, video.videoHeight);
    stopCamera();
    shootBtn.style.display = 'none';
    retakeBtn.style.display = 'inline-flex';
    runAnalysis();
  });

  retakeBtn.addEventListener('click', () => {
    canvas.style.display = 'none';
    placeholder.style.display = 'block';
    startCameraBtn.style.display = 'inline-flex';
    retakeBtn.style.display = 'none';
    aiResult.style.display = 'none';
    form.style.display = 'none';
    hasImage = false;
    setStep(1);
  });

  // --- ファイル選択 ---
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      drawToCanvas(img, img.naturalWidth, img.naturalHeight);
      stopCamera();
      startCameraBtn.style.display = 'inline-flex';
      shootBtn.style.display = 'none';
      retakeBtn.style.display = 'none';
      URL.revokeObjectURL(img.src);
      runAnalysis();
    };
    img.src = URL.createObjectURL(file);
  });

  // 長辺を最大960pxに縮小して canvas に描画(解析・アップロードを軽くする)
  function drawToCanvas(source, srcW, srcH) {
    const maxSide = 960;
    const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
    canvas.width = Math.round(srcW * scale);
    canvas.height = Math.round(srcH * scale);
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
    canvas.style.display = 'block';
    placeholder.style.display = 'none';
    hasImage = true;
  }

  // --- エッジAI解析 ---
  async function runAnalysis() {
    setStep(2);
    aiResult.style.display = 'block';
    aiChips.innerHTML = '';
    aiStatus.innerHTML = '<span class="spinner"></span> AIが解析中…(ブラウザの中だけで処理しています)';
    form.style.display = 'none';

    const { best, color, tags } = await AiTagger.analyze(canvas);
    aiTags = tags;

    const chips = [];
    if (best) {
      const categoryId = meta.cocoToCategory[best.class];
      if (categoryId) categorySelect.value = categoryId;
      chips.push(`<span class="chip">🤖 ${esc(AiTagger.jpLabel(best.class))} (${Math.round(best.score * 100)}%)</span>`);
    }
    if (color) {
      colorSelect.value = color;
      chips.push(`<span class="chip">${App.colorDot(color)} ${esc(colorLabel(meta, color))}</span>`);
    }

    if (best || color) {
      aiStatus.innerHTML = '✨ AIの判定結果(まちがっていたら下のフォームで直せます)';
    } else {
      aiStatus.innerHTML = '🤔 AIでは判定できませんでした。下のフォームで選んでください';
    }
    aiChips.innerHTML = chips.join('');
    form.style.display = 'block';
    setStep(3);
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // --- 登録 ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!hasImage) {
      toast('先に写真を撮ってください');
      return;
    }
    if (!categorySelect.value) {
      toast('カテゴリを選んでください');
      return;
    }

    const submitBtn = $('#submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = '登録中…';

    try {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      const fd = new FormData();
      fd.append('image', blob, 'item.jpg');
      fd.append('category', categorySelect.value);
      fd.append('color', colorSelect.value);
      fd.append('tags', JSON.stringify(aiTags));
      fd.append('description', $('#description-input').value);
      fd.append('locationFound', $('#location-input').value);
      fd.append('storagePlace', storageSelect.value);
      fd.append('reporterName', $('#reporter-input').value);

      const data = await fetchJSON('/api/found', { method: 'POST', body: fd });

      $('#capture-card').style.display = 'none';
      aiResult.style.display = 'none';
      form.style.display = 'none';
      doneCard.style.display = 'block';
      $('#done-message').textContent = data.notified > 0
        ? `この落とし物を探していた ${data.notified} 人に、たった今お知らせが届きました!`
        : `実物は「${storageSelect.value}」にとどけてください。持ち主が検索したら見つかります。`;
    } catch (err) {
      toast(err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '🧺 とどける(登録する)';
    }
  });

  // --- つづけて登録 ---
  $('#another-btn').addEventListener('click', () => {
    doneCard.style.display = 'none';
    $('#capture-card').style.display = 'block';
    canvas.style.display = 'none';
    placeholder.style.display = 'block';
    startCameraBtn.style.display = 'inline-flex';
    retakeBtn.style.display = 'none';
    form.reset();
    fillCategorySelect(categorySelect, meta, true);
    hasImage = false;
    aiTags = [];
    setStep(1);
  });
})();
