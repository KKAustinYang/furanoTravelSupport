"""内見動画の結合サービス（Cloud Run / Python + ffmpeg）

生成済みクリップの URL を受け取り、ffmpeg で 1 本に結合して指定倍速に変換し、
mp4 のバイト列をそのまま返す。ストレージは使わない（保存は呼び出し側の責任）。

  POST /concat
    {"clips": ["https://.../01.mp4", ...], "speed": 2.0}
    -> 200 video/mp4

依存パッケージはゼロ（標準ライブラリのみ）。処理の実体は ffmpeg の
サブプロセス呼び出しなので、Web フレームワークを挟む利点が無く、
イメージが小さいぶんコールドスタートも速い。

環境変数（すべて任意）:
  PORT                  待ち受けポート（Cloud Run が渡す。既定 8080）
  ALLOWED_ORIGINS       CORS 許可オリジン。カンマ区切り。既定 "*"
  ALLOWED_HOST_SUFFIXES 取得を許可するホストのサフィックス。カンマ区切り。
                        未設定なら任意の https ホストを許可（推奨は設定すること）
  AUTH_TOKEN            設定すると X-Concat-Token ヘッダの一致を要求する
  MAX_CLIPS             既定 24
  MAX_CLIP_MB           1 クリップの上限。既定 80
  MAX_TOTAL_MB          合計の上限。既定 800
  OUT_WIDTH / OUT_HEIGHT/ OUT_FPS  出力の正規化。既定 1280x720 / 30fps
  FFMPEG_TIMEOUT        ffmpeg のタイムアウト秒。既定 480
"""

import ipaddress
import json
import logging
import os
import re
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
    stream=sys.stdout,
)
log = logging.getLogger('concat')


def _env_int(name, default):
    try:
        return int(os.environ.get(name, ''))
    except ValueError:
        return default


PORT = _env_int('PORT', 8080)
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get('ALLOWED_ORIGINS', '*').split(',') if o.strip()]
ALLOWED_HOST_SUFFIXES = [h.strip().lower() for h in os.environ.get('ALLOWED_HOST_SUFFIXES', '').split(',') if h.strip()]
AUTH_TOKEN = os.environ.get('AUTH_TOKEN', '')
MAX_CLIPS = _env_int('MAX_CLIPS', 24)
MAX_CLIP_BYTES = _env_int('MAX_CLIP_MB', 80) * 1024 * 1024
MAX_TOTAL_BYTES = _env_int('MAX_TOTAL_MB', 800) * 1024 * 1024
OUT_WIDTH = _env_int('OUT_WIDTH', 1280)
OUT_HEIGHT = _env_int('OUT_HEIGHT', 720)
OUT_FPS = _env_int('OUT_FPS', 30)
FFMPEG_TIMEOUT = _env_int('FFMPEG_TIMEOUT', 480)
DOWNLOAD_TIMEOUT = _env_int('DOWNLOAD_TIMEOUT', 60)

SPEED_MIN, SPEED_MAX = 0.5, 4.0


class BadRequest(Exception):
    """呼び出し側の入力が不正。4xx を返す。"""


# ---------------------------------------------------------------- 入力の検証

def check_url(raw):
    """取得先として安全な URL かを確かめる。

    公開エンドポイントなので、社内ネットワークや metadata サーバーを
    踏ませる SSRF を防ぐ必要がある。名前解決まで行って私的アドレスを弾く。
    """
    u = urlsplit(raw)
    if u.scheme != 'https':
        raise BadRequest(f'https 以外は受け付けません: {raw[:80]}')
    host = (u.hostname or '').lower()
    if not host:
        raise BadRequest('ホスト名がありません')

    if ALLOWED_HOST_SUFFIXES:
        if not any(host == s or host.endswith('.' + s) for s in ALLOWED_HOST_SUFFIXES):
            raise BadRequest(f'許可されていないホストです: {host}')

    try:
        infos = socket.getaddrinfo(host, 443, proto=socket.IPPROTO_TCP)
    except socket.gaierror as e:
        raise BadRequest(f'名前解決に失敗しました: {host} ({e})')
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise BadRequest(f'内部アドレスへのアクセスは禁止です: {host}')
    return raw


