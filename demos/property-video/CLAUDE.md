# 物件写真 → 内見動画 自動生成デモ（開発ガイド）

不動産クライアント向けデモ。物件写真をアップロードすると、AIが各部屋を6秒動画に変換し、
**1本の内見動画として連続再生**する。撮影・編集なしで内見動画をつくる体験を見せるのが目的。

- 実装: `demos/property-video/index.html`（単一HTML・静的デモ・ビルド不要）
- 公開URL: `/d/property-video/index.html`
- 使用モデル: Modellix `minimax/hailuo-2.3-fast-i2v`

---

## 1. アーキテクチャの前提（重要・変更前に必読）

### ffmpeg は Vercel では動かない → 結合だけ Cloud Run に出してある

Vercel Functions では ffmpeg を動かせない。

- バンドル上限 250MB に対し ffmpeg バイナリだけで 70〜100MB
- Edge runtime に `child_process` が無い
- Vercel 公式も "not recommended" と明言

そのため結合処理だけを別サービスに切り出している: **`services/video-concat/`（Cloud Run・Python + ffmpeg）**。
クリップの URL を POST すると、1本に結合して倍速化した mp4 のバイト列が返る。
詳細は [`services/video-concat/README.md`](../../services/video-concat/README.md)。

```
ブラウザ → POST https://video-concat-....run.app/concat {clips:[...], speed:1}
        ← 200 video/mp4（1280x720 / 30fps / 音声なし）
```

**再生速度は焼き込まない。** 結合は等倍で行い、視聴時の速度は `playbackRate` で変える
（1x / 1.5x / 2x / 3x を切り替えても再エンコードを待たない）。保存を押したときだけ、
選択中の速度で同じ API を呼び直して焼き込んだ mp4 を作る（速度ごとにキャッシュする）。
各クリップを 5 秒に揃えたい場合は `clip_seconds` を渡す（生成 API 側は 6 秒か 10 秒しか作れない）。

**結合サービスは任意。** フロントの `CONCAT_API_DEFAULT` が空なら、従来どおり
6本のクリップを `<video>` で順に再生し `playbackRate = 2` を掛けて
「結合済み・2倍速の1本」に見せる方式で動く。結合に失敗した場合もこの方式に自動で落ちる。

```js
// 1本終わったら次を再生する。これだけで連結動画に見える（フォールバック経路）
$('v').addEventListener('ended', () => { if (!merged) play(idx + 1); });
```

> Vercel Functions 内で ffmpeg を解決しようとしないこと。
> ブラウザ内 ffmpeg.wasm という選択肢もあるが約30MBのロードが発生する。

### API キーは「お客様のものを預かる」方式。サーバーには置かない

このデモは**お客様ご自身の Modellix キーで生成する**（生成費はお客様負担）。
画面の STEP 0 で入力し、**そのブラウザの localStorage にだけ**保持する。

```
ブラウザ  →  /api/v1/...                      →  api/proxy.js       →  https://api.modellix.ai/api/v1/...
             X-Modellix-Key: <お客様の鍵>          そのまま中継（保存も記録もしない）
```

守ること:

- **鍵は必ずヘッダ（`X-Modellix-Key`）で渡す。クエリ文字列に載せない**
  （URL はアクセスログ・ブラウザ履歴・Referer に残る）
- プロキシで鍵をログ出力しない。レスポンスに含めない
- サーバーに保存しない。`localStorage` 以外に書かない
- 401/403 はリトライしない。キーの入れ直しを促す（課金前に弾かれる）

`api/proxy.js` の優先順位は **①ヘッダの鍵 → ②`MODELLIX_KEY`（環境変数）**。
②は観光デモなど「こちらが費用を持つデモ」用に残してあるので、消さないこと。
`VITE_` プレフィックスを付けてはいけないのも従来どおり（付けるとビルド成果物に焼き込まれる）。

Modellix が返す絶対URLは `toProxyPath()` でパスだけ取り出して同源に戻すこと（CORS回避の要）。

```js
function toProxyPath(u) {
  try { const x = new URL(u); return x.pathname + x.search; } catch { return u; }
}
```

---

## 2. Modellix API の使い方

### 2-1. 非同期2ステップが基本

すべての生成タスクは「投入 → ポーリング」の2段階。同期APIは存在しない。

```
POST /api/v1/{provider}/{model}     →  task_id が即返る（status: pending）
GET  /api/v1/tasks/{task_id}        →  status が success / failed になるまで繰り返す
```

投入レスポンス:

```json
{ "code": 0, "message": "success",
  "data": { "status": "pending", "task_id": "task-abc123",
            "get_result": { "method": "GET", "url": "https://api.modellix.ai/api/v1/tasks/task-abc123" } } }
```

