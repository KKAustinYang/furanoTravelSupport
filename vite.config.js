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
        name: 'local-node-endpoints',
        configureServer(server) {
          // X-Modellix-Byok: 1 は「お客様の鍵でしか動かさない」という宣言。
          // 本番は api/proxy.js が弾くが、dev では /api/v1/* が下の proxy を通って
          // しまうため、ここでも同じ条件で止める。dev と本番で挙動を変えない。
          server.middlewares.use('/api', (req, res, next) => {
            const byok = /^(1|true|yes)$/i.test(String(req.headers['x-modellix-byok'] || ''))
            if (byok && !req.headers['x-modellix-key']) {
              res.statusCode = 401
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ message: 'This demo requires your own Modellix API key.' }))
              return
            }
            next()
          })

          // /api/stamped/* は画像を合成して返すので、単なる中継では足りない。
          // 本番と同じ関数（api/proxy.js）をローカルでも呼ぶ。
          server.middlewares.use('/api/stamped', async (req, res) => {
            const { default: handler } = await server.ssrLoadModule('/api/proxy.js')
            const rel = (req.url || '/').replace(/^\//, '')
            const shim = {
              statusCode: 200,
              status(c) { this.statusCode = c; return this },
              setHeader(k, v) { res.setHeader(k, v); return this },
              json(b) { res.statusCode = this.statusCode; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(b)) },
              send(b) { res.statusCode = this.statusCode; res.end(b) },
              end() { res.end() },
            }
            await handler({ method: req.method, url: '/api/proxy?__path=' + encodeURIComponent('stamped/' + rel), headers: req.headers }, shim)
          })

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
        // 生成音声の読み取り中継（Web Audio で結合するため）。'/api' より先に置くこと。
        '/api/audio': {
          target: 'https://file.modellix.ai',
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/api\/audio/, ''),
        },
        // LLM ゲートウェイは別ホスト。'/api' より先に置くこと。
        '/api/llm': {
          target: 'https://llm.modellix.ai',
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/api\/llm/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              const fromClient = req.headers['x-modellix-key']
              if (fromClient) proxyReq.setHeader('Authorization', 'Bearer ' + fromClient)
              else if (key) proxyReq.setHeader('Authorization', 'Bearer ' + key)
              proxyReq.removeHeader('x-modellix-key')
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
