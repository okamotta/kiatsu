// app.js — 気圧×頭痛ログ（フル置換版）

(() => {
  // ========= DOM =========
  const cityInput = document.getElementById('city');
  const searchButton = document.getElementById('search');
  const getLocationButton = document.getElementById('getLocation');

  const canvasEl = document.getElementById('pressureChart');
  const insightEl = document.getElementById('insight');
  const riskStripEl = document.getElementById('riskStrip');

  // ドロワー（メニュー）
  const menuToggle = document.getElementById('menu-toggle');
  const menuClose = document.getElementById('menu-close');
  const menuOverlay = document.getElementById('menu-overlay');
  const menuDrawer = document.getElementById('menu-drawer');

  // しきい値スライダー
  const thresholdSlider = document.getElementById('thresholdSlider');
  const thresholdValue  = document.getElementById('thresholdValue');

  // 頭痛スコア
  const saveScoreButton = document.getElementById('saveScore');
  const scoreSlider     = document.getElementById('headacheScore');
  const scoreValue      = document.getElementById('scoreValue');

  // 履歴
  const historyListEl = document.getElementById('headacheHistoryList');

  // ========= 定数・状態 =========
  const HEADACHE_DATA_KEY = 'headacheData';
  const THRESH_24H_RANGE = 10; // 24h変動幅10hPa以上 → Medium
  let   THRESH_3H_DROP   = -6; // 3hで-6hPa以下 → High（UIから上書き）
  let   chartInstance = null;
  let   lastForecast = null; // { timeISO: string[], pressures: number[] }

  // ========= Utils =========
  const fmt = d => `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:00`;

  // ========= ストレージ系 =========
  function getHeadacheData() {
    try {
      return JSON.parse(localStorage.getItem(HEADACHE_DATA_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function setHeadacheData(arr) {
    localStorage.setItem(HEADACHE_DATA_KEY, JSON.stringify(arr));
  }

  // 保存 → 履歴更新 → グラフ即反映
  function saveHeadacheScore() {
    if (!scoreSlider) return;
    const score = parseInt(scoreSlider.value, 10);
    const data = getHeadacheData();
    data.unshift({ time: new Date().toISOString(), score });
    setHeadacheData(data);
    renderHistoryList();

    // 直近予報があれば、赤点を即反映
    if (lastForecast?.timeISO && lastForecast?.pressures) {
      renderChart(lastForecast.timeISO.map(t => new Date(t)), lastForecast.pressures);
    }
  }

  function renderHistoryList() {
    if (!historyListEl) return;
    const data = getHeadacheData();
    historyListEl.innerHTML = '';
    if (!data.length) {
      historyListEl.innerHTML = `<p class="text-slate-500 text-center text-sm">まだ記録がありません</p>`;
      return;
    }
    data.slice(0, 10).forEach(rec => {
      const d = new Date(rec.time);
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between p-2 rounded-lg';
      const hh = String(d.getHours()).padStart(2,'0');
      const mm = String(d.getMinutes()).padStart(2,'0');
      row.innerHTML = `<div><span class="font-semibold">${d.getMonth()+1}/${d.getDate()} ${hh}:${mm}</span> <span class="text-sm ml-2">スコア: <strong class="text-lg text-indigo-500">${rec.score}</strong></span></div>`;
      historyListEl.appendChild(row);
    });
  }

  // ========= データ取得 =========
  async function geocodeCity(name) {
    const url = `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(name)}&format=json&limit=1`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.length) throw new Error('都市が見つかりませんでした。');
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), label: data[0].display_name };
  }

  async function fetchForecast(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=pressure_msl&forecast_days=3&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    const timeISO = (data.hourly?.time || []).slice(0, 72);
    const pressures = (data.hourly?.pressure_msl || []).slice(0, 72).map(Number);
    if (!timeISO.length || timeISO.length !== pressures.length) {
      throw new Error('Invalid weather data');
    }
    return { timeISO, pressures };
  }

  // ========= 頭痛スコア点データ =========
  // 直近の予報期間に入るスコアを {x:Date, y:Number} に整形
  function getRecentScorePoints(timeISO) {
    const data = getHeadacheData();
    if (!timeISO?.length) return [];
    const start = new Date(timeISO[0]).getTime();
    const end   = new Date(timeISO[timeISO.length - 1]).getTime();
    return data
      .map(r => ({ t: new Date(r.time).getTime(), y: Number(r.score) }))
      .filter(p => p.t >= start && p.t <= end)
      .map(p => ({ x: new Date(p.t), y: p.y }));
  }

  // ========= 表示系 =========
  function renderChart(labels, pressures) {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (chartInstance) chartInstance.destroy();
  
    const scorePoints = getRecentScorePoints(lastForecast?.timeISO);
  
    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          // 気圧ライン（ふつうの配列データ）
          {
            label: '海面更正気圧 (hPa)',
            data: pressures,
            borderColor: 'rgb(79, 70, 229)',
            backgroundColor: 'rgba(79, 70, 229, 0.1)',
            tension: 0.35,
            pointRadius: 0,
            fill: true,
            yAxisID: 'y'
          },
          // 頭痛スコア（{x,y} の散布図）
          {
            type: 'scatter',
            label: '頭痛スコア',
            data: scorePoints,      // [{x:Date, y:Number}]
            parsing: false,         // ← 散布図だけに付ける！
            yAxisID: 'y1',
            pointRadius: 5,
            pointHoverRadius: 6,
            showLine: false,
            backgroundColor: 'rgb(239, 68, 68)',
            borderColor: 'rgb(239, 68, 68)'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        // ← ここに parsing:false は置かない！
        scales: {
          x: { type: 'time', time: { unit: 'hour', tooltipFormat: 'PPpp' } },
          y: {
            title: { display: true, text: '気圧 (hPa)' },
            // 必要なら表示レンジを軽く固定：
            // suggestedMin: 990, suggestedMax: 1035
          },
          y1: {
            position: 'right',
            min: 0, max: 5, ticks: { stepSize: 1 },
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'スコア' }
          }
        },
        plugins: {
          legend: { labels: { usePointStyle: true } },
          tooltip: { mode: 'nearest', intersect: false }
        }
      }
    });
  }

  function detectRiskZones(pressures, hoursISO) {
    const n = pressures.length;
    const levels = new Array(n).fill(0); // 0 Low, 1 Medium, 2 High

    // High: 3hで-6hPa（可変）
    for (let i = 3; i < n; i++) {
      if (pressures[i] - pressures[i-3] <= THRESH_3H_DROP) {
        for (let j = i-3; j <= i; j++) levels[j] = 2;
      }
    }
    // Medium: 24h変動幅 >= 10
    for (let i = 23; i < n; i++) {
      const w = pressures.slice(i-23, i+1);
      if (Math.max(...w) - Math.min(...w) >= THRESH_24H_RANGE) {
        for (let j = i-23; j <= i; j++) if (levels[j] === 0) levels[j] = 1;
      }
    }

    // 次のHigh
    const now = Date.now();
    let nextHigh = null;
    for (let i = 0; i < n; i++) {
      if (levels[i] === 2 && new Date(hoursISO[i]).getTime() > now) {
        nextHigh = hoursISO[i];
        break;
      }
    }

    return { levels, nextHigh };
  }

  function renderRiskStrip(levels, hoursISO) {
    if (!riskStripEl) return;
    riskStripEl.innerHTML = '';
    levels.forEach((lv, i) => {
      const div = document.createElement('div');
      const tickClass = (i % 6 === 0) ? ' risk-tick-left' : '';
      div.className = `risk-cell ${lv===2?'risk-high':lv===1?'risk-med':'risk-low'}${tickClass}`;
      div.title = `${fmt(new Date(hoursISO[i]))} — ${['Low','Medium','High'][lv]}`;
      riskStripEl.appendChild(div);
    });
  }

  function composeInsight(hoursISO, pressures, nextHighISO) {
    if (!insightEl) return;
    const last24 = pressures.slice(0, 24);
    const range24 = last24.length ? (Math.max(...last24) - Math.min(...last24)) : 0;
    const dp3 = pressures.length >= 4 ? (pressures[3] - pressures[0]) : 0;

    const currentRisk = (dp3 <= THRESH_3H_DROP) ? 'High'
                      : (range24 >= THRESH_24H_RANGE) ? 'Medium'
                      : 'Low';

    const fmtHM = d => `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:00`;

    if (nextHighISO) {
      const when = new Date(nextHighISO);
      insightEl.innerHTML =
        `現在リスク：<b>${currentRisk}</b><br>` +
        `次のHigh：<b>${fmtHM(when)}</b><br>` +
        `24h変動幅：<b>${range24.toFixed(1)} hPa</b> / 3h変化：<b>${dp3.toFixed(1)} hPa</b>`;
    } else {
      insightEl.innerHTML =
        `現在リスク：<b>${currentRisk}</b><br>` +
        `次のHigh：<b>なし（72時間以内）</b><br>` +
        `24h変動幅：<b>${range24.toFixed(1)} hPa</b> / 3h変化：<b>${dp3.toFixed(1)} hPa</b>`;
    }
  }

  // ========= メイン更新 =========
  async function updateChart(lat, lon, label='') {
    if (insightEl) insightEl.textContent = `${label || 'データ'}を読み込み中…`;
    try {
      const { timeISO, pressures } = await fetchForecast(lat, lon);
      lastForecast = { timeISO, pressures };

      renderChart(timeISO.map(t => new Date(t)), pressures);

      const { levels, nextHigh } = detectRiskZones(pressures, timeISO);
      renderRiskStrip(levels, timeISO);
      composeInsight(timeISO, pressures, nextHigh);
    } catch (e) {
      console.error('Failed to update chart:', e);
      if (insightEl) insightEl.textContent = `エラー: ${e.message}`;
    }
  }

  // ========= イベント =========
  function openMenu() {
    if (!menuDrawer || !menuOverlay) return;
    menuDrawer.classList.remove('translate-x-full');
    menuOverlay.classList.remove('hidden');
  }
  function closeMenu() {
    if (!menuDrawer || !menuOverlay) return;
    menuDrawer.classList.add('translate-x-full');
    menuOverlay.classList.add('hidden');
  }

  function setupEventListeners() {
    // メニュー
    if (menuToggle) menuToggle.addEventListener('click', openMenu);
    if (menuClose)  menuClose.addEventListener('click', closeMenu);
    if (menuOverlay) menuOverlay.addEventListener('click', closeMenu);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
    const clearAllBtn = document.getElementById('clearAll');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => {
        if (confirm('保存されている頭痛の全記録を削除します。よろしいですか？')) {
          clearAllHeadacheData();
        }
      });
    }

    // しきい値
    if (thresholdSlider) {
      if (thresholdValue) thresholdValue.textContent = `${thresholdSlider.value} hPa`;
      THRESH_3H_DROP = parseFloat(thresholdSlider.value);
      thresholdSlider.addEventListener('input', () => {
        THRESH_3H_DROP = parseFloat(thresholdSlider.value);
        if (thresholdValue) thresholdValue.textContent = `${thresholdSlider.value} hPa`;
        // 直近データがあれば再評価
        if (lastForecast && lastForecast.timeISO && lastForecast.pressures) {
          try {
            const { levels, nextHigh } = detectRiskZones(lastForecast.pressures, lastForecast.timeISO);
            renderRiskStrip(levels, lastForecast.timeISO);
            composeInsight(lastForecast.timeISO, lastForecast.pressures, nextHigh);
            // スコア点はそのままでもOK（しきい値は影響しない）
          } catch (e) { console.warn('threshold re-eval failed', e); }
        }
      });
    }

    // 頭痛スコアUI
    if (scoreSlider && scoreValue) {
      scoreValue.textContent = String(scoreSlider.value);
      scoreSlider.addEventListener('input', (e) => {
        scoreValue.textContent = String(e.target.value);
      });
    }
    if (saveScoreButton) {
      saveScoreButton.addEventListener('click', saveHeadacheScore);
    }
    
    function clearAllHeadacheData() {
      // 全削除
      localStorage.removeItem(HEADACHE_DATA_KEY);
      renderHistoryList();
    
      // もしグラフに「頭痛スコア」の赤点データセットを出しているなら取り除く
      if (chartInstance && chartInstance.data && Array.isArray(chartInstance.data.datasets)) {
        const idx = chartInstance.data.datasets.findIndex(
          ds => ds.label === '頭痛スコア' || ds.yAxisID === 'y1'
        );
        if (idx > -1) {
          chartInstance.data.datasets.splice(idx, 1);
          chartInstance.update();
        }
      }
    }

    // 検索
    if (searchButton && cityInput) {
      searchButton.addEventListener('click', async () => {
        const name = cityInput.value.trim();
        if (!name) return;
        try {
          const { lat, lon, label } = await geocodeCity(name);
          updateChart(lat, lon, label);
        } catch (e) {
          alert(e.message);
        }
      });
      cityInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') searchButton.click();
      });
    }

    // 現在地
    if (getLocationButton) {
      getLocationButton.addEventListener('click', () => {
        if (!navigator.geolocation) return alert('位置情報が使えない環境です');
        navigator.geolocation.getCurrentPosition(
          pos => updateChart(pos.coords.latitude, pos.coords.longitude, '現在地'),
          () => alert('現在地の取得に失敗しました。'),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    }
  }

  // ========= 初期化 =========
  function boot() {
    renderHistoryList();
    setupEventListeners();

    // 初期表示：現在地 → 失敗で東京
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => updateChart(p.coords.latitude, p.coords.longitude, '現在地'),
        () => updateChart(35.6895, 139.6917, '東京')
      );
    } else {
      updateChart(35.6895, 139.6917, '東京');
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();