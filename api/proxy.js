// Server-side proxy for Modellix (MaaS).
//
// The browser only ever calls our OWN origin: /api/v1/...  vercel.json rewrites
// every /api/* request (any depth) to this single function, which injects the
// secret key and forwards to https://api.modellix.ai/api/*.
//
// The key lives ONLY on the server — it is never shipped to the browser:
//   - local dev : .env.local            ->  MODELLIX_KEY=...   (via the Vite dev proxy)
//   - production: Vercel → Settings → Environment Variables → MODELLIX_KEY
//
// Why a plain function + rewrite instead of api/[...path].js?
// Vercel's catch-all ([...path]) detection under the Vite preset is unreliable
// and was 404-ing in production. A normal function targeted by an explicit
// rewrite in vercel.json is routed deterministically.

const UPSTREAM = 'https://api.modellix.ai'

export default async function handler(req, res) {
  const key = process.env.MODELLIX_KEY
  if (!key) {
    res.status(500).json({ message: 'MODELLIX_KEY is not configured on the server.' })
    return
  }

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

  const target = `${UPSTREAM}/api${suffix}`

  const init = {
    method: req.method,
    headers: { Authorization: `Bearer ${key}` },
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
