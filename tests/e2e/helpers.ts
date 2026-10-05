import { expect, type Page } from "@playwright/test";

export const email = process.env["E2E_USER_EMAIL"];
export const password = process.env["E2E_USER_PASSWORD"];
export const hasTestAccount = Boolean(email && password);

export async function signIn(page: Page) {
  if (!email || !password) {
    throw new Error("Authenticated E2E requires E2E_USER_EMAIL and E2E_USER_PASSWORD.");
  }
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  // Wait for React to take over the form: a click before hydration submits the
  // plain HTML form (GET /auth?) and the sign-in never runs.
  await page.waitForFunction(
    () => {
      const form = document.querySelector("form");
      return !!form && Object.keys(form).some((key) => key.startsWith("__react"));
    },
    undefined,
    { timeout: 20_000 },
  );
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 20_000 });
}

export function requireCiAccount() {
  if (process.env["CI"] === "true" && !hasTestAccount) {
    throw new Error("CI must configure E2E_USER_EMAIL and E2E_USER_PASSWORD.");
  }
}
