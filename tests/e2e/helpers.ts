import { expect, type Page } from "@playwright/test";

export const email = process.env["E2E_USER_EMAIL"];
export const password = process.env["E2E_USER_PASSWORD"];
export const hasTestAccount = Boolean(email && password);

export async function signIn(page: Page) {
  if (!email || !password) {
    throw new Error("Authenticated E2E requires E2E_USER_EMAIL and E2E_USER_PASSWORD.");
  }
  // The app opens in Portuguese by default; the checks are written against the
  // English interface, so every test page starts in English.
  await page.addInitScript(() => window.localStorage.setItem("evoluir-ui-lang", "en"));
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
  // An error toast (e.g. "Invalid login credentials") ends the wait early and
  // names the cause, so a CI failure says whether the test account or the app
  // is at fault.
  const errorToast = page.locator('[data-sonner-toast][data-type="error"]').first();
  const failure = await Promise.race([
    page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 20_000 }).then(() => null),
    errorToast
      .waitFor({ timeout: 20_000 })
      .then(() => errorToast.textContent())
      .catch(() => null),
  ]);
  if (failure) throw new Error(`Sign-in failed for the E2E account: ${failure.trim()}`);
  await expect(page).toHaveURL(/\/(dashboard|onboarding)/);
  // A fresh test account lands on the onboarding, and every app page sends it
  // back there until the plan exists: finish it the quickest way.
  if (/\/onboarding/.test(page.url())) await completeOnboarding(page);
}

async function completeOnboarding(page: Page) {
  await page.getByRole("button", { name: "Continue" }).click();
  // Missing both A1 questions ends the adaptive placement test at once.
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "I don't know" }).click();
  await page.getByRole("button", { name: "See my level" }).click();
  await page.getByRole("button", { name: "Go to my Dashboard" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
}

export function requireCiAccount() {
  if (process.env["CI"] === "true" && !hasTestAccount) {
    throw new Error("CI must configure E2E_USER_EMAIL and E2E_USER_PASSWORD.");
  }
}
