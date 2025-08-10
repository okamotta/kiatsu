ゴール
	•	既存MVPを視覚デザイン完成形にアップグレードし、**Lighthouse 90+（PWA/Perf/Access/Best Practices）**を達成。
	•	主要端末（iOS/Android/小型～中型画面）で崩れゼロ。
	•	GitHub Pagesで配布する静的PWAの完成。

仕様（UIデザイン・トーン）
	•	カラーパレット（Tailwind基準）
	•	Brand: sky-500 / hover sky-600（アクセント）
	•	面: white（ライト）, gray-800（ダーク）
	•	テキスト: gray-800（ライト）, gray-100（ダーク）
	•	リスク帯: Low= emerald-200, Med= amber-200, High= rose-200
	•	余白/ラディウス/影
	•	角丸: rounded-2xl（24px）
	•	影: shadow-lg（カード）
	•	コンテナ横幅: max-w-2xl, ルート余白: p-4（sm以上は p-6）
	•	タイポ
	•	system-ui, -apple-system, Segoe UI, Roboto, Noto Sans JP, sans-serif
	•	見出し：text-2xl font-bold / セクションタイトル：text-lg font-semibold / 本文：text-sm text-gray-500
	•	レイアウト構成（上から）
	1.	ヘッダー：タイトル、現在地ピル、テーマトグル（🌓）
	2.	検索カード：都市入力・検索ボタン・現在地ボタン
	3.	グラフカード：72h気圧グラフ＋リスクストリップ＋次のHighまでのカウントダウン
	4.	スコア入力カード：0–5スライダー、現在値、保存ボタン（v1系の挙動維持）
	5.	フッター：免責・バージョン
	•	ダークモード
	•	html.dark クラスで切替。OS追従をデフォルト、トグルで明示切替（localStorage.theme）。

実装ステップ（順番厳守）
	1.	Tailwind UI化（CDN継続で可）
	•	<body> に bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100
	•	主要セクションを rounded-2xl shadow-lg p-4 sm:p-6 bg-white dark:bg-gray-800 でカード化
	•	既存ID/構造は変更禁止
	2.	ヘッダー整備
	•	左：text-2xl font-bold タイトル＋#locピル（px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-xs）
	•	右：🌓トグル（押すと html.classList.toggle('dark') & localStorage.theme 更新、初期はOS追従）
	3.	グラフ＆リスクパネルの視覚調整
	•	canvas 上下に余白、ストリップ高さ=28px、6hごとに薄い目盛線
	•	insight行に**「次のHighまで 残り X時間Y分」**（1分ごと更新）
	•	しきい値文言は簡潔（“急降下＝3hで−6hPa” をtooltipで示す）
	4.	アクセシビリティ
	•	主要ボタンに aria-label
	•	input#city に aria-describedby（例: “都市名で検索”）
	•	カラコントラスト AA 以上（ダーク時の文字色調整）
	•	フォーカスリング：focus:outline-none focus:ring-2 focus:ring-sky-500
	5.	メタ・ヘッド最適化
	•	<meta name="theme-color" content="#0ea5e9">（ライト時）
	•	apple-mobile-web-app-capable="yes" / apple-mobile-web-app-status-bar-style="default"
	•	viewport は既存維持、favicon も追加（favicon.svg or favicon.png）
	6.	Lighthouse対策
	•	画像（アイコン）は 正しいサイズ/type宣言
	•	sw.js：更新時の新バージョン通知（skipWaiting→再読み込みバナー）
	•	リソースは相対パス（./）でPages配信に最適化
	•	可能なら defer ロード（CDNはそのままでも可）
	7.	配布
	•	README.md 作成（使い方・PWA追加・データ/プライバシー）
	•	manifest.webmanifest の name/short_name/icons/start_url 最終確認
	•	icon-192.png / icon-512.png を配置（仮でもOK）

変更ファイル
	•	index.html：構造を保ったままTailwindクラス付与、ヘッダー/カードHTML、メタ・リンク追記
	•	app.js：テーマトグル、カウントダウン処理（setInterval 1分）、小さなアクセシビリティ改善
	•	sw.js：更新検知→「新しいバージョンがあります」トースト→skipWaiting メッセージハンドリング
	•	manifest.webmanifest：name/short_name/theme_color/start_url/icons 最終調整
	•	（任意）README.md：公開URLとインストール手順

コード要件（抜粋）
	•	既存IDは変更禁止：city, searchBtn, geoBtn, chart, insight, loc
	•	スタイルはTailwindクラスのみ追加（インラインstyleは最小限）
	•	ストリップCSS（高さ/色/区切り）は既存.risk-*クラスを上書きでOK
	•	カウントダウン：nextHigh が無ければ“なし”、あれば現在時刻との差を毎分更新
	•	SW更新通知：
	•	SW側：self.skipWaiting() を message で実行
	•	ページ側：registration.waiting を検知→バナー表示→「更新」クリックで postMessage('SKIP_WAITING') → window.location.reload()

受け入れ基準（明確なDone定義）
	•	Lighthouse（モバイル）：Performance/Access/PWA/Best Practices ≥ 90
	•	主要幅（375/414/768px）で崩れなし、文字は読める/タップ余白16px以上
	•	ダーク/ライト切替が即時反映、再訪時に設定保持
	•	「次のHighまで 残りX時間Y分」が正しく更新、Highが無い場合は“なし”
	•	SW更新通知が機能（手動でSWのバージョン文字列を上げて確認）
	•	GitHub Pagesで https://okamotta.github.io/kiatsu/ が問題なく動作

出力フォーマット（必須）
	1.	手順（箇条書き）
	2.	ファイル別の差分パッチ（index.html / app.js / sw.js / manifest.webmanifest / README.md）
	•	どこに挿入/置換かコメントで明示
	3.	検証チェックリスト（Lighthouse手順と想定スコア、モバイル幅、SW更新テスト）
	4.	ロールバック方法（変更前に戻す簡単な説明）

    メモ（実装のヒント）
	•	カウントダウン：
    let timerId;
function startCountdown(nextHighIso){
  clearInterval(timerId);
  const el = document.getElementById('insight');
  if(!nextHighIso){ el.textContent = '🙂 今後72時間に急降下の予測なし'; return; }
  function tick(){
    const ms = new Date(nextHighIso) - Date.now();
    if(ms <= 0){ el.textContent = '⚠️ まもなく急降下（High）'; clearInterval(timerId); return; }
    const h = Math.floor(ms/3600000), m = Math.floor((ms%3600000)/60000);
    el.textContent = `⚠️ 次のHighまで 残り ${h}時間${m}分`;
  }
  tick(); timerId = setInterval(tick, 60000);
}

detectRiskZones の結果から startCountdown(nextHigh) を呼ぶ。

	•	SW更新トースト（概略）
	•	sw.js:
    self.addEventListener('message', (e)=>{ if(e.data==='SKIP_WAITING') self.skipWaiting(); });

    