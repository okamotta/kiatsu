document.addEventListener('DOMContentLoaded', () => {
    // --- 要素取得 (変更なし) ---
    const cityInput = document.getElementById('city');
    const searchButton = document.getElementById('search');
    const getLocationButton = document.getElementById('getLocation');
    const pressureCanvas = document.getElementById('pressureChart');
    const headacheScoreSlider = document.getElementById('headacheScore');
    const scoreValueSpan = document.getElementById('scoreValue');
    const saveScoreButton = document.getElementById('saveScore');
    const warningBanner = document.getElementById('warningBanner');
    const thresholdSlider = document.getElementById('thresholdSlider');
    const thresholdValueSpan = document.getElementById('thresholdValue');
    const insightEl = document.getElementById('insight');
    const themeToggleButton = document.getElementById('theme-toggle');
    const darkIcon = document.getElementById('theme-toggle-dark-icon');
    const lightIcon = document.getElementById('theme-toggle-light-icon');
    const exportCsvButton = document.getElementById('exportCsv');

    // --- グローバル変数 (変更なし) ---
    let chart;
    const HEADACHE_DATA_KEY = 'headacheData';
    let lastLocation = { latitude: 35.6895, longitude: 139.6917 };
    let currentPressureData = [];
    let currentTimeObjects = [];

    // --- ここから挿入 ---
    const THRESH_3H_DROP = -6;
    const THRESH_24H_RANGE = 10;
    const fmt = d => `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:00`;
    // --- ここまで挿入 ---

    // --- 初期化 (変更なし) ---
    function initialize() {
        updateThemeIcons();
        setupEventListeners();
        thresholdValueSpan.textContent = `${thresholdSlider.value} hPa`;
        updateChart(lastLocation.latitude, lastLocation.longitude);
    }

    // --- イベントリスナー設定 (thresholdSliderのイベントを削除) ---
    function setupEventListeners() {
        themeToggleButton.addEventListener('click', toggleTheme);
        headacheScoreSlider.addEventListener('input', () => { scoreValueSpan.textContent = headacheScoreSlider.value; });
        // thresholdSlider.addEventListener('input', () => { // このイベントは新しい仕様では不要
        //     thresholdValueSpan.textContent = `${thresholdSlider.value} hPa`;
        //     if (chart) updateChart(lastLocation.latitude, lastLocation.longitude);
        // });
        searchButton.addEventListener('click', () => { if (cityInput.value) geocodeCity(cityInput.value); });
        getLocationButton.addEventListener('click', () => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(pos => updateChart(pos.coords.latitude, pos.coords.longitude), () => alert('現在地の取得に失敗しました。'));
            } else {
                alert('お使いのブラウザは位置情報取得に対応していません。');
            }
        });
        saveScoreButton.addEventListener('click', saveHeadacheScore);
        exportCsvButton.addEventListener('click', exportDataToCsv);
    }

    // --- テーマ切替 (変更なし) ---
    function updateThemeIcons() {
        if (document.documentElement.classList.contains('dark')) {
            darkIcon.classList.remove('hidden');
            lightIcon.classList.add('hidden');
        } else {
            darkIcon.classList.add('hidden');
            lightIcon.classList.remove('hidden');
        }
    }
    function toggleTheme() {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updateThemeIcons();
        if (chart) updateChart(lastLocation.latitude, lastLocation.longitude);
    }

    // --- データとグラフ処理 (ここから大幅に変更) ---
    async function updateChart(latitude, longitude) {
        lastLocation = { latitude, longitude };
        try {
            const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=pressure_msl,temperature_2m&forecast_days=3&timezone=auto`;
            const response = await fetch(apiUrl);
            const data = await response.json();
            
            // 72時間にスライス
            const timeStrs = data.hourly.time.slice(0, 72);
            currentTimeObjects = timeStrs.map(t => new Date(t));
            currentPressureData = data.hourly.pressure_msl.slice(0, 72);
            const labels = currentTimeObjects.map(t => `${t.getDate()}日${t.getHours()}時`);

            // グラフ描画（リスク表示は分離）
            renderChart(labels, currentPressureData, getHeadacheData(), currentTimeObjects);
            
            // リスク判定とUI更新
            const { riskLevels, nextHigh } = detectRiskZones(currentPressureData, timeStrs);
            renderRiskStrip(riskLevels, timeStrs);
            insightEl.textContent = nextHigh
              ? `⚠️ 次のHighは ${fmt(new Date(nextHigh))} 頃`
              : '🙂 今後72時間に急降下の予測なし';

        } catch (error) {
            console.error('Error fetching or processing data:', error);
            alert('データの取得または処理に失敗しました。');
        }
    }

    // --- グラフ描画 (リスク背景色を削除) ---
    function renderChart(labels, pressureData, headacheData, timeObjects) {
        const isDarkMode = document.documentElement.classList.contains('dark');
        const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
        const textColor = isDarkMode ? '#cbd5e1' : '#475569';
        const pressureColor = 'rgb(79, 70, 229)';
        const pressureBgColor = 'rgba(79, 70, 229, 0.1)';

        const headachePoints = headacheData.map(item => {
            const index = findClosestTimeIndex(new Date(item.time), timeObjects);
            return { x: index, y: pressureData[index], r: item.score * 3 + 3 };
        });

        if (chart) chart.destroy();

        chart = new Chart(pressureCanvas, {
            type: 'line', // 背景バーが不要になったのでlineに
            data: { labels, datasets: [
                { 
                    label: '気圧 (hPa)', 
                    data: pressureData, 
                    borderColor: pressureColor, 
                    backgroundColor: pressureBgColor, 
                    fill: true, 
                    tension: 0.4, 
                    pointRadius: 0, 
                    pointHoverRadius: 5 
                },
                {
                    type: 'bubble', 
                    label: '頭痛スコア', 
                    data: headachePoints, 
                    backgroundColor: 'rgba(239, 68, 68, 0.7)', 
                    borderColor: 'rgba(255,255,255,0.8)', 
                    borderWidth: 2 
                }
            ]},
            options: { responsive: true, scales: {
                x: { type: 'category', grid: { display: false }, ticks: { color: textColor, maxRotation: 90, minRotation: 70, autoSkip: true, maxTicksLimit: 12 } },
                y: { title: { display: true, text: '気圧 (hPa)', color: textColor }, grid: { color: gridColor, drawBorder: false }, ticks: { color: textColor } }
            }, plugins: { tooltip: { 
                backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255,255,255,0.8)',
                titleColor: isDarkMode ? '#e2e8f0' : '#1e293b',
                bodyColor: isDarkMode ? '#e2e8f0' : '#1e293b',
                borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                borderWidth: 1,
                padding: 10,
                callbacks: {
                    title: (items) => `${timeObjects[items[0].dataIndex].toLocaleDateString('ja-JP')} ${items[0].label}`,
                    label: (ctx) => ctx.dataset.type === 'bubble' ? `頭痛レベル: ${(ctx.raw.r - 3) / 3}` : `${ctx.dataset.label}: ${ctx.formattedValue} hPa`
                }
            }, legend: { display: false }}, interaction: { intersect: false, mode: 'index' } }
        });
    }
    
    // --- ここから関数を置き換え/追加 ---

    // (既存のdetectRiskZonesとupdateInsightは削除)

    function detectRiskZones(pressures, hourStrs){
      const n = pressures.length;
      const levels = new Array(n).fill(0); // 0:Low 1:Med 2:High
      
      // Highリスク判定
      for(let i=3; i<n; i++){
        if (pressures[i] - pressures[i-3] <= THRESH_3H_DROP){
          for(let j=i-3; j<=i; j++) levels[j] = 2;
        }
      }
      // Mediumリスク判定
      for(let i=23; i<n; i++){
        const w = pressures.slice(i-23, i+1);
        if (Math.max(...w) - Math.min(...w) >= THRESH_24H_RANGE){
          for(let j=i-23; j<=i; j++) if (levels[j]===0) levels[j] = 1;
        }
      }
      
      const now = Date.now();
      let nextHigh = null;
      for (let i=0; i<n; i++){
        if (levels[i]===2 && new Date(hourStrs[i]).getTime() > now){
          nextHigh = hourStrs[i];
          break;
        }
      }
      // バナー表示はHighリスクがある場合のみ
      warningBanner.classList.toggle('hidden', !nextHigh);
      return { riskLevels: levels, nextHigh };
    }

    function renderRiskStrip(levels, hourStrs){
      const strip = document.getElementById('riskStrip');
      if (!strip) return;
      strip.innerHTML = '';
      levels.forEach((lv, i) => {
        const div = document.createElement('div');
        const tickClass = (new Date(hourStrs[i]).getHours()) % 6 === 0 ? ' risk-tick' : '';
        div.className = `risk-cell risk-${lv===2?'high':lv===1?'med':'low'}${tickClass}`;
        div.title = `${fmt(new Date(hourStrs[i]))} — ${['Low','Medium','High'][lv]}`;
        strip.appendChild(div);
      });
    }

    // --- データ管理 (変更なし) ---
    function getHeadacheData() { return JSON.parse(localStorage.getItem(HEADACHE_DATA_KEY)) || []; }
    function saveHeadacheScore() {
        const headacheData = getHeadacheData();
        headacheData.push({ time: new Date().toISOString(), score: parseInt(headacheScoreSlider.value, 10) });
        localStorage.setItem(HEADACHE_DATA_KEY, JSON.stringify(headacheData));
        updateChart(lastLocation.latitude, lastLocation.longitude);
    }
    function findClosestTimeIndex(time, timeObjects) {
        const timeMs = time.getTime();
        let closestIndex = 0, minDiff = Infinity;
        timeObjects.forEach((t, index) => {
            const diff = Math.abs(t.getTime() - timeMs);
            if (diff < minDiff) { minDiff = diff; closestIndex = index; }
        });
        return closestIndex;
    }
    function exportDataToCsv() {
        const headacheData = getHeadacheData();
        if (headacheData.length === 0) { alert('エクスポートする頭痛データがありません。'); return; }
        if (currentPressureData.length === 0) { alert('気圧データがまだ読み込まれていません。'); return; }
        const header = ['日時', '気圧(hPa)', '頭痛スコア'];
        const rows = headacheData.map(log => {
            const logTime = new Date(log.time);
            const closestIndex = findClosestTimeIndex(logTime, currentTimeObjects);
            const pressure = currentPressureData[closestIndex].toFixed(2);
            const formattedTime = logTime.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
            return [formattedTime, pressure, log.score];
        });
        const csvContent = [header, ...rows].map(e => `"${e.join('","')}"`).join("\n");
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "zutsu-log.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    async function geocodeCity(city) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?city=${city}&format=json&limit=1`);
            const data = await response.json();
            if (data.length > 0) updateChart(parseFloat(data[0].lat), parseFloat(data[0].lon));
            else alert('都市が見つかりませんでした。');
        } catch (error) {
            console.error('Error geocoding city:', error);
            alert('都市の検索中にエラーが発生しました。');
        }
    }

    initialize();
});