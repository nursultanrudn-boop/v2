import { defineConfig } from "vite";
import { cpSync } from "node:fs";
import { resolve } from "node:path";

// Копируем js/ в dist/js/, так как <script src="js/..."> — классические
// скрипты без type="module", и Vite не подхватывает их сам.
function copyJsDir() {
  return {
    name: "copy-js-dir",
    closeBundle() {
      cpSync(resolve(__dirname, "js"), resolve(__dirname, "dist/js"), { recursive: true });
    },
  };
}

export default defineConfig({
  appType: "mpa",
  plugins: [copyJsDir()],
  build: {
    rollupOptions: {
      input: [
        "index.html",
        "cases.html",
        "case-notation-settings.html",
        "case-process-map.html",
        "case-licenses.html",
        "case-lct-hackathon.html",
      ],
    },
  },
});
