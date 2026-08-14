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

const UPSTREAM = 'https://api.modellix.ai'

// GPTBots も同じ関数から中継する。vercel.json の rewrite が /api/* を全部ここへ
// 送るため、専用の関数を足すとルーティングが競合する。プレフィックスで振り分ける。
//   /api/gptbots/v1/conversation  ->  https://api-jp.gptbots.ai/v1/conversation
const GPTBOTS_PREFIX = 'gptbots/'
const GPTBOTS_UPSTREAM = process.env.GPTBOTS_ENDPOINT || 'https://api-jp.gptbots.ai'

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

  // GPTBots 宛てか、Modellix 宛てかをパスの先頭で決める
  const path = suffix.replace(/^\//, '')
  const toGptbots = path.startsWith(GPTBOTS_PREFIX)

  let target, auth
  if (toGptbots) {
    const gptbotsKey = process.env.GPTBOTS_API_KEY
    if (!gptbotsKey) {
      res.status(500).json({ message: 'GPTBOTS_API_KEY is not configured on the server.' })
      return
    }
    target = `${GPTBOTS_UPSTREAM}/${path.slice(GPTBOTS_PREFIX.length)}`
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
    headers: { Authorization: `Bearer ${auth}` },
  }
  if (!['GET', 'HEAD'].includes(req.method)) {
    init.headers['Content-Type'] = req.headers['content-type'] || 'application/json'
    init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {})
  }

  try {
    const upstream = await fetch(target, init)
    const body = await upstream.text()
    res.status(upstream.status)
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
    res.send(body)
  } catch (e) {
    res.status(502).json({ message: 'Proxy error: ' + e.message })
  }
}