`data.get_result.url` は**絶対URL**で返るので、必ず `toProxyPath()` を通すこと。

完了レスポンス:

```json
{ "code": 0,
  "data": { "status": "success", "task_id": "task-abc123", "duration": 41230,
            "result": { "resources": [ { "url": "https://cdn.../x.mp4", "type": "video",
                                         "width": 1366, "height": 768, "format": "mp4" } ] },
            "billing": { "status": "succeeded", "amount": "0.2400" },
            "result_expires_at": 1786000000000 } }
```

- 実際の課金額は `data.billing.amount` が正（推定値ではなくこれを表示に使える）
- `result_expires_at` が結果URLの失効時刻（Unix ミリ秒）

### 2-2. hailuo-2.3-fast-i2v のリクエスト仕様

```
POST /api/v1/minimax/hailuo-2.3-fast-i2v
```

| パラメータ | 型 | 必須 | 既定 | 制約 |
|---|---|---|---|---|
| `first_frame_image` | string | **必須** | — | 画像URL または **Base64 Data URL** |
| `prompt` | string | 任意 | — | 最大2000文字 |
| `prompt_optimizer` | boolean | 任意 | **`true`** | 本デモでは必ず `false`（後述） |
| `fast_pretreatment` | boolean | 任意 | `false` | `prompt_optimizer=true` の時のみ有効 |
| `duration` | integer | 任意 | `6` | **`6` または `10` のみ**（5秒は無い） |
| `resolution` | string | 任意 | `"768P"` | `"768P"` / `"1080P"` |

**duration と resolution の組み合わせ制約:**
- `10` 秒は `768P` のみ
- `1080P` は `6` 秒のみ

**入力画像の制約:**
- 形式: JPG / JPEG / PNG / WebP
- サイズ: 20MB 未満
- 短辺: 300px より大きいこと
- 縦横比: 2:5 〜 5:2 の範囲内

これらは投入前にクライアント側で検証している（`shrink()` 内）。API側で弾かれると
400 が返り課金はされないが、UX のために事前チェックを維持すること。

```bash
# 動作確認用
curl -X POST https://api.modellix.ai/api/v1/minimax/hailuo-2.3-fast-i2v \
  -H "Authorization: Bearer $MODELLIX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"first_frame_image":"https://example.com/room.jpg","prompt":"Slow forward dolly","prompt_optimizer":false,"duration":6,"resolution":"768P"}'

curl https://api.modellix.ai/api/v1/tasks/task-abc123 \
  -H "Authorization: Bearer $MODELLIX_API_KEY"
```

### 2-3. `prompt_optimizer` は必ず `false`（最重要）

既定は `true` で、その場合 Modellix 側がプロンプトを自動で書き換える。
本デモのプロンプトは「**部屋の構造を変えるな**」という制約が本体なので、
書き換えられるとその指示が消え、AIが壁やドアを勝手に増減させるリスクが上がる。

不動産では、実在しない間取りを見せることが**宅建業法上の誇大広告**に該当しうる。
`prompt_optimizer: false` は機能ではなくコンプライアンス上の要件として扱うこと。

`fast_pretreatment` は `prompt_optimizer=true` が前提なので、本デモでは使えない。
速度と引き換えに安全性を捨てることになるため、有効化しないこと。

### 2-4. プロンプト設計

```js
const PROMPT = (move) => `${move}, as if a person is walking in during a property viewing. `
  + `Keep the architecture, layout, furniture, windows, and doors exactly as in the source image `
  + `- do not add, remove, or reshape anything. Photorealistic real estate footage, `
  + `natural indoor lighting, no people, steady tripod-like motion.`;
```

`move` は**全カット共通**にしている。

```js
const MOVE = 'Slow, smooth forward dolly movement through the room';
```

以前は部屋ごとに運鏡を変えていた（玄関は進入、LDKはパン、水回りはほぼ静止…）が、
**写真がどの部屋かを判定する手段が無い**ため取りやめた。手掛かりはアップロード順しかなく、
順番が違えばキッチンの写真に「玄関へ進入する」プロンプトが当たる。
部屋を取り違えた運鏡は、破綻（実在しないドアや通路の生成）に直結する。

部屋ごとに戻すのは、**部屋種別を判定できるようになってから**。
GPTBots の vision で画像から推定するのが本命（「5. 未実装」参照）。
判定できるまでは、どの部屋でも壊れにくい小さな前進だけに寄せておくのが安全側。

大きなカメラワークを指定すると幻覚（壁の歪み・家具の変形・存在しないドア）が増える。
プロンプトを「派手に」する方向の変更は避けること。

