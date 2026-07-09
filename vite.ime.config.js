import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "path";

// Builds ime.html into ONE self-contained file (all JS + CSS inlined) so the
// Android WebView can load it from file:// without any blocked module fetches.
// Writes into the same dist/ as the demo build; emptyOutDir stays off so it
// does not wipe the demo output.
export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile()],
  build: {
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, "ime.html"),
    },
  },
});
