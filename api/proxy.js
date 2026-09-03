// Server-side proxy for Modellix (MaaS).
//
// The browser only ever calls our OWN origin: /api/v1/...  vercel.json rewrites
// every /api/* request (any depth) to this single function, which injects the
// secret key and forwards to https://api.modellix.ai/api/*.
//
// Two ways to authenticate, in this order:
//   1. X-Modellix-Key header — the caller (customer) supplies their OWN key.
//      Used by demos where the customer pays for their own generations.
//      The key is only relayed: it is never logged, stored, or echoed back.
//   2. MODELLIX_KEY on the server — our own key, for demos we host and pay for.
//      - local dev : .env.local            ->  MODELLIX_KEY=...   (via the Vite dev proxy)
//      - production: Vercel → Settings → Environment Variables → MODELLIX_KEY
// Never accept a key from the query string: URLs end up in logs and history.
//
// Why a plain function + rewrite instead of api/[...path].js?
// Vercel's catch-all ([...path]) detection under the Vite preset is unreliable
// and was 404-ing in production. A normal function targeted by an explicit
// rewrite in vercel.json is routed deterministically.

import { sendTicketMail } from './_mail.js'

const UPSTREAM = 'https://api.modellix.ai'

// GPTBots も同じ関数から中継する。vercel.json の rewrite が /api/* を全部ここへ
// 送るため、専用の関数を足すとルーティングが競合する。プレフィックスで振り分ける。
//   /api/gptbots/v1/conversation  ->  https://api-jp.gptbots.ai/v1/conversation
const GPTBOTS_PREFIX = 'gptbots/'

// EngageLab MA（マーケティングオートメーション）も同じ関数から中継する。
//   /api/ma/v1/event/report  ->  https://ma-api.engagelab.com/v1/event/report
// 認証は Bearer ではなく Basic base64(APIKey:APISecret)。鍵はサーバー側だけに置く。
//   ENGAGELAB_MA_API_KEY / ENGAGELAB_MA_API_SECRET
// 既定はシンガポールDC。US Virginia を使う場合だけ ENGAGELAB_MA_BASE_URL を設定する。
const MA_PREFIX = 'ma/'

// Modellix の LLM ゲートウェイは画像・動画の API とホストが別。
//   /api/llm/v1/chat/completions  ->  https://llm.modellix.ai/v1/chat/completions
// 鍵は MODELLIX_KEY を共用する（同じアカウントの API キー）。
const LLM_PREFIX = 'llm/'
const LLM_BASE = 'https://llm.modellix.ai'

// 生成結果の画像は、**必ず法定表記とロゴを焼き込んでから**ブラウザに渡す。
//   /api/stamped/aigc/image/xxx.png  ->  https://file.modellix.ai/... を取得 → 合成 → JPEG
// 素の生成画像を返す経路は用意しない（外に出るのは合成後だけ、という前提を守る）。
// ホストは固定・GET のみ・認証ヘッダは付けない（任意のURLを踏ませない）。
const STAMP_PREFIX = 'stamped/'
const FILE_BASE = 'https://file.modellix.ai'

// 生成した音声はブラウザ側で長さを測って結合する（Web Audio）。CDN は CORS ヘッダを
// 返さないため、そのままでは fetch できない。音声だけ読み取り中継する。
//   /api/audio/aigc/audio/xxx.mp3  ->  https://file.modellix.ai/aigc/audio/xxx.mp3
// 画像は対象外（Content-Type で弾く）。画像は必ず /api/stamped を通す、という前提を崩さない。
const AUDIO_PREFIX = 'audio/'

function maBase() {
  const v = (process.env.ENGAGELAB_MA_BASE_URL || '').trim().replace(/\/+$/, '')
  return v || 'https://ma-api.engagelab.com'
}

