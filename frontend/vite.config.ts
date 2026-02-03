import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const FASTAPI_ORIGIN = process.env.FASTAPI_ORIGIN ?? 'http://localhost:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: FASTAPI_ORIGIN, changeOrigin: true },
      '/uploads': { target: FASTAPI_ORIGIN, changeOrigin: true },
      '/static': { target: FASTAPI_ORIGIN, changeOrigin: true },
    },
  },
})
