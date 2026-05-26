import { defineConfig } from "vite";

export default defineConfig({
  appType: "mpa",
  build: {
    rollupOptions: {
      input: [
        "index.html",
        "cases.html",
        "about.html",
        "contacts.html",
        "case-notation-settings.html",
        "case-process-map.html",
        "case-licenses.html",
        "case-lct-hackathon.html",
      ],
    },
  },
});
