import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// Multi-page build:  /  → showcase,  /tourism.html → tourism AI demo.
// Dev proxy forwards /api → Modellix and injects the server-side key
// (mirrors the production serverless proxy in api/[...path].js).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const key = env.MODELLIX_KEY || ''
  return {
    plugins: [react()],
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
