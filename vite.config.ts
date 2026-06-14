import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  // In dev, proxy /api → backend so the browser stays same-origin (no CORS
  // dance for cookies/auth). Override the target with VITE_API_PROXY_TARGET.
  const apiTarget = env.VITE_API_PROXY_TARGET || "http://localhost:8080";

  return {
    plugins: [react()],
    base: "/quicksilver/",
    server: {
      port: 3000,
      open: true,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      outDir: "build",
      sourcemap: true,
    },
  };
});
