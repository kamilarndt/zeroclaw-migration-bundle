import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  base: "/_app/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
  },
  server: {
    proxy: {
      "/health": {
        target: "http://127.0.0.1:42617",
        changeOrigin: true,
      },
      "/pair": {
        target: "http://127.0.0.1:42617",
        changeOrigin: true,
      },
      "/v1": {
        target: "http://127.0.0.1:42617",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://127.0.0.1:42617",
        ws: true,
      },
    },
  },
});
