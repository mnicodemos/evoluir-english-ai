import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { email, hasTestAccount, password, requireCiAccount, signIn } from "./helpers";

requireCiAccount();
const authenticated = hasTestAccount ? test.describe : test.describe.skip;

authenticated("authenticated smoke", () => {
  test.beforeEach(async ({ page }) => signIn(page));

  test("dashboard, progress, practice, teacher and Premium render", async ({ page }) => {
    // Each page is checked by its own main title (h1), which renders without
    // waiting for data; loose text matches were slow or hit hidden copies.
    const routes = [
      ["/dashboard", /Good (morning|afternoon|evening)|Hello/i],
      ["/progress", /My Progress/i],
      ["/vocabulary", /Vocabulary/i],
      ["/listening", /Train your ear/i],
      ["/writing", /Writing/i],
      ["/teacher", /AI Teacher/i],
      ["/coach", /AI Speaking/i],
      ["/premium", /Premium/i],
    ] as const;
    for (const [route, title] of routes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(new RegExp(route));
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible({
        timeout: 20_000,
      });
    }
  });

  test("learning path opens a lesson with activity tabs", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/learning", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Your learning path/i })).toBeVisible();
    // The student's own entry: the "Next lesson" card's button.
    await page.getByRole("region", { name: "Next lesson" }).getByRole("button").first().click();
    // A lesson opened for the first time is written by the AI on the server,
    // which CI runs without AI keys; an error toast then names the cause
    // instead of a silent timeout.
    const errorToast = page.locator('[data-sonner-toast][data-type="error"]').first();
    const failure = await Promise.race([
      page.waitForURL(/\/learning\/[^/?#]+/, { timeout: 30_000 }).then(() => null),
      errorToast
        .waitFor({ timeout: 30_000 })
        .then(() => errorToast.textContent())
        .catch(() => null),
    ]);
    if (failure) {
      throw new Error(
        `Opening the next lesson failed: ${failure.trim()}. A lesson opened for the first time is generated on the server, which CI runs without AI keys: open the test account's first lesson once in the published app.`,
      );
    }
    await expect(page.getByRole("tab", { name: "Summary" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Flashcards" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Quiz" })).toBeVisible();
    await page.getByRole("tab", { name: "Quiz" }).click();
    await expect(page.getByRole("tabpanel", { name: "Quiz" })).toBeVisible();
  });

  test("authenticated pages pass axe and mobile navigation order is correct", async ({
    page,
  }, testInfo) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? "")),
    ).toHaveLength(0);
    if (testInfo.project.name === "pixel-7") {
      const nav = page.getByRole("navigation", { name: /Navegação principal|Main navigation/i });
      await expect(nav).toBeVisible();
      await expect(nav.locator("a")).toHaveCount(4);
      await expect(nav.locator("a").nth(1)).toContainText("AI Teacher");
      await expect(nav.locator("a").nth(2)).toContainText("AI Speaking");
      await expect(nav.locator("a").nth(3)).toContainText(/Videochamada|Video call/);
    }
  });

  test("quiz answer key and admin controls are not exposed to a regular user", async ({ page }) => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key || !email || !password)
      throw new Error("Backend test variables are required.");
    const client = createClient(url, key, { auth: { persistSession: false } });
    const signedIn = await client.auth.signInWithPassword({ email, password });
    expect(signedIn.error).toBeNull();
    const quiz = await client.from("quizzes").select("correct_answer").limit(1);
    expect(quiz.error).not.toBeNull();

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Admin panel|Painel admin/i)).toHaveCount(0);
  });

  test("logout ends the authenticated session", async ({ page }, testInfo) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    // On phones, Sign out lives in the "More" menu of the bottom navigation.
    if (testInfo.project.name === "pixel-7") {
      await page
        .getByRole("button", { name: /Open menu|Abrir menu/i })
        .first()
        .click();
    }
    await page
      .getByRole("button", { name: /Sign out|Sair/i })
      .filter({ visible: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/auth/, { timeout: 20_000 });
  });
});
