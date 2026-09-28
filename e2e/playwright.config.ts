import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.ts",
  timeout: 30000,
  expect: { timeout: 10000 },
  // Tests run in parallel. Each worker (= one browser process) has its own test account,
  // emptied before every test, so tests never see each other's data (see tests/helpers.ts).
  // Every browser costs ~200-300 MB and Docker Desktop gives ~1.9 GB by default: 2 workers is stable,
  // 3 made tests flaky since Playwright 1.63. Raise E2E_WORKERS only if you gave Docker more memory.
  fullyParallel: true,
  workers: Number(process.env.E2E_WORKERS) || 2,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL || "http://frontend",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    // Creates the test account used by the login tests first; if it fails, nothing else runs
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "app", testIgnore: /auth\.setup\.ts/, dependencies: ["setup"] },
  ],
});
