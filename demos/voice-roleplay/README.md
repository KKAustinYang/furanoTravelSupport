# AI 応対トレーニング — 音声 AI ロールプレイ研修（デモ）

Vite + React で構築した、コンタクトセンター向けの汎用の
応対力トレーニング・デモです（特定の企業名・商品名は入れていません）。ホーム画面 → ダッシュボード → ロールプレイ → 対応（音声）→
評価レポート → 研修履歴 まで一通り体験できます。

## セットアップ

```bash
cd demos/voice-roleplay
npm install
npm run dev
```

ブラウザで `http://localhost:5173` を開きます。
（マイクを使う実機通話のため、`file://` ではなくローカルサーバー経由で開いてください）

## お客様の写真（差し替え）

`public/` に 2 枚の顔写真を置いています。**実際の写真に差し替えてください**：

- `public/persona_sato.png` … 佐藤 美和子（45歳・アウトバウンド／ベージュのカーディガン）
- `public/persona_tanaka.png` … 田中 由紀（38歳・インバウンド／グレーのトップス）

現在は仮画像が入っています。同じファイル名で上書きすれば反映されます。

## Audio Agent（実際に会話できるのは2名）

`src/data.js` の `iframe` に GPTBots のウィジェット URL を設定済みです。

- 佐藤 美和子（アウトバウンド 中級）: `https://stg.gptbots.ai/widget/eeewsarcgjue2z2gpmbdppm/chat.html`
- 田中 由紀（インバウンド 中級）: `https://stg.gptbots.ai/widget/eezohzlvrfoawvfryzarorp/chat.html`

この 2 つのカードは「対応を始める」で本物の音声通話（iframe）が開きます。
残り 4 名は Audio Agent 未接続のため、一覧に「準備中」と表示され、開けません（`data.js` の `real:false`）。

## 構成

```
src/
  App.jsx          … 画面のルーティング・サイドバー・終了モーダル
  Home.jsx         … ランディング（システムに入る前の画面）
  Logo.jsx         … ロゴ（音声の波形）
  data.js          … シナリオ・お客様・評価・記録などのデータ
  charts.jsx       … レーダー / 折れ線 / ドーナツ（SVG）
  styles.css       … 全スタイル（暖色エディトリアル）
  pages/
    Dashboard.jsx  … ダッシュボード
    Roleplay.jsx   … ロールプレイ（シナリオ一覧）
    Setup.jsx      … 対応前のブリーフィング
    Call.jsx       … 対応中（Audio Agent iframe / モック）
    Report.jsx     … フィードバックレポート
    Records.jsx    … 研修履歴
    Settings.jsx   … Agent 設定
```
