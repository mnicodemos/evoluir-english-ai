import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { email, hasTestAccount, password, requireCiAccount, signIn } from "./helpers";

requireCiAccount();
const authenticated = hasTestAccount ? test.describe : test.describe.skip;

authenticated("authenticated smoke", () => {
  test.beforeEach(async ({ page }) => signIn(page));

  test("dashboard, progress, practice, teacher and Premium render", async ({ page }) => {
    const routes = [
      ["/dashboard", /Today's Progress|Today's Priority/i],
      ["/progress", /My history|Histórico/i],
      ["/vocabulary", /Vocabulary|Vocabulário/i],
      ["/listening", /Listening/i],
      ["/writing", /Writing/i],
      ["/teacher", /AI Teacher/i],
      ["/coach", /AI Speaking/i],
      ["/premium", /Premium/i],
    ] as const;
    for (const [route, heading] of routes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(new RegExp(route));
      // Responsive screens keep hidden copies of some labels (mobile vs desktop).
      await expect(page.getByText(heading).filter({ visible: true }).first()).toBeVisible({
        timeout: 20_000,
      });
    }
  });

  test("learning path opens a lesson with activity tabs", async ({ page }) => {
    await page.goto("/learning", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Your learning path/i })).toBeVisible();
    const lessonLink = page.locator('a[href^="/learning/"]').first();
    const directHref = await lessonLink.getAttribute("href").catch(() => null);
    if (directHref) await page.goto(directHref, { waitUntil: "domcontentloaded" });
    else
      await page
        .getByRole("button", { name: /lesson|start|continue/i })
        .first()
        .click();
    await expect(page).toHaveURL(/\/learning\//, { timeout: 20_000 });
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
      await expect(nav.locator("a").nth(2)).toContainText(/Videochamada|Video call/);
      await expect(nav.locator("a").nth(3)).toContainText("AI Speaking");
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
