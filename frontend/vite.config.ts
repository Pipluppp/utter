import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Active local runtime is the Cloudflare API Worker.
// Override with BACKEND_ORIGIN only when intentionally targeting another backend.
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:8787";

export default defineConfig({
  plugins: [tanstackRouter({ autoCodeSplitting: true }), react(), tailwindcss()],
  build: {
    // Never inline JS assets as data: URIs — AudioWorklet modules loaded via
    // `new URL(…, import.meta.url)` must be served as real files so they
    // satisfy the Content-Security-Policy `script-src 'self'` directive.
    assetsInlineLimit: (filePath: string) => {
      if (filePath.endsWith(".js")) return false;
      // Fall through to Vite default (4096) for other asset types
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    allowedHosts: [".trycloudflare.com"],
    proxy: {
      "/api": {
        target: BACKEND_ORIGIN,
        changeOrigin: true,
        headers: {
          "x-forwarded-proto": "http",
          "x-forwarded-host": "127.0.0.1:5173",
        },
      },
    },
  },
});
