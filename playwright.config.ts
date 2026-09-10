import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./output/playwright/results",
  fullyParallel: false,
  workers: 1,
  // Cold Linux runners compile the wallet connector chunk on the first route.
  // Keep assertions strict locally while allowing that one-time CI startup cost.
  timeout: 90_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run demo",
    url: "http://localhost:3000",
    timeout: 120_000,
    reuseExistingServer: true,
  },
});
