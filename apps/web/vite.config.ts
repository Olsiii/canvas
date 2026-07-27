import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5183,
    proxy: {
      "/trpc": "http://localhost:3001",
      "/auth": "http://localhost:3001",
      "/uploads": "http://localhost:3001",
      "/image-versions": "http://localhost:3001",
      "/imports": "http://localhost:3001",
      "/scim": "http://localhost:3001",
      "/export": "http://localhost:3001",
      "/ws": { target: "ws://localhost:3001", ws: true },
    },
  },
});
