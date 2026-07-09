import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the built files also work from file:// inside
  // the Android WebView, not just from a web server root.
  base: "./",
  server: { port: 5190 },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        ime: resolve(__dirname, "ime.html"),
      },
    },
  },
});
