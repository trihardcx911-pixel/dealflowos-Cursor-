import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BACKEND_PORT = Number(process.env.VITE_API_PORT ?? 3000)

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: `http://localhost:${BACKEND_PORT}`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})





