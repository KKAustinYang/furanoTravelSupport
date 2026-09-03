# 日本語ナレーション生成ツール

台本（日本語）と参照音声から、**指定した秒数ちょうどの**ナレーション音声を作る CLI。
Modellix の `alibaba/cosyvoice-clone` で本人の声をクローンして合成する。

```bash
python narrate.py --script script.txt --target 30 --out output/narration.mp3
```

---

## セットアップ

```bash
# 1. ffmpeg（必須。音声の計測と結合に使う）
brew install ffmpeg              # macOS
sudo apt install ffmpeg          # Ubuntu

# 2. Python 依存
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt

# 3. APIキー（コードにも設定ファイルにも書かない）
export MODELLIX_API_KEY=mdlx-xxxxxxxx
```

## 参照音声（クローン元）の用意

- **10〜30秒**、静かな環境、出力したいトーンで読んだ音声
- **公開アクセス可能な URL** が必要（API がその URL を取りに行く）
- 手元に音源が無い場合は、system voice で仮の音源を作れる:

```bash
python make_reference.py --out reference.mp3
# → 保存された Modellix の結果URL（file.modellix.ai）をそのまま --ref-url に使える
```

## 使い方

```bash
# ① まず台本の長さを確認する（APIを呼ばない・課金なし）
python narrate.py --script script.txt --target 30 --dry-run

# ② 本番
python narrate.py --script script.txt --target 30 \
  --ref-url https://example.com/reference.mp3 \
  --out output/narration.mp3

# ③ モデルを比較する
python narrate.py --script script.txt \
  --compare alibaba/cosyvoice-clone,minimax/minimax-voice-clone
```

| 引数 | 説明 |
|---|---|
| `--script` | 台本ファイル（UTF-8）**必須** |
| `--config` | 設定ファイル（既定 `config.json`） |
| `--target` | 目標秒数 |
| `--out` | 出力先（既定 `output/narration.mp3`） |
| `--ref-url` | 参照音声URL |
| `--model` / `--provider` | モデル指定 |
| `--rate` | 話速 |
| `--chunk-seconds` | 1チャンクの目標秒数（既定 5.0） |
| `--no-cache` | キャッシュを使わず全チャンク再生成 |
| `--dry-run` | APIを呼ばず、分割結果と予測秒数だけ表示 |
| `--compare` | 複数モデルで比較生成 |
| `--debug` | 最初のタスク応答JSONを出力 |

## 台本のタグ（任意）

行頭にタグを書くと、**その境界をまたいでチャンクを結合しない**。

```
[AVATAR] こんにちは、IREAの弘岡です。
[FOOTAGE:リビング] 南向きのリビングは12畳。
```

後工程で動画と合わせるとき、顔が出る区間と物件映像が流れる区間の切り替え点が
チャンクの境界と一致していれば、`output/parts/00N.mp3` をそのまま使える
（秒数指定での切り出しが要らず、ズレも起きない）。

## 出力

| | |
|---|---|
| `output/narration.mp3` | 完成音声 |
| `output/parts/00N.mp3` | チャンク単位の音声（**後工程で使うので消さない**） |
| `output/report.json` | チャンクごとの予測秒・実測秒・乖離率・ギャップ長・リトライ回数 |

## 実測メモ（2026-09-02）

### instruction は使わないこと（重要）

`instruction` に自由文の日本語を渡すと、**モデルが指示文を読み上げたうえで本文を
2回繰り返す**。同じ文で実測:

| 条件 | 出力長（seed 0 / 1234 / 4321） |
|---|---|
| instruction あり + preprocess あり | 7.80 / 8.90 / 7.63 秒 |
| instruction なし + preprocess あり | 3.55 / 3.48 / 3.48 秒 |
| instruction あり + preprocess なし | 7.80 / 8.90 / 7.63 秒 |
| instruction なし + preprocess なし | 3.55 / 3.55 / 3.55 秒 |

ASR にかけると原因が見える:

```
入力: 詳しくは、プロフィールのリンクからご覧ください。
出力: 詳しくはプロフィールのリンクからご覧ください。大のくちょうで
      詳しくはプロフィールのリンクからご覧ください。
```

`instruction` の「…口調で」がそのまま読まれている。CosyVoice の instruction は
音色表にある固定書式（中国語）が前提で、自由文は想定されていない。
**口調を変えたい場合は、参照音声を目的の口調で録り直す。**

なお `enable_preprocess` は出力長に影響しなかった（上表の1行目と3行目が完全一致）。
同じ seed なら結果は再現するので、「seed を変えて引き直す」というリトライ方針は有効。

### ja_chars_per_sec は声ごとに調整する

実行後にコンソールへ「実測の読み上げ速度」が出る。実測では 5.7〜5.8 拍/秒。
この値を `config.json` に反映すると、予測秒数の精度＝無駄なリトライの少なさが上がる。

**この設定を変えるとチャンクの切れ目も変わる**（チャンク長の閾値が秒数から
文字数へ換算されるため）。変わったチャンクはキャッシュが効かず再生成になる。

### 実行結果（30秒 / 149文字 / 6チャンク）

- 出力 **30.00 秒**（目標 30.0 秒、差 -0.00 秒）
- リトライ 0 / suspect 0
- ASR 検証で、漏れ・繰り返しなしを確認
- `minimax/minimax-voice-clone` でも同条件で 30.00 秒・乖離 2〜16%
