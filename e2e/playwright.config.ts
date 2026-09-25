import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.ts",
  timeout: 30000,
  expect: { timeout: 10000 },
  // One worker: all tests share the same test account (see tests/helpers.ts)
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL || "http://frontend",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    // Creates the shared account first; if it fails, the "app" project is not run at all
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "app",
      testIgnore: /auth\.setup\.ts/,
      dependencies: ["setup"],
      use: { storageState: "./.auth/user.json" },
    },
  ],
});
