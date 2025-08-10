症状
	•	画面は出るが Chart.js のグラフが表示されない（真っ白）。

期待する状態
	•	pressureChart に 72hの気圧折れ線グラフが表示される。
	•	Console にエラーが出ない。
	•	リスクストリップ/insight更新まで動く。

原因候補（優先度順）
	1.	時間軸アダプタ未登録または読み込み不一致
	•	chartjs-adapter-date-fns は bundle版を使用（date-fns同梱）。
	2.	ID不一致
	•	canvas は id=pressureChart。app.js でも同じIDを参照すること。
	3.	データ型/長さ不一致
	•	labels は Date[]、datasets[0].data は number[]、それぞれ同じ長さ。
	4.	描画前にエラーで落ちている
	•	try/catch＋ログで特定する。
	5.	SWの絶対パスでエラー（副作用）
	•	GitHub Pages では navigator.serviceWorker.register('./sw.js') に直す。

変更内容（やることリスト）
	1.	index.html

	•	<head> のアダプタscriptはbundle版に固定（CDN最新でOKだが明示）。
	•	SW 登録パスを相対に変更。

	2.	app.js（防御的な修正）

	•	DOM取得のIDを必ず現状HTMLに合わせる：
	•	const ctx = document.getElementById('pressureChart').getContext('2d')
	•	環境テスト用のミニグラフを最初に一度描画（5点だけ）
	•	これが出れば Chart.js＆アダプタ＆DOM はOK＝以降はデータ側の問題
	•	72hフェッチ後：
	•	const labels = data.hourly.time.slice(0,72).map(t => new Date(t));
	•	const pressures = data.hourly.pressure_msl.slice(0,72).map(Number);
	•	長さ一致チェックで不一致なら例外throw
	•	renderChart は try { … } catch(e){ console.error('renderChart', e); } を付ける
	•	既存チャートは if (chart) chart.destroy(); してから作り直し
	•	scales.x.type='time' を明示、parsing:false は不要（labels+number配列構成のため）
	•	fetch直後に 3サンプルを console.log（time/pressure）

	3.	ログ

	•	失敗時は エラーメッセージを1行で出す（「adapter未読込」「ID不一致」「データ長不一致」など原因特定用）

差分パッチ（適用イメージ）

index.html

- <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns"></script>
+ <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns/dist/chartjs-adapter-date-fns.bundle.min.js"></script>

- navigator.serviceWorker.register('/sw.js')
+ navigator.serviceWorker.register('./sw.js')

app.js（抜粋・追加）
+ // 環境テスト: Chart.jsが描けるか5点で確認
+ function renderSmokeTest() {
+   try {
+     const c = document.getElementById('pressureChart');
+     if (!c) throw new Error('#pressureChart not found');
+     const cx = c.getContext('2d');
+     const smoke = new Chart(cx, {
+       type: 'line',
+       data: {
+         labels: [0,1,2,3,4],
+         datasets: [{ label:'SMOKE', data:[1010,1011,1012,1011,1013], pointRadius:0 }]
+       },
+       options: { responsive:true, animation:false }
+     });
+     setTimeout(()=>{ smoke.destroy(); }, 300); // すぐ破棄（存在確認だけ）
+   } catch(e) { console.error('smokeTest fail:', e); }
+ }
+ renderSmokeTest();

- const ctx = document.getElementById('pressureChart').getContext('2d');
+ const canvasEl = document.getElementById('pressureChart');
+ if (!canvasEl) { console.error('Canvas #pressureChart missing'); }
+ const ctx = canvasEl ? canvasEl.getContext('2d') : null;

  async function fetchWeatherData(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=pressure_msl,temperature_2m&forecast_days=3&timezone=auto`;
    const res = await fetch(url);
    const data = await res.json();
+   console.log('samples',
+     data?.hourly?.time?.slice(0,3),
+     data?.hourly?.pressure_msl?.slice(0,3)
+   );
-   const labels = data.hourly.time.slice(0,48);
-   const pressures = data.hourly.pressure_msl.slice(0,48);
+   const labels = (data.hourly.time || []).slice(0,72).map(t => new Date(t));
+   const pressures = (data.hourly.pressure_msl || []).slice(0,72).map(Number);
+   if (labels.length !== pressures.length) {
+     throw new Error('length mismatch labels='+labels.length+' pressures='+pressures.length);
+   }
    updateChart(labels, pressures, scores);
  }

- function updateChart(labels, pressures, scores) {
+ function updateChart(labels, pressures, scores) {
+   if (!ctx) { console.error('no ctx'); return; }
    if (pressureChart) pressureChart.destroy();
    try {
      pressureChart = new Chart(ctx, {
        type:'line',
        data:{ labels, datasets:[{ label:'海面更正気圧 (hPa)', data:pressures, pointRadius:0, tension:0.25 }] },
        options:{
          responsive:true,
          scales:{
-           x:{ type:'time' },
+           x:{ type:'time', time:{ unit:'hour' } },
            y:{ type:'linear', position:'left' }
          }
        }
      });
    } catch(e) {
      console.error('renderChart error:', e);
    }
  }

  検証手順
	•	ページを開く → Console で エラーが無いこと
	•	「smokeTest」で一瞬描画→破棄されるログが出る（出なければ DOM/アダプタ問題）
	•	Tokyo を検索 → samples ログに time/pressure が出る
	•	グラフが描画される
	•	失敗した場合：Console の最後のエラーを表示

制約
	•	既存のID/ボタン動作を壊さない（#search, #getLocation, #pressureChart, #insight など）
	•	追加ライブラリ禁止（Chart.js と date-fns アダプタのみ）
	•	デバッグ用ログは残してOK（後で削除可）

出力フォーマット（必須）
	1.	手順（箇条書き）
	2.	index.html / app.js の差分パッチ
	3.	検証チェックリスト
	4.	うまくいかない場合の追加ログの出し方（例：console.error箇所）