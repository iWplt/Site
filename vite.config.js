import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API_PORT = process.env.PORT || 3001;

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
});