def parse_body(raw):
    try:
        body = json.loads(raw.decode('utf-8'))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise BadRequest('JSON として読めません')
    if not isinstance(body, dict):
        raise BadRequest('JSON オブジェクトを渡してください')

    clips = body.get('clips')
    if not isinstance(clips, list) or not clips:
        raise BadRequest('clips に URL の配列を渡してください')
    if len(clips) > MAX_CLIPS:
        raise BadRequest(f'クリップが多すぎます（最大 {MAX_CLIPS} 本）')
    urls = []
    for c in clips:
        if not isinstance(c, str):
            raise BadRequest('clips の要素は文字列である必要があります')
        urls.append(check_url(c.strip()))

    speed = body.get('speed', 1.0)
    try:
        speed = float(speed)
    except (TypeError, ValueError):
        raise BadRequest('speed は数値で指定してください')
    if not (SPEED_MIN <= speed <= SPEED_MAX):
        raise BadRequest(f'speed は {SPEED_MIN}〜{SPEED_MAX} の範囲で指定してください')

    # 各クリップの頭から指定秒だけ使う（省略なら全尺）。
    # 生成 API は 6 秒か 10 秒しか作れないので、5 秒に揃えたい場合はここで切る。
    clip_seconds = body.get('clip_seconds')
    if clip_seconds not in (None, '', 0):
        try:
            clip_seconds = float(clip_seconds)
        except (TypeError, ValueError):
            raise BadRequest('clip_seconds は数値で指定してください')
        if not (0.5 <= clip_seconds <= 60):
            raise BadRequest('clip_seconds は 0.5〜60 の範囲で指定してください')
    else:
        clip_seconds = None

    return urls, speed, clip_seconds


# ---------------------------------------------------------------- 取得と結合

def download(url, dest, budget):
    """クリップを 1 本落とす。上限を超えた時点で打ち切る。"""
    req = urllib.request.Request(url, headers={'User-Agent': 'video-concat/1.0'})
    written = 0
    try:
        with urllib.request.urlopen(req, timeout=DOWNLOAD_TIMEOUT) as res, open(dest, 'wb') as f:
            while True:
                chunk = res.read(256 * 1024)
                if not chunk:
                    break
                written += len(chunk)
                if written > MAX_CLIP_BYTES or written > budget:
                    raise BadRequest('クリップのサイズが上限を超えました')
                f.write(chunk)
    except urllib.error.HTTPError as e:
        raise BadRequest(f'クリップを取得できません（HTTP {e.code}）')
    except urllib.error.URLError as e:
        raise BadRequest(f'クリップを取得できません（{e.reason}）')
    if written == 0:
        raise BadRequest('空のクリップが返りました')
    return written


def build_filter(n, speed, clip_seconds=None):
    """全クリップを同一規格に揃えてから連結し、最後に倍速をかける。

    生成元が同じでも解像度や fps が揃う保証はないため、concat の前に
    scale/pad/fps/setsar で正規化しておく。ここを省くと concat が失敗する。
    """
    trim = f'trim=0:{clip_seconds:g},setpts=PTS-STARTPTS,' if clip_seconds else ''
    parts = []
    for i in range(n):
        parts.append(
            f'[{i}:v]{trim}'
            f'scale={OUT_WIDTH}:{OUT_HEIGHT}:force_original_aspect_ratio=decrease,'
            f'pad={OUT_WIDTH}:{OUT_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black,'
            f'setsar=1,fps={OUT_FPS},format=yuv420p[v{i}]'
        )
    joined = ''.join(f'[v{i}]' for i in range(n))
    parts.append(f'{joined}concat=n={n}:v=1:a=0[cat]')
    parts.append(f'[cat]setpts=PTS/{speed:g}[out]')
    return ';'.join(parts)


