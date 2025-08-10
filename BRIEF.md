# 目的
既存の気圧MVP（index.html + app.js）に「雨アプリ風UIでの頭痛リスク可視化」を追加したい。
72時間予報から「いつ頭が痛くなる可能性が高いか」を時間帯バーで表示する。

# 変更対象
- index.html（HTML/CSSの追加と、Chart.js日付アダプタの読み込み）
- app.js（72h予報取得・リスク判定・UI更新ロジック追加）

# 現状の前提
- 都市検索(ID: city)・ボタン(searchBtn, geoBtn)
- グラフcanvas(ID: chart)・インサイト表示(ID: insight)
- Chart.jsはCDNで読み込み済み
- （重要）既存IDは変更しないこと

# 実装ステップ
1. **dateアダプタの追加**
   - index.html の `<head>` に以下を追加：
     `<script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns"></script>`

2. **リスクストリップUIの追加（index.html）**
   - グラフ `<canvas id="chart">` の直後に以下のブロックを追加：
     ```html
     <div id="riskPanel" style="margin-top:12px">
       <div style="font-size:12px;opacity:.7;margin-bottom:6px;">これから72時間の頭痛リスク</div>
       <div id="riskStrip" class="risk-strip"></div>
       <div id="riskLegend" style="display:flex;gap:8px;margin-top:6px;font-size:12px;opacity:.7;">
         <span>🟥 High（急降下）</span><span>🟨 Medium（大きい変動）</span><span>🟩 Low</span>
       </div>
     </div>
     ```
   - `<style>` に下記を追加（Tailwind不使用の軽量CSS）：
     ```css
     .risk-strip{ display:grid; grid-template-columns: repeat(72,1fr);
                  height:36px; border-radius:8px; overflow:hidden; background:#eee; }
     .risk-cell{ height:100%; }
     .risk-low{  background:#c6f6d5; }  /* 緑 */
     .risk-med{  background:#fde68a; }  /* 黄 */
     .risk-high{ background:#fecaca; }  /* 赤 */
     .risk-tick{ border-right:1px solid rgba(0,0,0,.06); }
     ```

3. **72h予報へ拡張（app.js）**
   - 既存の取得処理を、Open-Meteo /forecast で **72時間** 取るようにする。
     - `hourly=pressure_msl,temperature_2m&forecast_days=3&timezone=auto`
   - 取得後の配列は **先頭から72要素** を使う（`slice(0,72)`）。

4. **リスク判定の実装（app.js）**
   - しきい値（定数）：
     - `THRESH_3H_DROP = -6`（High: 3時間で-6hPa以下）
     - `THRESH_24H_RANGE = 10`（Medium: 24時間の変動幅が10hPa以上）
   - アルゴリズム：
     - `High`: `p[i] - p[i-3] <= -6` を満たすウィンドウ i-3..i を High=2 でマーキング
     - `Medium`: 24h窓(i-23..i)の`max-min >= 10` かつ未マーキングなら Medium=1
     - その他は Low=0
   - 次のHigh開始時刻（未来）の最初のindexを見つけ、ISOや表示用文字列に整形。

5. **UI更新（app.js）**
   - `renderRiskStrip(levels, hours)` を実装し、`#riskStrip` に 72 個のdivを生成：
     - `risk-cell risk-<low|med|high> risk-tick` を付与
     - `title` 属性に `MM/DD HH:00 — Low/Medium/High` を入れる
   - `#insight` には：
     - Highがあれば：`⚠️ 次のHighは <時刻> 頃`
     - 無ければ：`🙂 今後72時間に急降下の予測なし`

6. **既存グラフとの連携（app.js）**
   - 既存 `renderChart(hours, pressures, temps)` 呼び出しの直後に
     `detectRiskZones -> renderRiskStrip -> insight更新` を追加する。
   - 既存の都市検索/現在地ボタンの挙動は維持すること。
   - 既存の LocalStorage スコアや他機能を壊さない。

# 具体コード（app.jsに追記/変更する断片）
- 先頭付近に定数とフォーマッタ
  ```js
  const THRESH_3H_DROP = -6;
  const THRESH_24H_RANGE = 10;
  const fmt = d => `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:00`;

  	•	取得後の72hスライス＆リスク更新（既存ロード関数内を差し替え）
    const data = await fetchPressure(lat, lon);
const hours = data.hourly.time.slice(0,72);
const pressures = data.hourly.pressure_msl.slice(0,72);
const temps = data.hourly.temperature_2m.slice(0,72);
renderChart(hours, pressures, temps);
const { riskLevels, nextHigh } = detectRiskZones(pressures, hours);
renderRiskStrip(riskLevels, hours);
insightEl.textContent = nextHigh
  ? `⚠️ 次のHighは ${fmt(new Date(nextHigh))} 頃`
  : '🙂 今後72時間に急降下の予測なし';

  	•	リスク判定
    function detectRiskZones(pressures, hourStrs){
  const n = pressures.length;
  const levels = new Array(n).fill(0); // 0:Low 1:Med 2:High
  const times = hourStrs.map(h => new Date(h));

  for(let i=3;i<n;i++){
    if (pressures[i] - pressures[i-3] <= THRESH_3H_DROP){
      for(let j=i-3;j<=i;j++) levels[j] = 2;
    }
  }
  for(let i=23;i<n;i++){
    const w = pressures.slice(i-23,i+1);
    if (Math.max(...w) - Math.min(...w) >= THRESH_24H_RANGE){
      for(let j=i-23;j<=i;j++) if (levels[j]===0) levels[j] = 1;
    }
  }
  const now = Date.now();
  let nextHigh = null;
  for (let i=0;i<n;i++){
    if (levels[i]===2 && new Date(hourStrs[i]).getTime() > now){ nextHigh = hourStrs[i]; break; }
  }
  return { riskLevels: levels, nextHigh };
}

	•	リスクストリップ描画
    function renderRiskStrip(levels, hourStrs){
  const strip = document.getElementById('riskStrip');
  if (!strip) return;
  strip.innerHTML = '';
  levels.forEach((lv, i) => {
    const div = document.createElement('div');
    div.className = `risk-cell risk-${lv===2?'high':lv===1?'med':'low'} risk-tick`;
    div.title = `${fmt(new Date(hourStrs[i]))} — ${['Low','Medium','High'][lv]}`;
    strip.appendChild(div);
  });
}

制約（守ってほしいこと）
	•	IDや既存関数名の大規模リネーム禁止（city / searchBtn / geoBtn / chart / insight など）
	•	追加ライブラリ禁止（Chart.jsとdate-fnsアダプタのみCDNで可）
	•	既存機能（検索・現在地・グラフ・インサイト簡易文）は壊さない
	•	プラグイン不要。背景ハイライトは今回「リスクストリップ」で実現する

出力フォーマット
	1.	実装手順（箇条書き）
	2.	ファイル別の差分パッチ（index.html / app.js）
	•	追加コードは「ここに挿入」のコメント付きでわかりやすく
	3.	適用手順（どのブロックをどこへ入れるか）
	4.	検証方法（都市検索→72h表示、色帯、insight、Consoleエラーなし、モバイル幅確認）

受け入れ基準（Doneの定義）
	•	72時間の気圧データが表示される
	•	リスクストリップが赤/黄/緑の72本で表示される
	•	「次のHigh開始時刻」が #insight に表示される（該当なしなら“なし”）
	•	Consoleエラーがない
	•	既存の検索/現在地ボタンが動く（崩れない）