import path from "node:path";

import { defineConfig } from "vitest/config";

// Vitest runs unit/integration tests only. Playwright specs (tests/e2e) are
// executed by `bun run e2e` and must never be collected here.
export default defineConfig({
  resolve: {
    alias: [{ find: /^@$/, replacement: path.resolve(__dirname, "src") }, { find: "@", replacement: path.resolve(__dirname, "src") }],
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**"],
  },
});
