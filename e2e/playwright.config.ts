import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.ts",
  timeout: 30000,
  expect: { timeout: 10000 },
  // Tests run in parallel. Each worker (= one browser process) has its own test account,
  // emptied before every test, so tests never see each other's data (see tests/helpers.ts).
  // Every browser costs ~200 MB: lower E2E_WORKERS if Docker runs out of memory.
  fullyParallel: true,
  workers: Number(process.env.E2E_WORKERS) || 3,
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