// 送り先は既定で日本リージョン。上書きしたい場合だけ GPTBOTS_BASE_URL を設定する。
// （汎用的な名前の GPTBOTS_ENDPOINT は他用途で使われていることがあるので読まない）
// 'jp' のようなリージョン名でも、フルURLでも受け付ける。
function gptbotsBase() {
  const v = (process.env.GPTBOTS_BASE_URL || '').trim().replace(/\/+$/, '')
  if (!v) return 'https://api-jp.gptbots.ai'
  if (/^https?:\/\//i.test(v)) return v
  if (/^[a-z]{2,4}$/i.test(v)) return `https://api-${v.toLowerCase()}.gptbots.ai`
  return `https://${v}`
}

// Header values must be safe to put on the wire. Anything outside printable
// ASCII (or an implausible length) is a mistake or an injection attempt.
const KEY_RE = /^[\x21-\x7e]{16,200}$/

export default async function handler(req, res) {
  const clientKey = req.headers['x-modellix-key']
  if (clientKey != null && !KEY_RE.test(String(clientKey))) {
    res.status(400).json({ message: 'X-Modellix-Key is not a valid API key.' })
    return
  }

  const key = clientKey ? String(clientKey) : process.env.MODELLIX_KEY

  // Reconstruct the upstream path. The rewrite passes the captured segments as
  // ?__path=v1/tasks/test; we prefer that and fall back to req.url for safety.
  const reqUrl = new URL(req.url, 'http://internal')
  const fromRewrite = reqUrl.searchParams.get('__path')
  reqUrl.searchParams.delete('__path')

  let suffix
  if (fromRewrite != null) {
    const qs = reqUrl.searchParams.toString()
    suffix = '/' + fromRewrite + (qs ? '?' + qs : '')
  } else {
    // e.g. /api/v1/tasks/test?x=1  ->  /v1/tasks/test?x=1
    suffix = reqUrl.pathname.replace(/^\/api/, '') + (reqUrl.search || '')
  }

  // GPTBots 宛てか、Modellix 宛てか、メール送信かをパスの先頭で決める
  const path = suffix.replace(/^\//, '')

  // /api/mail/send — 中継ではなく、この関数自身がメールを送る
  if (path.startsWith('mail/')) {
    if (req.method !== 'POST') {
      res.status(405).json({ message: 'Method not allowed.' })
      return
    }
    try {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
      const result = await sendTicketMail(payload)
      res.status(200).json({ ok: true, ...result })
    } catch (e) {
      res.status(500).json({ message: 'Mail error: ' + e.message })
    }
    return
  }

  // /api/audio/* — 生成音声の読み取り中継。音声以外は返さない。
  if (path.startsWith(AUDIO_PREFIX)) {
    if (req.method !== 'GET') {
      res.status(405).json({ message: 'Method not allowed.' })
      return
    }
    const rel = path.slice(AUDIO_PREFIX.length).split('?')[0]
    if (!/^[A-Za-z0-9._\-/]+$/.test(rel) || rel.includes('..')) {
      res.status(400).json({ message: 'Invalid file path.' })
      return
    }
    try {
      const upstream = await fetch(`${FILE_BASE}/${rel}`)
      const ct = upstream.headers.get('content-type') || ''
      if (!upstream.ok) {
        res.status(upstream.status).json({ message: `Upstream ${upstream.status}` })
        return
      }
      if (!/^audio\//i.test(ct)) {
        res.status(415).json({ message: 'この経路は音声のみ中継します。' })
        return
      }
      res.status(200)
      res.setHeader('Content-Type', ct)
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable')
      const { Readable } = await import('node:stream')
      if (upstream.body) Readable.fromWeb(upstream.body).pipe(res)
      else res.end()
    } catch (e) {
      res.status(502).json({ message: `Proxy error (upstream: file.modellix.ai): ${e.message}` })
    }
    return
  }

  // /api/stamped/* — 生成結果を取得し、法定表記バーとロゴを焼き込んで返す。
  if (path.startsWith(STAMP_PREFIX)) {
    if (req.method !== 'GET') {
      res.status(405).json({ message: 'Method not allowed.' })
      return
    }
    const rel = path.slice(STAMP_PREFIX.length).split('?')[0]
    if (!/^[A-Za-z0-9._\-/]+$/.test(rel) || rel.includes('..')) {
      res.status(400).json({ message: 'Invalid file path.' })
      return
    }
    try {
      const upstream = await fetch(`${FILE_BASE}/${rel}`)
      if (!upstream.ok) {
        res.status(upstream.status).json({ message: `Upstream ${upstream.status}` })
        return
      }
      const { stamp } = await import('./_stamp.js')
      const out = await stamp(Buffer.from(await upstream.arrayBuffer()))
      res.status(200)
      res.setHeader('Content-Type', 'image/jpeg')
      // 同じ生成結果は何度も見られる。焼き込みは決定的なのでキャッシュしてよい。
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable')
      res.send(out)
    } catch (e) {
      res.status(502).json({ message: `Stamp error: ${e.message}` })
    }
    return
  }

  const toGptbots = path.startsWith(GPTBOTS_PREFIX)
  const toMa = path.startsWith(MA_PREFIX)
  const toLlm = path.startsWith(LLM_PREFIX)

  let target, auth, authScheme = 'Bearer'
  if (toLlm) {
    if (!key) {
      res.status(401).json({ message: 'API key is missing. Set it in the demo, or configure MODELLIX_KEY on the server.' })
      return
    }
    target = `${LLM_BASE}/${path.slice(LLM_PREFIX.length)}`
    auth = key
  } else if (toMa) {
    const apiKey = process.env.ENGAGELAB_MA_API_KEY
    const secret = process.env.ENGAGELAB_MA_API_SECRET
    if (!apiKey || !secret) {
      res.status(500).json({ message: 'ENGAGELAB_MA_API_KEY / ENGAGELAB_MA_API_SECRET are not configured on the server.' })
      return
    }
    target = `${maBase()}/${path.slice(MA_PREFIX.length)}`
    auth = Buffer.from(`${apiKey}:${secret}`).toString('base64')
    authScheme = 'Basic'
  } else if (toGptbots) {
    const gptbotsKey = process.env.GPTBOTS_API_KEY
    if (!gptbotsKey) {
      res.status(500).json({ message: 'GPTBOTS_API_KEY is not configured on the server.' })
      return
    }
    target = `${gptbotsBase()}/${path.slice(GPTBOTS_PREFIX.length)}`
    auth = gptbotsKey
  } else {
    if (!key) {
      res.status(401).json({ message: 'API key is missing. Set it in the demo, or configure MODELLIX_KEY on the server.' })
      return
    }
    target = `${UPSTREAM}/api${suffix}`
    auth = key
  }

  const init = {
    method: req.method,
    headers: { Authorization: `${authScheme} ${auth}` },
  }
  if (!['GET', 'HEAD'].includes(req.method)) {
    init.headers['Content-Type'] = req.headers['content-type'] || 'application/json'
    init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {})
  }

  try {
    const upstream = await fetch(target, init)
    const ct = upstream.headers.get('content-type') || 'application/json'
    res.status(upstream.status)
    res.setHeader('Content-Type', ct)

    // SSE はバッファせずそのまま流す。溜めてから返すとストリーミングの意味が無い。
    if (/text\/event-stream/i.test(ct) && upstream.body) {
      res.setHeader('Cache-Control', 'no-cache, no-transform')
      res.setHeader('Connection', 'keep-alive')
      res.setHeader('X-Accel-Buffering', 'no')   // プロキシ側のバッファリング抑止
      const { Readable } = await import('node:stream')
      Readable.fromWeb(upstream.body).pipe(res)
      return
    }

    const body = await upstream.text()
    res.send(body)
  } catch (e) {
    // 次の切り分けが一発で済むよう、宛先ホストと理由を返す（鍵は含めない）
    let host = ''
    try { host = new URL(target).host } catch {}
    res.status(502).json({ message: `Proxy error (upstream: ${host}): ${e.message}` })
  }
}
