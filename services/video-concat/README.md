# video-concat — 内見動画の結合サービス（Cloud Run）

生成済みクリップの URL を受け取り、ffmpeg で 1 本の mp4 に結合して倍速化し、
そのバイト列を返すだけのサービス。`demos/property-video` の「完成した内見動画」を、
6 本の連続再生ではなく**本当に 1 本の動画**にするために置いている。

なぜ Vercel ではなくここか: Vercel Functions では ffmpeg を動かせない
（バンドル 250MB 上限に対し ffmpeg だけで 70〜100MB、Edge には `child_process` が無い）。
結合は常駐環境が必要なので、そこだけ Cloud Run に切り出している。

---

## API

### `POST /concat`

```json
{ "clips": ["https://.../01.mp4", "https://.../02.mp4"], "speed": 1.0, "clip_seconds": 5 }
```

| フィールド | 必須 | 既定 | 説明 |
|---|---|---|---|
| `clips` | ✔ | — | クリップの URL 配列（https のみ、最大 `MAX_CLIPS` 本）。並び順がそのまま再生順 |
| `speed` | | `1.0` | 焼き込む倍速。`0.5`〜`4.0` |
| `clip_seconds` | | 全尺 | 各クリップを頭から何秒使うか。`0.5`〜`60`。生成 API は 6/10 秒しか作れないので、5 秒に揃えたい場合はここで切る |

**速度の扱い方**: デモ画面では等倍（`speed:1`）で結合し、視聴時の速度はブラウザの
`playbackRate` で変えている（切り替えても再エンコード待ちが無い）。
保存だけは焼き込みが必要なので、そのときに選択中の速度で再度この API を呼ぶ。

レスポンス: `200 video/mp4`（本体は mp4 のバイト列）。失敗時は
`4xx/5xx` と `{"error": "..."}`。

出力は `OUT_WIDTH×OUT_HEIGHT`（既定 1280×720）/ `OUT_FPS`（既定 30）/ H.264 / 音声なしに正規化される。
入力の解像度や fps が揃っていなくても、concat 前に scale+pad+fps で揃えるため失敗しない。

### `GET /health`

`200 ok`。Cloud Run のヘルスチェック用。

---

## ローカルで動かす

ffmpeg さえ入っていれば Python の依存パッケージは無い。

```bash
brew install ffmpeg          # 未インストールなら
PORT=8099 python3 main.py

curl -X POST http://localhost:8099/concat \
  -H 'Content-Type: application/json' \
  -d '{"clips":["https://example.com/a.mp4","https://example.com/b.mp4"],"speed":2}' \
  -o merged.mp4
```

デモ側からローカルのサービスを叩いて確認する場合は、クエリで上書きできる:

```
http://localhost:5173/d/property-video/index.html?concat=http://localhost:8099
```

---

## デプロイ

```bash
gcloud run deploy video-concat \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --memory 2Gi --cpu 2 \
  --timeout 600 \
  --concurrency 2 \
  --max-instances 3 \
  --set-env-vars 'ALLOWED_ORIGINS=https://<本番ドメイン>,ALLOWED_HOST_SUFFIXES=<CDNのホスト>'
```

- `--source .` で Cloud Build が同ディレクトリの Dockerfile を使ってビルドする
- `--timeout 600`: 6 本の結合は通常 30 秒以内に終わるが、CDN が遅い場合の余裕
- `--concurrency 2`: 1 リクエストが ffmpeg で CPU を使い切るため、詰め込みすぎない
- `--max-instances 3`: デモ用途の暴走防止

デプロイ後、表示された URL を `demos/property-video/index.html` の
`CONCAT_API_DEFAULT` に貼る。空のままなら結合は行われず、従来の連続再生になる。

```js
const CONCAT_API_DEFAULT = 'https://video-concat-xxxxxxxx-an.a.run.app';
```

---

## 環境変数（すべて任意）

| 変数 | 既定 | 説明 |
|---|---|---|
| `ALLOWED_ORIGINS` | `*` | CORS 許可オリジン。カンマ区切り。本番ドメインを入れるのが望ましい |
| `ALLOWED_HOST_SUFFIXES` | （空＝制限なし） | 取得を許可するホストのサフィックス。**設定推奨**（下記） |
| `AUTH_TOKEN` | （空＝認証なし） | 設定すると `X-Concat-Token` ヘッダの一致を要求 |
| `MAX_CLIPS` | `24` | 1 リクエストのクリップ本数上限 |
| `MAX_CLIP_MB` / `MAX_TOTAL_MB` | `80` / `800` | ダウンロードサイズの上限 |
| `OUT_WIDTH` / `OUT_HEIGHT` / `OUT_FPS` | `1280` / `720` / `30` | 出力の正規化 |
| `FFMPEG_TIMEOUT` | `480` | ffmpeg のタイムアウト秒 |

---

## 公開エンドポイントとして注意すること

`--allow-unauthenticated` で公開する以上、**任意の URL を取りに行かせられる**のが
このサービスの本質的なリスクになる。実装済みの対策:

- **https のみ**受け付ける
- **名前解決した IP が私的/ループバック/リンクローカル/予約済みなら拒否**（SSRF 対策。
  GCP のメタデータサーバー `169.254.169.254` もここで弾かれる）
- クリップ単位・合計のサイズ上限で打ち切り
- 本数上限、ボディサイズ上限、ffmpeg のタイムアウト

そのうえで、**本番では `ALLOWED_HOST_SUFFIXES` に生成結果 CDN のホストを設定して、
それ以外からは取得できないようにするのが望ましい**。ホスト名は Modellix の
`result.resources[].url` を 1 度実行して確認するのが確実（未確認のため既定は空にしてある）。

`AUTH_TOKEN` はフロントの JS に載る以上、秘密にはならない。いたずら防止程度の効果しかない点に注意。

---

## コスト感

2 vCPU / 2GiB で、6 本（実尺 36 秒）の結合が概ね 10〜30 秒。
Cloud Run は割り当て時間課金なので、1 回あたり数円未満に収まる。
生成側（Modellix・1 セット約 ¥220）に比べれば無視できる。