### 2-5. File API は使わない

Modellix にはファイルアップロードAPI（`POST /api/v1/media/files`）があるが、**使っていない**。

- **1チームあたり10ファイルまで**（すぐ上限に達する）
- 同時アップロード2件まで
- 保持期間 約7日

デモは不特定多数が写真を投げるので、10ファイル上限は即破綻する。
代わりに `first_frame_image` に **Base64 Data URL** を直接渡している。この方式なら上限が無い。

### 2-6. レート制限・並行数

チーム単位。**単発チャージ額で決まり、一度上げれば永続**。

| 単発チャージ | 並行タスク | RPM |
|---|---|---|
| < $10 | 2 | 100 |
| $10 | 10 | 100 |
| **$100（現在のプラン）** | **20** | **200** |
| $200 | 30 | 300 |
| $500 | 50 | 500 |
| $1,000 | 100 | 1,000 |

現在は**並行20 / RPM 200**。フロントは同時10件に絞ってあるので、2組が同時にデモしても上限内に収まる。
現在値は https://www.modellix.ai/console/team/entitlements で確認できる。

### 2-7. エラーハンドリング

| コード | 意味 | 対応 |
|---|---|---|
| 400 | パラメータ不正 | **リトライ禁止**。パラメータを直す |
| 401 | キー不正 | **リトライ禁止**。`MODELLIX_KEY` を確認 |
| 402 | 残高不足 | **リトライ禁止**。チャージが必要 |
| 404 | task_id / model 不明 | **リトライ禁止** |
| 429 | レート or 並行上限 | 指数バックオフでリトライ。`X-RateLimit-Reset` ヘッダを見る |
| 500 / 503 | サーバー側一時障害 | 指数バックオフで最大3回 |

**課金が発生するPOSTは自動リトライしないこと。** ネットワーク断で成否不明になった場合、
盲目的に再送すると二重課金になる。現実装では 429 のみリトライしている（429は課金前に弾かれる）。

### 2-8. 生成結果は7日で消える

`result.resources[].url` は約7日で失効する（`result_expires_at` が正確な失効時刻）。

- 事前生成したサンプル動画を使う場合は、**必ずローカルにダウンロードして
  `demos/property-video/samples/` 等にコミットする**こと。URLを貼るだけでは1週間で壊れる
- UI にも「7日間のみ保持」の注意書きを出している

### 2-9. 料金

`minimax/hailuo-2.3-fast-i2v` は **$0.0400〜0.0800 / 秒**（768P と 1080P で変わる）。

- 6秒 768P ＝ **$0.24 / クリップ**
- 6クリップ1セット ＝ **$1.44 ≒ ¥220**

UI では推定値を表示しているが、正確な実費は `data.billing.amount` で取れる。

---

## 3. 実装の構造（index.html）

単一HTMLに全部入っている。ビルド不要。主要な関数:

| 関数 | 役割 |
|---|---|
| `shrink(file, maxSide)` | Canvasで長辺1280pxに縮小 → JPEG q0.82 → Data URL。API制約の事前検証もここ |
| `toProxyPath(u)` | 絶対URL → 同源パス（CORS回避） |
| `submit(dataUrl, prompt)` | タスク投入。429を指数バックオフでリトライ。ポーリング先パスを返す |
| `poll(url, onTick)` | 3秒間隔で最大10分ポーリング |
| `render()` | 写真スロットの描画（部屋プルダウン付き） |
| `setState(it, cls, text, pct)` | カードのバッジと進捗バー更新 |
| `buildPlayer(ok)` / `play(i)` | 連続再生。`ended` で次へ |

状態は `items[]` 配列で持つ:

```js
{ file, dataUrl, room, status: 'idle'|'ok'|'ng', videoUrl, elapsed, error, el }
```

生成は `runPool(items, PARALLEL, ...)` で**同時 10 件まで**。1件失敗しても他は継続し、成功したものだけ再生する。

`Promise.all` で全部投げないのは、20枚アップロードされたときに Modellix の並行上限（20）を
1セッションで食い潰し、429 が連鎖するため。空いたワーカーが次を取りに行くだけの単純なプールにしてある。

### Vercel のリクエストボディ上限（4.5MB）

**画像は1枚1リクエストで送ること。** 6枚をまとめて1リクエストにすると上限を超える。
長辺1280px・JPEG q0.82 で1枚あたり Base64 後 約400KB なので、1枚ずつなら安全。

---

## 4. プロジェクトへの組み込み方

このリポジトリの `demos/` は自動ビルドされる仕組みになっている。

