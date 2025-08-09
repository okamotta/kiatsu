# プロジェクト概要
既存の index.html（気圧取得＋グラフ表示MVP）を改修して、UI改善＋機能追加を行う。

# 実装ステップ
1. **Tailwind CDN導入とUI調整**
   - Tailwind CSSをCDN経由で追加
   - 既存のUIをカードベースレイアウトに変更（角丸・余白）
   - ダークモード切替ボタンを実装（HTMLの`<html>`タグに`class="dark"`をトグル）
   - Chart.jsとdate-fnsアダプタもCDNで読み込む
   - 元のHTMLの構造（id/class名）は可能な限り維持する

2. **頭痛スコア入力＋保存機能**
   - スライダー（0〜5段階）でスコア入力
   - 記録時にLocalStorageへ`[{time, score}]`形式で保存
   - グラフ描画時、スコアを散布図として気圧グラフに重ねて表示
   - バブルのサイズはスコアに比例させる（例: `r = score * 3 + 2`）

3. **PWA対応**
   - `manifest.webmanifest` を作成（アプリ名: ZutsuLog）
   - `sw.js`（Service Worker）を作成し、キャッシュ戦略でオフライン表示を可能にする
   - ホーム画面追加に対応
   - 初回アクセス後は電波がなくても最後に取得したデータを表示

4. **GitHub Pages対応**
   - GitHub Pagesでルート配信可能な静的構成にする
   - index.html, manifest.webmanifest, sw.js, アイコン画像（192px, 512px）を用意
   - ビルド不要、CDN読み込みのままでOK

5. **CSVエクスポート機能**
   - CSVファイルに日時・気圧・頭痛スコアを出力
   - 気圧値はスコアの時間に最も近い値を紐付け
   - ファイル名は`zutsu-log.csv`
   - 出力ボタンをUIに追加

# 制約
- 元の機能（気圧取得・グラフ表示・インサイト表示）は壊さない
- 外部ライブラリはCDN読み込みのみ（npmやビルド環境は不要）
- UIはシンプル・余白多め・スマホ対応
- 不要なアニメーションや派手な色は避ける
- HTML/CSS/JSは同一構造をできるだけ維持

# 納品物
- 完成版 index.html（フルコード）
- manifest.webmanifest
- sw.js
- icon-192.png, icon-512.png（仮画像可）