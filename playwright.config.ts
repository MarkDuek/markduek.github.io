import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://127.0.0.1:4322",
    browserName: "chromium",
    launchOptions: { args: ["--enable-unsafe-swiftshader"] },
  },
  webServer: {
    // Keep Astro in the foreground so Playwright owns the server lifecycle.
    command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4322 --ignore-lock",
    url: "http://127.0.0.1:4322",
  },
});
