import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
	assetsInlineLimit: 0,
    assetsDir: "assets",
    copyPublicDir: false,
    emptyOutDir: true,
    manifest: "manifest.json",
    outDir: "../../internal/webui/assets/generated",
    sourcemap: false,
    target: "es2022",
  },
});
