import { chromium, type FullConfig } from "@playwright/test";

import { hasTestAccount, signIn } from "./helpers";

// Signed-in pages and their server functions are compiled by the dev server on
// first use; on a cold CI server that took longer than a test's own waits (the
// first desktop test of each run failed and passed on retry). One signed-in
// walk through the same pages before the tests warms them up. A failure here
// never fails the run: the tests themselves report any real problem.
const WARM_ROUTES = [
  "/dashboard",
  "/learning",
  "/progress",
  "/vocabulary",
  "/listening",
  "/writing",
  "/teacher",
  "/coach",
  "/premium",
];

export default async function globalSetup(config: FullConfig) {
  if (!hasTestAccount || process.env["E2E_BASE_URL"]) return;
  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:8080";
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ baseURL });
    await signIn(page);
    for (const route of WARM_ROUTES) {
      await page.goto(route, { waitUntil: "networkidle", timeout: 60_000 }).catch(() => undefined);
    }
  } catch (error) {
    console.warn(`[e2e warm-up] skipped: ${error instanceof Error ? error.message : error}`);
  } finally {
    await browser.close();
  }
}
