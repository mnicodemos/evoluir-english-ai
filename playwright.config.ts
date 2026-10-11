import { defineConfig } from "@playwright/test";

/**
 * E2E configuration.
 * - Local: boots `bun run dev` automatically on :8080 (reuses an already running dev server).
 * - CI/staging: set E2E_BASE_URL to run against an existing deployment instead.
 */
export default defineConfig({
  testDir: "tests/e2e",
  // Warms up the signed-in pages on the dev server before the tests run.
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"] ? "list" : [["list"]],
  use: {
    baseURL: process.env["E2E_BASE_URL"] ?? "http://localhost:8080",
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 1800 },
  },
  webServer: process.env["E2E_BASE_URL"]
    ? undefined
    : {
        command: "bun run dev",
        url: "http://localhost:8080",
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    {
      name: "desktop-chromium",
      use: { browserName: "chromium", viewport: { width: 1280, height: 1800 } },
    },
    {
      name: "pixel-7",
      use: {
        browserName: "chromium",
        viewport: { width: 412, height: 915 },
        deviceScaleFactor: 2.625,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
