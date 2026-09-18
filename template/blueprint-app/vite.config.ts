import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const base = process.env.VITE_BASE_PATH ?? "./";
const port = Number(process.env.VITE_DEV_PORT || 5173);

export default defineConfig({
  plugins: [react()],
  base,
  server: {
    port,
    strictPort: true,
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/@netapp/blueprint")) {
            return id.includes("/icons/") ? "blueprint-icons" : "blueprint";
          }
        },
      },
    },
  },
});