- `demos/<slug>/` に `package.json` があれば Vite アプリとしてビルド → `dist/` をコピー
- `index.html` だけなら**静的デモとしてフォルダごとコピー**（本デモはこちら）
- 出力先は `public/d/<slug>/`（gitignore 済み。コミットするのは `demos/` 配下のソースのみ）

```bash
npm run dev     # predev で build:demos が走る
npm run build   # build:demos → build:showcase
```

ショーケース一覧のカードは `src/data/content.js` の `DEMOS` 配列に登録済み:

```js
{ cat:'model', icon:'spark', url:'/d/property-video/index.html',
  ja:{ t:'物件写真 → 内見動画 自動生成', d:'…' },
  en:{ t:'Property Photos → Walkthrough Video', d:'…' },
  tags:['Modellix','不動産','Live'] }
```

---

## 5. 実装済み / 未実装

### 実装済み

- API キーの入力・保存・削除（localStorage、マスク表示。未設定なら生成ボタンは押せない）
- 写真アップロード（ドラッグ＆ドロップ / ファイル選択、最大20枚）
- クライアント側リサイズ＋API制約の事前検証
- 並列生成（同時 10 件のプール）、カードの進捗表示（送信中 / 生成中 Ns / 完了 Ns / 失敗）
- 経過時間・完了数・推定コスト・従来撮影費との対比
- 連続再生（1x / 1.5x / 2x 切替、シーンインジケータ、最初から）
- **1本の mp4 への結合**（`services/video-concat` の Cloud Run を設定した場合）。
  再生速度は 1x/1.5x/2x/3x で即時切替、選択中の速度で mp4 を書き出せる。
  未設定・失敗時は連続再生に自動で落ちる
- 各シーンの個別ダウンロード（CORS失敗時は新規タブにフォールバック）
- AI生成である旨の注意書き

### 未実装（次にやるならこの順）

1. **事前生成サンプル（最優先）**
   商談の冒頭で待たせないために、サンプル物件の完成動画を用意して即再生できるようにする。
   `demos/property-video/samples/` に mp4 を置き、「サンプルを見る」ボタンから読む。
   ※ Modellix のURLは7日で切れるのでローカルに落としてコミットすること。

2. **失敗クリップの Ken Burns フォールバック**
   生成が失敗・タイムアウトした部屋は、静止画をゆっくりズーム/パンさせた擬似動画で代替すれば
   デモが途中で崩れない。ブラウザなら CSS アニメーション or Canvas で代替可能（ffmpeg不要）。

3. **結合サービスの本番運用**
   結合自体は `services/video-concat`（Cloud Run）で実装済み。残っているのは運用面:
   `ALLOWED_HOST_SUFFIXES` に生成結果CDNのホストを設定して取得先を絞ること、
   `ALLOWED_ORIGINS` を本番ドメインに限定すること、BGM・テロップの焼き込みを足すかの判断。

4. **縦型 9:16 出力**
   Instagram / TikTok 用。不動産クライアントの反応が良い機能。
   生成時に別アスペクトで作るか、CSS/Canvas でクロップする。

5. **物件情報テロップ**
   価格・駅徒歩・間取りを動画上にオーバーレイ表示（DOM重ねで十分、焼き込み不要）。

6. **部屋の自動判定**（これができたら運鏡の出し分けを復活させる）
   GPTBots の vision モデルで画像から部屋種別を推定する。判定できないうちは
   部屋ごとに運鏡を変えてはいけない（`2-4` 参照）。

---

## 6. 変更時にやってはいけないこと

- `prompt_optimizer` を `true` にする（構造保持の指示が消え、誇大広告リスクが上がる）
- `MODELLIX_KEY` をフロントに渡す／`VITE_` プレフィックスを付ける
- Modellix の絶対URLをそのまま `fetch` する（CORSで落ちる。必ず `toProxyPath()`）
- 6枚を1リクエストにまとめる（Vercel 4.5MB上限）
- File API（`/media/files`）を使う（1チーム10ファイル上限）
- Vercel Functions 内で ffmpeg を動かそうとする
- 課金が発生するPOSTを盲目的にリトライする（二重課金）
- `duration: 5` を指定する（6 か 10 のみ）

---

## 7. 参考

- Modellix REST API: https://docs.modellix.ai/ways-to-use/api
- レート制限・権益: https://docs.modellix.ai/get-started/entitlements
- CLI: https://docs.modellix.ai/ways-to-use/cli
- モデル詳細: https://docs.modellix.ai/minimax/hailuo-2-3-fast-i2v
- コンソール: https://www.modellix.ai/console

同等の処理をローカルCLIで回す検証スクリプトが別途ある（並列度の実測・ffmpeg結合まで込み）。
並列性能や幻覚率を測りたい場合はそちらを使う。
