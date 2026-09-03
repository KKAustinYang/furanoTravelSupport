#!/usr/bin/env python3
"""日本語ナレーション生成ツール。

台本（日本語）と参照音声から、指定した秒数ちょうどのナレーション音声を作る。

  python narrate.py --script script.txt --target 30 --out output/narration.mp3

なぜ分割合成なのか（設計の根幹）
--------------------------------
LLM ベースの TTS には既知の失敗モードがある。長い入力の途中を丸ごと飛ばす
（スキップ）、同じ箇所を繰り返す（リピート）。実測では 126 文字を 1 回で投げた
ところ、中間の 61 文字が消えて 10.6 秒（本来なら約 22 秒）で返ってきた。

対策は「台本を約5秒ずつのチャンクに割り、個別に合成してから結合する」。
短い入力ならスキップは起きにくい。これは特定モデルの欠陥への対症療法ではなく、
長尺 TTS における一般的な推奨実装。

秒で機械的に切ってはいけない。合成前に長さは分からないし、文の途中で切ると
抑揚が壊れる。文・節の境界を守りながら、5秒相当の文字数に近づけてパックする。
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import shutil
import subprocess
import sys
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import httpx
except ImportError:  # pragma: no cover
    sys.exit("httpx がありません。`pip install -r requirements.txt` を実行してください。")

API_BASE = "https://api.modellix.ai/api/v1"
DEFAULT_CONFIG = Path(__file__).with_name("config.json")

SENTENCE_END = "。！？!?"
CLAUSE_END = "、，,；;"

# 読み上げの長さは「文字数」ではなく「拍数」で決まる。半角の数字・英字は
# 日本語に読み下すと大きく伸びる（"2LDK" → にーエルディーケー = 9拍）ので、
# 素の len() で見積もると短すぎる方に外れ、スキップと誤判定して無駄に引き直す。
ASCII_WEIGHT = 2.2      # 数字・英字1文字あたりの拍数の目安
PUNCT_WEIGHT = 0.4      # 句読点・記号・空白


def weighted_chars(text: str) -> float:
    """読み上げにかかる拍数の見積もり。実測のチューニング対象。"""
    total = 0.0
    for ch in text:
        if ch.isascii() and ch.isalnum():
            total += ASCII_WEIGHT
        elif ch.isspace() or unicodedata.category(ch).startswith("P"):
            total += PUNCT_WEIGHT
        else:
            total += 1.0
    return total

# ───────────────────────────────────────────────────────── 設定

DEFAULTS: dict[str, Any] = {
    "model": "cosyvoice-v3.5-plus",
    "provider_path": "alibaba/cosyvoice-clone",
    "reference_audio_url": "",
    "language_hint": "ja",
    "target_seconds": 30.0,
    "instruction": "",
    "hot_fix": None,
    "rate": 1.0,
    "pitch": 1.0,
    "volume": 50,
    "sample_rate": 24000,
    "format": "mp3",
    "max_prompt_audio_length": 30,
    "enable_preprocess": True,
    "ja_chars_per_sec": 5.7,
    "target_chunk_seconds": 5.0,
    "min_chunk_seconds": 2.1,
    "max_chunk_seconds": 7.0,
    "tolerance": 0.35,
    "max_retries": 3,
    "concurrency": 3,
    "min_gap": 0.10,
    "max_gap": 1.20,
    "comma_gap_ratio": 0.4,
    "lead_in": 0.2,
    "tail": 0.4,
}


def load_config(path: Path | None) -> dict[str, Any]:
    cfg = dict(DEFAULTS)
    if path and path.exists():
        cfg.update(json.loads(path.read_text(encoding="utf-8")))
    elif path and path != DEFAULT_CONFIG:
        sys.exit(f"設定ファイルが見つかりません: {path}")
    return cfg


# ───────────────────────────────────────────────────────── 台本の分割

@dataclass
class Unit:
    text: str
    tag: str | None


@dataclass
class Chunk:
    index: int
    text: str
    tag: str | None
    ends_with: str
    expected_sec: float = 0.0
    actual_sec: float = 0.0
    deviation: float = 0.0
    gap_after_sec: float = 0.0
    retries: int = 0
    status: str = "pending"
    file: str = ""
    seed: int = 0

    @property
    def chars(self) -> int:
        return len(self.text)

    @property
    def weight(self) -> float:
        return weighted_chars(self.text)

    @property
    def sentence_break(self) -> bool:
        return self.ends_with in SENTENCE_END


def parse_script(raw: str) -> list[tuple[str, str | None]]:
    """行頭のタグを外して (本文, タグ) の並びにする。タグは任意。"""
    lines: list[tuple[str, str | None]] = []
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        tag = None
        if line.startswith("["):
            close = line.find("]")
            if close > 0:
                tag = line[1:close].strip()
                line = line[close + 1 :].strip()
        if line:
            lines.append((line, tag))
    return lines


def split_units(text: str, tag: str | None, max_chars: int, warnings: list[str]) -> list[Unit]:
    """文 →（長ければ）節 の順に割る。区切り文字は前の断片に含める。"""
    sentences: list[str] = []
    buf = ""
    for ch in text:
        buf += ch
        if ch in SENTENCE_END:
            sentences.append(buf)
            buf = ""
    if buf.strip():
        sentences.append(buf)

    units: list[Unit] = []
    for sentence in sentences:
        if weighted_chars(sentence) <= max_chars:
            units.append(Unit(sentence, tag))
            continue
        piece = ""
        for ch in sentence:
            piece += ch
            if ch in CLAUSE_END and weighted_chars(piece) >= max_chars / 2:
                units.append(Unit(piece, tag))
                piece = ""
        if piece:
            units.append(Unit(piece, tag))
        for u in units[-3:]:
            if weighted_chars(u.text) > max_chars:
                warnings.append(f"区切り文字が無く {len(u.text)} 文字のまま残った断片があります: {u.text[:24]}…")
    return units


def build_chunks(raw: str, cfg: dict[str, Any]) -> tuple[list[Chunk], list[str]]:
    cps = cfg["ja_chars_per_sec"]
    target_chars = round(cfg["target_chunk_seconds"] * cps)
    min_chars = round(cfg["min_chunk_seconds"] * cps)
    max_chars = round(cfg["max_chunk_seconds"] * cps)
    warnings: list[str] = []

    units: list[Unit] = []
    for line, tag in parse_script(raw):
        units.extend(split_units(line, tag, max_chars, warnings))
    if not units:
        sys.exit("台本が空です。")

    packed: list[Unit] = []
    for u in units:
        # タグの境界はまたがない。後工程（動画との同期）で切り出す単位になるため。
        if packed and packed[-1].tag == u.tag:
            merged = packed[-1].text + u.text
            if weighted_chars(merged) <= max_chars and weighted_chars(packed[-1].text) < target_chars:
                packed[-1] = Unit(merged, u.tag)
                continue
        packed.append(u)

    if len(packed) >= 2 and weighted_chars(packed[-1].text) < min_chars and packed[-2].tag == packed[-1].tag:
        packed[-2] = Unit(packed[-2].text + packed[-1].text, packed[-1].tag)
        packed.pop()

    chunks = []
    for i, u in enumerate(packed, 1):
        text = u.text.strip()
        chunks.append(Chunk(index=i, text=text, tag=u.tag, ends_with=text[-1] if text else ""))
    if not chunks:
        sys.exit("チャンクが0件になりました。台本を確認してください。")
    for c in chunks:
        c.expected_sec = c.weight / (cps * cfg["rate"])
    return chunks, warnings


# ───────────────────────────────────────────────────────── ffmpeg / ffprobe

def require_tools() -> None:
    missing = [t for t in ("ffmpeg", "ffprobe") if not shutil.which(t)]
    if missing:
        sys.exit(
            f"{' と '.join(missing)} が見つかりません。\n"
            "  macOS: brew install ffmpeg\n"
            "  Ubuntu: sudo apt install ffmpeg"
        )


def probe_seconds(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


def concat(parts: list[Path], gaps: list[float], lead_in: float, tail: float,
           out_path: Path, sample_rate: int) -> None:
    """無音を挟んで連結する。全部デコードしてから1回エンコードするので、
    ファイルごとのサンプルレート差やチャンネル数差を気にしなくてよい。"""
    inputs: list[str] = []
    labels: list[str] = []
    n = 0

    def add_silence(sec: float) -> None:
        nonlocal n
        if sec <= 0:
            return
        inputs.extend(["-f", "lavfi", "-t", f"{sec:.3f}",
                       "-i", f"anullsrc=r={sample_rate}:cl=mono"])
        labels.append(f"[{n}:a]")
        n += 1

    add_silence(lead_in)
    for i, part in enumerate(parts):
        inputs.extend(["-i", str(part)])
        labels.append(f"[{n}:a]")
        n += 1
        if i < len(gaps):
            add_silence(gaps[i])
    add_silence(tail)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *inputs,
           "-filter_complex", f"{''.join(labels)}concat=n={len(labels)}:v=0:a=1[out]",
           "-map", "[out]", "-ar", str(sample_rate), "-ac", "1", "-b:a", "128k", str(out_path)]
    subprocess.run(cmd, check=True)


# ───────────────────────────────────────────────────────── モデルごとのリクエスト

def build_cosyvoice(cfg: dict[str, Any], text: str, seed: int) -> dict[str, Any]:
    body = {
        "model": cfg["model"],
        "url": cfg["reference_audio_url"],
        "text": text,
        "language_hint": cfg["language_hint"],
        "max_prompt_audio_length": cfg["max_prompt_audio_length"],
        "enable_preprocess": cfg["enable_preprocess"],
        "format": cfg["format"],
        "sample_rate": cfg["sample_rate"],
        "rate": cfg["rate"],
        "pitch": cfg["pitch"],
        "volume": cfg["volume"],
        "seed": seed,
    }
    if cfg.get("instruction"):
        body["instruction"] = cfg["instruction"]
    if cfg.get("hot_fix"):
        body["hot_fix"] = cfg["hot_fix"]
    return body


def build_minimax(cfg: dict[str, Any], text: str, seed: int) -> dict[str, Any]:
    # minimax はパラメータ名が違う（url ではなく audio_url、rate ではなく speed）。
    return {
        "model": cfg.get("minimax_model", "speech-2.8-hd"),
        "audio_url": cfg["reference_audio_url"],
        "text": text,
        "language_boost": "Japanese",
        "speed": cfg["rate"],
        "vol": cfg["volume"] / 50.0,
        "format": cfg["format"],
        "sample_rate": cfg["sample_rate"],
    }


BUILDERS = {
    "alibaba/cosyvoice-clone": build_cosyvoice,
    "minimax/minimax-voice-clone": build_minimax,
}


def builder_for(provider_path: str):
    if provider_path not in BUILDERS:
        sys.exit(
            f"モデル {provider_path} のリクエスト形式は未対応です。\n"
            f"対応済み: {', '.join(BUILDERS)}\n"
            "narrate.py の BUILDERS に追加してください。"
        )
    return BUILDERS[provider_path]


# ───────────────────────────────────────────────────────── API

class Api:
    def __init__(self, key: str, client: httpx.AsyncClient, debug: bool = False):
        self.key = key
        self.client = client
        self.debug = debug
        self._dumped = False

    @property
    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.key}", "Content-Type": "application/json"}

    async def submit(self, provider_path: str, body: dict[str, Any]) -> str:
        for attempt in range(5):
            r = await self.client.post(f"{API_BASE}/{provider_path}", json=body, headers=self.headers)
            if r.status_code == 429:
                await asyncio.sleep(2 ** attempt)
                continue
            if r.status_code == 401:
                sys.exit("API キーが拒否されました（401）。MODELLIX_API_KEY を確認してください。")
            if r.status_code >= 400:
                raise RuntimeError(f"{r.status_code} {r.text[:300]}")
            data = r.json()
            if data.get("code") not in (0, None):
                raise RuntimeError(f"code={data.get('code')} {data.get('message')}")
            return data["data"]["task_id"]
        raise RuntimeError("429 が続いたため諦めました")

    async def wait(self, task_id: str, timeout: float = 120.0) -> dict[str, Any]:
        await asyncio.sleep(2)
        waited = 2.0
        while waited < timeout:
            r = await self.client.get(f"{API_BASE}/tasks/{task_id}", headers=self.headers)
            payload = r.json()
            if self.debug and not self._dumped:
                # 仕様書 §14：結果 JSON の構造を必ず一度は目で確認できるようにする
                print("--- task response ---\n" + json.dumps(payload, ensure_ascii=False, indent=2)[:1500])
                self._dumped = True
            data = payload.get("data", {})
            status = data.get("status")
            if status == "success":
                return data
            if status == "failed":
                raise RuntimeError(f"task failed: {json.dumps(data, ensure_ascii=False)[:300]}")
            await asyncio.sleep(2)
            waited += 2
        raise RuntimeError("タイムアウト（120秒）")


def audio_url_of(data: dict[str, Any]) -> str:
    resources = (data.get("result") or {}).get("resources") or []
    for res in resources:
        url = res.get("url") if isinstance(res, dict) else res
        if url:
            return url
    raise RuntimeError(f"音声URLが見つかりません: {json.dumps(data, ensure_ascii=False)[:300]}")


# ───────────────────────────────────────────────────────── 合成

def cache_key(cfg: dict[str, Any], text: str, seed: int) -> str:
    payload = json.dumps({
        "p": cfg["provider_path"], "m": cfg["model"], "u": cfg["reference_audio_url"],
        "t": text, "r": cfg["rate"], "pi": cfg["pitch"], "i": cfg.get("instruction"),
        "h": cfg.get("hot_fix"), "s": seed, "sr": cfg["sample_rate"], "f": cfg["format"],
        "l": cfg["language_hint"],
    }, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()[:16]


async def synth_chunk(api: Api, cfg: dict[str, Any], chunk: Chunk, parts_dir: Path,
                      cache_dir: Path, use_cache: bool, sem: asyncio.Semaphore) -> None:
    build = builder_for(cfg["provider_path"])
    tolerance = cfg["tolerance"]
    dest = parts_dir / f"{chunk.index:03d}.{cfg['format']}"

    for attempt in range(cfg["max_retries"] + 1):
        seed = chunk.seed if attempt == 0 else (chunk.seed + attempt * 977) % 65536
        cached = cache_dir / f"{cache_key(cfg, chunk.text, seed)}.{cfg['format']}"

        if use_cache and cached.exists():
            shutil.copyfile(cached, dest)
        else:
            async with sem:
                try:
                    task_id = await api.submit(cfg["provider_path"], build(cfg, chunk.text, seed))
                    data = await api.wait(task_id)
                    audio = await api.client.get(audio_url_of(data))
                    audio.raise_for_status()
                except Exception as exc:  # noqa: BLE001
                    if attempt >= cfg["max_retries"]:
                        chunk.status = "failed"
                        chunk.retries = attempt
                        print(f"  ✗ #{chunk.index} 失敗: {exc}")
                        return
                    chunk.retries = attempt + 1
                    continue
            cached.parent.mkdir(parents=True, exist_ok=True)
            cached.write_bytes(audio.content)
            shutil.copyfile(cached, dest)

        chunk.actual_sec = probe_seconds(dest)
        chunk.deviation = abs(chunk.actual_sec - chunk.expected_sec) / max(chunk.expected_sec, 0.01)
        chunk.file = str(dest)
        chunk.seed = seed
        if chunk.deviation <= tolerance:
            chunk.status = "ok"
            chunk.retries = attempt
            print(f"  ✓ #{chunk.index:02d} {chunk.actual_sec:5.2f}s (予測 {chunk.expected_sec:5.2f}s, 乖離 {chunk.deviation:.0%})")
            return
        # スキップ／リピートの疑い。seed を変えて引き直す。
        print(f"  ! #{chunk.index:02d} 乖離 {chunk.deviation:.0%} — 再生成 (試行 {attempt + 2}/{cfg['max_retries'] + 1})")
        chunk.retries = attempt + 1

    chunk.status = "suspect"   # 1チャンクの不良で全体を止めない
    print(f"  △ #{chunk.index:02d} 乖離が収まらないため suspect として採用")


# ───────────────────────────────────────────────────────── 尺合わせ

def plan_gaps(chunks: list[Chunk], cfg: dict[str, Any], target: float) -> tuple[list[float], list[str], float | None]:
    """チャンク間の無音を配る。一律ではなく、区切り文字で重み付けする。"""
    warnings: list[str] = []
    speech = sum(c.actual_sec for c in chunks)
    n_gaps = max(len(chunks) - 1, 0)
    if n_gaps == 0:
        return [], warnings, None

    weights = [1.0 if c.sentence_break else cfg["comma_gap_ratio"] for c in chunks[:-1]]
    need = target - speech - cfg["lead_in"] - cfg["tail"]
    floor = cfg["min_gap"] * n_gaps
    ceiling = sum(cfg["max_gap"] * w for w in weights)

    if need < floor:
        # 台本が長い → rate を上げて全チャンクを作り直す（1回だけ）
        denom = target - cfg["lead_in"] - cfg["tail"] - floor
        if denom <= 0:
            warnings.append("目標秒数が短すぎます。台本を減らしてください。")
            return [cfg["min_gap"]] * n_gaps, warnings, None
        new_rate = cfg["rate"] * speech / denom
        return [cfg["min_gap"]] * n_gaps, warnings, new_rate

    if need > ceiling:
        short_sec = need - ceiling
        short_chars = round(short_sec * cfg["ja_chars_per_sec"] * cfg["rate"])
        warnings.append(
            f"台本が約{short_chars}文字不足しています（無音を上限まで入れても{short_sec:.1f}秒余ります）。"
        )
        return [cfg["max_gap"] * w for w in weights], warnings, None

    base = need / sum(weights)
    gaps = [min(max(base * w, cfg["min_gap"]), cfg["max_gap"] * w) for w in weights]
    return gaps, warnings, None


# ───────────────────────────────────────────────────────── 表示

def print_plan(chunks: list[Chunk], cfg: dict[str, Any], target: float) -> None:
    total = sum(c.expected_sec for c in chunks)
    n_gaps = max(len(chunks) - 1, 0)
    silence = target - total - cfg["lead_in"] - cfg["tail"]
    print(f"台本: {sum(c.chars for c in chunks)}文字")
    print(f"チャンク数: {len(chunks)}")
    print(f"予測合計発話秒数: {total:.1f}s (rate={cfg['rate']})")
    print(f"目標: {target:.1f}s")
    print(f"無音に使える時間: {silence:.1f}s / {n_gaps}ギャップ")
    if n_gaps:
        per = silence / n_gaps
        ok = cfg["min_gap"] <= per <= cfg["max_gap"]
        print(f"判定: {'OK' if ok else '要調整'}（平均 {per:.2f}s/ギャップ）")
    print()
    print("  # | 文字 | 予測秒 | 終端 | タグ        | 本文")
    print("----+------+--------+------+-------------+" + "-" * 40)
    for c in chunks:
        print(f" {c.index:2d} | {c.chars:4d} | {c.expected_sec:6.2f} |  {c.ends_with}   | "
              f"{(c.tag or '-'):11s} | {c.text[:38]}")


def print_summary(chunks: list[Chunk], actual: float, target: float, warnings: list[str]) -> None:
    print()
    print(f"出力: {actual:.2f}s（目標 {target:.1f}s / 差 {actual - target:+.2f}s）")
    spoken = [c for c in chunks if c.actual_sec > 0]
    if spoken:
        measured = sum(c.weight for c in spoken) / sum(c.actual_sec for c in spoken)
        print(f"実測の読み上げ速度: {measured:.2f} 拍/秒（設定 ja_chars_per_sec を近づけると精度が上がります）")
    suspect = [c for c in chunks if c.status != "ok"]
    if suspect:
        print(f"要確認のチャンク: {len(suspect)}件")
        for c in suspect:
            print(f"  [{c.status}] #{c.index:02d} 乖離{c.deviation:.0%} {c.text[:30]}")
    for w in warnings:
        print(f"⚠ {w}")


# ───────────────────────────────────────────────────────── 本体

async def run_once(cfg: dict[str, Any], chunks: list[Chunk], out_path: Path, out_dir: Path,
                   use_cache: bool, debug: bool, final: bool = False) -> tuple[float, list[str], float | None]:
    builder_for(cfg["provider_path"])   # 未対応モデルはここで止める
    key = os.environ.get("MODELLIX_API_KEY")
    if not key:
        sys.exit("環境変数 MODELLIX_API_KEY が設定されていません。\n  export MODELLIX_API_KEY=...")
    if not cfg["reference_audio_url"]:
        sys.exit("参照音声URL（reference_audio_url / --ref-url）が必要です。公開アクセス可能なURLを指定してください。")

    parts_dir = out_dir / "parts"
    parts_dir.mkdir(parents=True, exist_ok=True)
    cache_dir = out_dir / ".cache"

    async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
        api = Api(key, client, debug=debug)
        sem = asyncio.Semaphore(cfg["concurrency"])
        print(f"合成中（{len(chunks)}チャンク / 並列{cfg['concurrency']}）…")
        await asyncio.gather(*(synth_chunk(api, cfg, c, parts_dir, cache_dir, use_cache, sem) for c in chunks))

    ok = [c for c in chunks if c.file]
    if not ok:
        sys.exit("全チャンクの合成に失敗しました。")

    gaps, warnings, new_rate = plan_gaps(ok, cfg, cfg["target_seconds"])
    if new_rate is not None and not final:
        return 0.0, warnings, new_rate
    if new_rate is not None:
        # 話速を上げても収まらなかった。最小の無音で書き出し、不足分を警告で伝える。
        over = sum(c.actual_sec for c in ok) + cfg["lead_in"] + cfg["tail"] + sum(gaps) - cfg["target_seconds"]
        warnings.append(f"目標より約{over:.1f}秒長くなります。台本を約"
                        f"{round(over * cfg['ja_chars_per_sec'] * cfg['rate'])}文字短くしてください。")

    concat([Path(c.file) for c in ok], gaps, cfg["lead_in"], cfg["tail"], out_path, cfg["sample_rate"])
    for c, g in zip(ok, gaps):
        c.gap_after_sec = round(g, 3)
    return probe_seconds(out_path), warnings, None


def write_report(cfg: dict[str, Any], chunks: list[Chunk], actual: float,
                 warnings: list[str], regenerated: bool, out_dir: Path) -> Path:
    report = {
        "generated_at": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "model": cfg["model"],
        "provider_path": cfg["provider_path"],
        "script_chars": sum(c.chars for c in chunks),
        "chunk_count": len(chunks),
        "target_seconds": cfg["target_seconds"],
        "actual_seconds": round(actual, 2),
        "total_speech_seconds": round(sum(c.actual_sec for c in chunks), 2),
        "rate_used": cfg["rate"],
        "regenerated_with_new_rate": regenerated,
        "warnings": warnings,
        "chunks": [
            {
                "index": c.index, "text": c.text, "tag": c.tag, "chars": c.chars,
                "ends_with": c.ends_with, "expected_sec": round(c.expected_sec, 2),
                "actual_sec": round(c.actual_sec, 2), "deviation": round(c.deviation, 3),
                "gap_after_sec": c.gap_after_sec, "retries": c.retries,
                "status": c.status, "seed": c.seed, "file": c.file,
            }
            for c in chunks
        ],
    }
    path = out_dir / "report.json"
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def main() -> None:
    ap = argparse.ArgumentParser(description="日本語ナレーション生成（分割合成 + 尺合わせ）")
    ap.add_argument("--script", required=True, type=Path, help="台本ファイル（UTF-8）")
    ap.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    ap.add_argument("--target", type=float, help="目標秒数")
    ap.add_argument("--out", type=Path, default=Path("output/narration.mp3"))
    ap.add_argument("--ref-url", help="参照音声URL")
    ap.add_argument("--model", help="モデル指定（例 cosyvoice-v3.5-flash）")
    ap.add_argument("--provider", help="プロバイダパス（例 alibaba/cosyvoice-clone）")
    ap.add_argument("--rate", type=float, help="話速")
    ap.add_argument("--chunk-seconds", type=float, help="1チャンクの目標秒数")
    ap.add_argument("--no-cache", action="store_true")
    ap.add_argument("--dry-run", action="store_true", help="APIを呼ばず、分割結果と予測秒数だけ表示")
    ap.add_argument("--compare", help="複数モデルを比較（カンマ区切りのプロバイダパス）")
    ap.add_argument("--debug", action="store_true", help="最初のタスク応答JSONを出力する")
    args = ap.parse_args()

    cfg = load_config(args.config)
    for key, val in (("reference_audio_url", args.ref_url), ("model", args.model),
                     ("provider_path", args.provider), ("rate", args.rate),
                     ("target_seconds", args.target), ("target_chunk_seconds", args.chunk_seconds)):
        if val is not None:
            cfg[key] = val

    raw = args.script.read_text(encoding="utf-8")
    chunks, warnings = build_chunks(raw, cfg)

    if args.dry_run:
        print_plan(chunks, cfg, cfg["target_seconds"])
        for w in warnings:
            print(f"⚠ {w}")
        return

    require_tools()

    if args.compare:
        for provider in [p.strip() for p in args.compare.split(",") if p.strip()]:
            slug = provider.replace("/", "_")
            print(f"\n=== {provider} ===")
            sub = dict(cfg, provider_path=provider)
            if provider.startswith("minimax/"):
                sub["model"] = sub.get("minimax_model", "speech-2.8-hd")
            sub_chunks, _ = build_chunks(raw, sub)
            out_dir = args.out.parent / "compare" / slug
            try:
                actual, warns, _ = asyncio.run(
                    run_once(sub, sub_chunks, out_dir / f"{slug}.mp3", out_dir, not args.no_cache, args.debug))
                print_summary(sub_chunks, actual, sub["target_seconds"], warns)
                write_report(sub, sub_chunks, actual, warns, False, out_dir)
            except SystemExit as exc:
                print(f"✗ {provider}: {exc}")
                continue
        return

    out_dir = args.out.parent
    actual, warns, new_rate = asyncio.run(run_once(cfg, chunks, args.out, out_dir, not args.no_cache, args.debug))

    regenerated = False
    if new_rate is not None:
        clamped = min(max(new_rate, 0.85), 1.25)
        print(f"\n台本が長いため話速を {cfg['rate']} → {clamped:.2f} に上げて作り直します。")
        if abs(clamped - new_rate) > 1e-6:
            warns.append(f"話速の上限（{clamped:.2f}）に達しました。台本を約"
                         f"{round((new_rate - clamped) * cfg['target_seconds'] * cfg['ja_chars_per_sec'])}文字短くしてください。")
        cfg["rate"] = round(clamped, 3)
        chunks, _ = build_chunks(raw, cfg)
        actual, warns2, _ = asyncio.run(
            run_once(cfg, chunks, args.out, out_dir, not args.no_cache, args.debug, final=True))
        warns += warns2
        regenerated = True

    warnings += warns
    print_summary(chunks, actual, cfg["target_seconds"], warnings)
    report = write_report(cfg, chunks, actual, warnings, regenerated, out_dir)
    print(f"\n音声: {args.out}\nレポート: {report}\nチャンク: {out_dir / 'parts'}/")


if __name__ == "__main__":
    main()
