import { defineConfig } from "@playwright/test";

/**
 * E2E configuration.
 * - Local: boots `bun run dev` automatically on :8080 (reuses an already running dev server).
 * - CI/staging: set E2E_BASE_URL to run against an existing deployment instead.
 */
export default defineConfig({
  testDir: "tests/e2e",
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
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
