import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  console.log('[VITE] cwd', process.cwd());
  console.log('[VITE] mode', mode);
  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        // Proxy /api/* requests to backend server
        // Using 127.0.0.1 instead of localhost to avoid IPv6 ::1 resolution issues
        "/api": {
          target: "http://127.0.0.1:3010",
          changeOrigin: true,
          secure: false,
        },
        "/ws": {
          target: "ws://127.0.0.1:3010",
          ws: true,
        },
      },
    },
  };
});
