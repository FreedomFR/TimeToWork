import { defineConfig } from "@playwright/test";

/**
 * Not part of the test suite: regenerates the screenshots of docs/GUIDE.md.
 *
 *   docker compose -f docker-compose.yml -f docker-compose.test.yml run --rm e2e \
 *     sh -c "npm install && npm run docs:screenshots"
 *
 * It fills a demo account with realistic data and walks through every screen (see docs/screenshots.spec.ts).
 */
export default defineConfig({
  testDir: "./docs",
  timeout: 180_000,
  expect: { timeout: 10_000 },
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL || "http://frontend",
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
    locale: "fr-FR",
  },
});
