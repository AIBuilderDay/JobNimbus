import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// In compose this is `http://backend:8000` (Docker DNS).
// On the host (`task frontend:dev`) it stays `http://localhost:8000`.
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    watch: {
      // bind-mounted source on macOS needs polling for HMR to fire
      usePolling: process.env.VITE_USE_POLLING === "true",
    },
    proxy: {
      "/api": backendUrl,
    },
  },
});
