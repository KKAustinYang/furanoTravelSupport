import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative base so the built app works when hosted under a sub-path
  // (embedded in the showcase at /nts-training/).
  base: './',
  plugins: [react()],
  server: { port: 5173, host: true }
})