def concat(paths, speed, out_path, clip_seconds=None):
    cmd = ['ffmpeg', '-nostdin', '-y', '-hide_banner', '-loglevel', 'error']
    for p in paths:
        cmd += ['-i', str(p)]
    cmd += [
        '-filter_complex', build_filter(len(paths), speed, clip_seconds),
        '-map', '[out]',
        '-an',                       # 音声は落とす（i2v 出力は無音、BGM は後段で載せる想定）
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',   # ブラウザで先頭から再生できるように
        str(out_path),
    ]
    started = time.time()
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=FFMPEG_TIMEOUT)
    except subprocess.TimeoutExpired:
        raise RuntimeError(f'ffmpeg が {FFMPEG_TIMEOUT}s 以内に完了しませんでした')
    if proc.returncode != 0:
        tail = proc.stderr.decode('utf-8', 'replace').strip().splitlines()[-5:]
        raise RuntimeError('ffmpeg が失敗しました: ' + ' / '.join(tail))
    return time.time() - started


def process(urls, speed, clip_seconds=None):
    with tempfile.TemporaryDirectory(prefix='concat-') as tmp:
        tmp = Path(tmp)
        paths, budget = [], MAX_TOTAL_BYTES
        t0 = time.time()
        for i, url in enumerate(urls):
            p = tmp / f'{i:02d}.mp4'
            budget -= download(url, p, budget)
            if budget <= 0:
                raise BadRequest('合計サイズが上限を超えました')
            paths.append(p)
        dl = time.time() - t0

        out = tmp / 'walkthrough.mp4'
        enc = concat(paths, speed, out, clip_seconds)
        data = out.read_bytes()
        log.info('done clips=%d speed=%s trim=%s download=%.1fs encode=%.1fs out=%.1fMB',
                 len(urls), speed, clip_seconds, dl, enc, len(data) / 1024 / 1024)
        return data


# ---------------------------------------------------------------- HTTP

class Handler(BaseHTTPRequestHandler):
    server_version = 'video-concat/1.0'
    protocol_version = 'HTTP/1.1'

    def log_message(self, fmt, *args):   # 既定の stderr 出力を logging に寄せる
        log.info('%s %s', self.address_string(), fmt % args)

    # --- CORS -------------------------------------------------------------
    def cors_origin(self):
        origin = self.headers.get('Origin', '')
        if '*' in ALLOWED_ORIGINS:
            return origin or '*'
        return origin if origin in ALLOWED_ORIGINS else ''

    def send_cors(self):
        origin = self.cors_origin()
        if origin:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')

    def reply(self, code, body, ctype='application/json; charset=utf-8', filename=None):
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        if filename:
            self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
        self.send_cors()
        self.end_headers()
        self.wfile.write(body)

    def error(self, code, message):
        log.warning('%s %s', code, message)
        self.reply(code, json.dumps({'error': message}, ensure_ascii=False).encode('utf-8'))

    # --- routes -----------------------------------------------------------
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors()
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Concat-Token')
        self.send_header('Access-Control-Max-Age', '3600')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_GET(self):
        path = urlsplit(self.path).path
        if path in ('/', '/health'):
            self.reply(200, b'ok', 'text/plain; charset=utf-8')
        else:
            self.error(404, 'not found')

    def do_POST(self):
        if urlsplit(self.path).path != '/concat':
            return self.error(404, 'not found')
        if AUTH_TOKEN and self.headers.get('X-Concat-Token', '') != AUTH_TOKEN:
            return self.error(401, '認証に失敗しました')

        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            return self.error(400, 'Content-Length が不正です')
        if length <= 0 or length > 64 * 1024:
            return self.error(400, 'リクエストボディのサイズが不正です')

        raw = self.rfile.read(length)
        try:
            urls, speed, clip_seconds = parse_body(raw)
            data = process(urls, speed, clip_seconds)
        except BadRequest as e:
            return self.error(400, str(e))
        except Exception as e:                       # ffmpeg 失敗など
            log.exception('concat failed')
            return self.error(500, str(e))

        self.reply(200, data, 'video/mp4', filename='walkthrough.mp4')


def main():
    if not re.match(r'^\d+$', str(PORT)):
        raise SystemExit('PORT が不正です')
    server = ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
    server.daemon_threads = True
    log.info('listening on :%d (max_clips=%d out=%dx%d@%dfps)',
             PORT, MAX_CLIPS, OUT_WIDTH, OUT_HEIGHT, OUT_FPS)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
