#!/usr/bin/env python3
"""
Local CORS proxy for the Modellix GPT Image 2 Edit try-on demo.

Only needed if you double-click modellix_tryon_demo.html and the browser
console shows a CORS error (Access-Control-Allow-Origin / "Failed to fetch").

Usage:
    python3 proxy.py
    # then open  http://localhost:8787/modellix_tryon_demo.html

This server:
  1. Serves the demo HTML file at /modellix_tryon_demo.html (and / )
  2. Forwards API requests (including multipart media uploads) to
     https://api.modellix.ai with CORS headers,
     so the demo can be tweaked to point at  http://localhost:8787  instead.

The HTML automatically uses /api/v1 when opened from this local server.
"""
import http.server
import socketserver
import urllib.request
import urllib.error
import os
import sys

PORT = 8787
UPSTREAM = 'https://api.modellix.ai'
HERE = os.path.dirname(os.path.abspath(__file__))
MAX_REQUEST_BYTES = 25 * 1024 * 1024


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=HERE, **kwargs)

    def _add_cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')

    def end_headers(self):
        self._add_cors()
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def _proxy(self, method):
        path = self.path
        if not path.startswith('/api/'):
            # Serve static (the demo HTML, etc.)
            if method == 'GET':
                return super().do_GET()
            self.send_error(404)
            return
        url = UPSTREAM + path
        body = None
        length = self.headers.get('Content-Length')
        if length:
            content_length = int(length)
            if content_length > MAX_REQUEST_BYTES:
                self.send_error(413, 'Request body exceeds 25 MB')
                return
            body = self.rfile.read(content_length)
        req = urllib.request.Request(url, data=body, method=method)
        for h in ('Authorization', 'Content-Type'):
            v = self.headers.get(h)
            if v:
                req.add_header(h, v)
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                payload = r.read()
                self.send_response(r.status)
                ct = r.headers.get('Content-Type', 'application/json')
                self.send_header('Content-Type', ct)
                self.end_headers()
                self.wfile.write(payload)
        except urllib.error.HTTPError as e:
            payload = e.read()
            self.send_response(e.code)
            self.send_header('Content-Type', e.headers.get('Content-Type', 'application/json'))
            self.end_headers()
            self.wfile.write(payload)
        except Exception as e:
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(f'{{"code":-1,"message":"proxy error: {e}"}}'.encode())

    def do_GET(self):
        if self.path == '/':
            self.path = '/modellix_tryon_demo.html'
        if self.path.startswith('/api/'):
            return self._proxy('GET')
        return super().do_GET()

    def do_POST(self):
        return self._proxy('POST')


def main():
    with socketserver.ThreadingTCPServer(('127.0.0.1', PORT), Handler) as httpd:
        print('Modellix GPT Image 2 Edit demo proxy running:')
        print(f'  Demo:   http://localhost:{PORT}/')
        print(f'  Proxy:  http://localhost:{PORT}/api/...  →  {UPSTREAM}/api/...')
        print('Press Ctrl+C to stop.')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nStopped.')


if __name__ == '__main__':
    main()
