import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://markduek.github.io",
  trailingSlash: "always",
  build: { inlineStylesheets: "always" },
  devToolbar: { enabled: false },
});
