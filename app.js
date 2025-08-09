document.addEventListener('DOMContentLoaded', () => {
    // --- 要素取得 ---
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

    // --- グローバル変数 ---
    let chart;
    const HEADACHE_DATA_KEY = 'headacheData';
    let lastLocation = { latitude: 35.6895, longitude: 139.6917 };
    let currentPressureData = [];
    let currentTimeObjects = [];

    // --- 初期化 ---
    function initialize() {
        updateThemeIcons();
        setupEventListeners();
        thresholdValueSpan.textContent = `${thresholdSlider.value} hPa`;
        updateChart(lastLocation.latitude, lastLocation.longitude);
    }

    // --- イベントリスナー ---
    function setupEventListeners() {
        themeToggleButton.addEventListener('click', toggleTheme);
        headacheScoreSlider.addEventListener('input', () => { scoreValueSpan.textContent = headacheScoreSlider.value; });
        thresholdSlider.addEventListener('input', () => {
            thresholdValueSpan.textContent = `${thresholdSlider.value} hPa`;
            if (chart) updateChart(lastLocation.latitude, lastLocation.longitude);
        });
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

    // --- テーマ切替 ---
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

    // --- データとグラフ処理 ---
    async function updateChart(latitude, longitude) {
        lastLocation = { latitude, longitude };
        try {
            const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=pressure_msl,temperature_2m&forecast_days=3&timezone=auto`;
            const response = await fetch(apiUrl);
            const data = await response.json();
            
            currentTimeObjects = data.hourly.time.map(t => new Date(t));
            const labels = currentTimeObjects.map(t => `${t.getDate()}日${t.getHours()}時`);
            currentPressureData = data.hourly.pressure_msl;

            const threshold = parseFloat(thresholdSlider.value);
            const { riskLevels, nextHighRiskTime } = detectRiskZones(currentPressureData, currentTimeObjects, threshold);
            
            updateInsight(nextHighRiskTime, currentTimeObjects[0]);
            renderChart(labels, currentPressureData, getHeadacheData(), riskLevels, currentTimeObjects);

        } catch (error) {
            console.error('Error fetching or processing data:', error);
            alert('データの取得または処理に失敗しました。');
        }
    }

    // CHANGE: グラフデザインを更新
    function renderChart(labels, pressureData, headacheData, riskLevels, timeObjects) {
        const isDarkMode = document.documentElement.classList.contains('dark');
        const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
        const textColor = isDarkMode ? '#cbd5e1' : '#475569'; // slate-300, slate-600
        const pressureColor = 'rgb(79, 70, 229)'; // indigo-600
        const pressureBgColor = 'rgba(79, 70, 229, 0.1)';

        const headachePoints = headacheData.map(item => {
            const index = findClosestTimeIndex(new Date(item.time), timeObjects);
            return { x: index, y: pressureData[index], r: item.score * 3 + 3 };
        });

        const yMin = Math.floor(Math.min(...pressureData) - 2);
        const yMax = Math.ceil(Math.max(...pressureData) + 2);
        const mediumRiskBg = riskLevels.map(level => (level === 1 ? yMax : null));
        const highRiskBg = riskLevels.map(level => (level === 2 ? yMax : null));

        if (chart) chart.destroy();

        chart = new Chart(pressureCanvas, {
            type: 'bar',
            data: { labels, datasets: [
                { label: 'Medium Risk', data: mediumRiskBg, backgroundColor: 'rgba(255, 165, 0, 0.15)', barPercentage: 1.0, categoryPercentage: 1.0, order: 1 },
                { label: 'High Risk', data: highRiskBg, backgroundColor: 'rgba(239, 68, 68, 0.15)', barPercentage: 1.0, categoryPercentage: 1.0, order: 2 },
                { type: 'line', label: '気圧 (hPa)', data: pressureData, borderColor: pressureColor, backgroundColor: pressureBgColor, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 5, order: 3 },
                { type: 'bubble', label: '頭痛スコア', data: headachePoints, backgroundColor: 'rgba(239, 68, 68, 0.7)', borderColor: 'rgba(255,255,255,0.8)', borderWidth: 2, order: 4 }
            ]},
            options: { responsive: true, scales: {
                x: { type: 'category', grid: { display: false }, ticks: { color: textColor, maxRotation: 90, minRotation: 70, autoSkip: true, maxTicksLimit: 12 } },
                y: { min: yMin, max: yMax, title: { display: true, text: '気圧 (hPa)', color: textColor }, grid: { color: gridColor, drawBorder: false }, ticks: { color: textColor } }
            }, plugins: { tooltip: { 
                backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255,255,255,0.8)',
                titleColor: isDarkMode ? '#e2e8f0' : '#1e293b',
                bodyColor: isDarkMode ? '#e2e8f0' : '#1e293b',
                borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                borderWidth: 1,
                padding: 10,
                callbacks: {
                    title: (items) => `${timeObjects[items[0].dataIndex].toLocaleDateString('ja-JP')} ${items[0].label}`,
                    label: (ctx) => ctx.dataset.type === 'bubble' ? `頭痛レベル: ${(ctx.raw.r - 3) / 3}` : (ctx.dataset.type === 'line' ? `${ctx.dataset.label}: ${ctx.formattedValue} hPa` : null)
                }
            }, legend: { display: false }}, interaction: { intersect: false, mode: 'index' } }
        });
    }
    
    function detectRiskZones(pressures, times, threshold) {
        const riskLevels = new Array(times.length).fill(0);
        for (let i = 3; i < pressures.length; i++) if (pressures[i] - pressures[i - 3] <= threshold) for (let j = i - 3; j <= i; j++) riskLevels[j] = 2;
        for (let i = 23; i < pressures.length; i++) if (Math.max(...pressures.slice(i - 23, i + 1)) - Math.min(...pressures.slice(i - 23, i + 1)) >= 10) for (let j = i - 23; j <= i; j++) if (riskLevels[j] === 0) riskLevels[j] = 1;
        const now = new Date();
        const firstHighIndex = riskLevels.findIndex((level, i) => level === 2 && times[i] > now);
        const currentHourIndex = times.findIndex(t => t >= now) || 0;
        warningBanner.classList.toggle('hidden', riskLevels[currentHourIndex] !== 2);
        return { riskLevels, nextHighRiskTime: firstHighIndex > -1 ? times[firstHighIndex] : null };
    }

    function updateInsight(time, forecastStart) {
        if (time) {
            const format = d => `${d.getMonth()+1}/${d.getDate()}(${['日','月','火','水','木','金','土'][d.getDay()]}) ${d.getHours()}:00`;
            insightEl.textContent = `注意: 次の急激な気圧低下は ${format(time)} 頃の予測です。`;
            insightEl.style.color = '#ef4444'; // red-500
        } else {
            const hoursLeft = Math.round((forecastStart.getTime() + 72 * 3600 * 1000 - Date.now()) / 3600000);
            insightEl.textContent = `今後${hoursLeft}時間は急激な気圧低下の予測はありません。`;
            insightEl.style.color = '#22c55e'; // green-500
        }
    }

    // --- データ管理 ---
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