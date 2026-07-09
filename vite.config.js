import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Demo site build (index.html). The Android keyboard page is built separately
// as a single self-contained file by vite.ime.config.js.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { port: 5190 },
});
