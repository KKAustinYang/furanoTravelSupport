import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// Multi-page build:  /  → showcase,  /tourism.html → tourism AI demo.
// Dev proxy forwards /api → Modellix and injects the server-side key
// (mirrors the production serverless proxy in api/[...path].js).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const key = env.MODELLIX_KEY || ''
  const gptbotsKey = env.GPTBOTS_API_KEY || ''
  const gptbotsEndpoint = env.GPTBOTS_ENDPOINT || 'https://api-jp.gptbots.ai'
  // EngageLab MA（緊急SMSのトリガー = ユーザー属性の切り替え）。Basic 認証。
  const maBase = env.ENGAGELAB_MA_BASE_URL || 'https://ma-api.engagelab.com'
  const maAuth = env.ENGAGELAB_MA_API_KEY && env.ENGAGELAB_MA_API_SECRET
    ? Buffer.from(`${env.ENGAGELAB_MA_API_KEY}:${env.ENGAGELAB_MA_API_SECRET}`).toString('base64')
    : ''
  return {
    plugins: [
      react(),
      {
        // /api/mail/* はローカルでも本番と同じ関数（api/proxy.js）で処理する。
        // dev proxy は外部への中継しかできないため、ここだけ Vite 側で受ける。
        name: 'local-mail-endpoint',
        configureServer(server) {
          server.middlewares.use('/api/mail', async (req, res) => {
            let raw = ''
            req.on('data', (c) => (raw += c))
            req.on('end', async () => {
              const { default: handler } = await server.ssrLoadModule('/api/proxy.js')
              const shim = {
                statusCode: 200,
                status(c) { this.statusCode = c; return this },
                setHeader(k, v) { res.setHeader(k, v); return this },
                json(b) { res.statusCode = this.statusCode; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(b)) },
                send(b) { res.statusCode = this.statusCode; res.end(b) },
              }
              await handler({ method: req.method, url: '/api/proxy?__path=mail/send', headers: req.headers, body: raw }, shim)
            })
          })
        },
      },
    ],
    build: {
      rollupOptions: {
        input: {
          main: fileURLToPath(new URL('./index.html', import.meta.url)),
          tourism: fileURLToPath(new URL('./tourism.html', import.meta.url)),
        },
      },
    },
    server: {
      proxy: {
        // 本番の api/proxy.js と同じ振り分け。'/api' より先に置くこと。
        '/api/ma': {
          target: maBase,
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/api\/ma/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (maAuth) proxyReq.setHeader('Authorization', 'Basic ' + maAuth)
            })
          },
        },
        '/api/gptbots': {
          target: gptbotsEndpoint,
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/api\/gptbots/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (gptbotsKey) proxyReq.setHeader('Authorization', 'Bearer ' + gptbotsKey)
            })
          },
        },
        '/api': {
          target: 'https://api.modellix.ai',
          changeOrigin: true,
          secure: true,
          followRedirects: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              // 本番の api/proxy.js と同じ優先順位。
              // 画面から渡された鍵があればそれを使い、無ければサーバー側の鍵を使う。
              const fromClient = req.headers['x-modellix-key']
              if (fromClient) proxyReq.setHeader('Authorization', 'Bearer ' + fromClient)
              else if (key) proxyReq.setHeader('Authorization', 'Bearer ' + key)
              proxyReq.removeHeader('x-modellix-key')
            })
            proxy.on('proxyRes', (proxyRes) => {
              const loc = proxyRes.headers['location']
              if (loc) {
                try {
                  const u = new URL(loc, 'https://api.modellix.ai')
                  proxyRes.headers['location'] = u.pathname + u.search
                } catch {
                  /* already relative */
                }
              }
            })
          },
        },
      },
    },
  }
})
