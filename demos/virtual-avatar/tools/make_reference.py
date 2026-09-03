#!/usr/bin/env python3
"""参照音声（クローン元）を1本つくるだけの補助スクリプト。

  python make_reference.py --out reference.mp3

本番では「話者ご本人が静かな環境で10〜30秒読んだ音声」を使う。
このスクリプトは、手元に音源が無い状態で動作確認するための代用。
system voice の cosyvoice-v3-plus で合成し、Modellix の結果URL
（file.modellix.ai・公開アクセス可）をそのままクローン元に使える。
"""
import argparse, json, os, sys, time, urllib.request

API = "https://api.modellix.ai/api/v1"
TEXT = ("こんにちは。本日は物件のご紹介をさせていただきます。"
        "落ち着いた雰囲気の住まいを、順番にご覧いただきます。"
        "どうぞ最後までお付き合いください。")


def call(method, path, body=None):
    key = os.environ.get("MODELLIX_API_KEY") or sys.exit("MODELLIX_API_KEY が未設定です")
    req = urllib.request.Request(
        f"{API}{path}", method=method,
        data=json.dumps(body).encode() if body else None,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="reference.mp3")
    ap.add_argument("--voice", default="longanyang")
    ap.add_argument("--text", default=TEXT)
    args = ap.parse_args()

    res = call("POST", "/alibaba/cosyvoice-v3-plus", {
        "text": args.text, "voice": args.voice, "language_hint": "ja",
        "format": "mp3", "sample_rate": 24000, "rate": 1.0,
    })
    task_id = res["data"]["task_id"]
    print("task:", task_id)
    for _ in range(60):
        time.sleep(2)
        data = call("GET", f"/tasks/{task_id}").get("data", {})
        if data.get("status") == "success":
            print(json.dumps(data, ensure_ascii=False, indent=2)[:900])
            url = data["result"]["resources"][0]["url"]
            urllib.request.urlretrieve(url, args.out)
            print(f"\n保存: {args.out}\n参照URL: {url}")
            return
        if data.get("status") == "failed":
            sys.exit(json.dumps(data, ensure_ascii=False)[:400])
    sys.exit("タイムアウト")


if __name__ == "__main__":
    main()
