// Vercel serverless proxy for Modellix.
// The browser calls our own /api/* — this function injects the API key
// (from the server-side MODELLIX_KEY env var) and forwards to Modellix,
// so the key is NEVER shipped to the client.
//
// Configure the key in:
//   - local dev : .env.local            ->  MODELLIX_KEY=...
//   - production: Vercel → Settings → Environment Variables → MODELLIX_KEY

export default async function handler(req, res) {
  const key = process.env.MODELLIX_KEY
  if (!key) {
    res.status(500).json({ message: 'MODELLIX_KEY is not configured on the server.' })
    return
  }

  // /api/v1/foo  ->  https://api.modellix.ai/api/v1/foo
  const path = req.url.replace(/^\/api/, '')
  const target = 'https://api.modellix.ai/api' + path

  const init = { method: req.method, headers: { Authorization: `Bearer ${key}` } }
  if (!['GET', 'HEAD'].includes(req.method)) {
    init.headers['Content-Type'] = 'application/json'
    init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {})
  }

  try {
    const r = await fetch(target, init)
    const body = await r.text()
    res.status(r.status)
    res.setHeader('Content-Type', r.headers.get('content-type') || 'application/json')
    res.send(body)
  } catch (e) {
    res.status(502).json({ message: 'Proxy error: ' + e.message })
  }
}
