import { defineConfig } from "vite";
export default defineConfig({
  root: "apps/client",
  server: {
    host: "0.0.0.0",
    proxy: { "/socket.io": { target: "http://localhost:3000", ws: true } },
  },
  build: { outDir: "../../dist/client", emptyOutDir: true },
});
