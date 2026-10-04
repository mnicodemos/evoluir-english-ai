import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { requireCiAccount } from "./helpers";

requireCiAccount();

test.describe("public smoke", () => {
  test("home page renders the app shell", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/Evoluir/i);
    await expect(page.locator("img").first()).toBeVisible();
  });

  test("login page renders a sign-in form", async ({ page }) => {
    await page.goto("/auth", { waitUntil: "domcontentloaded" });
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
  });

  test("invalid credentials do not create a session", async ({ page }) => {
    await page.goto("/auth", { waitUntil: "domcontentloaded" });
    await page.locator('input[type="email"]').fill("invalid-e2e@example.invalid");
    await page.locator('input[type="password"]').fill("invalid-password");
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/auth/);
  });

  test("protected routes redirect unauthenticated visitors", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/dashboard/);
  });

  test("home page has no critical accessibility violations", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const results = await new AxeBuilder({ page }).analyze();
    const critical = results.violations.filter((v) => v.impact === "critical");
    expect(
      critical,
      JSON.stringify(critical.map((v) => ({ id: v.id, nodes: v.nodes.length }))),
    ).toHaveLength(0);
  });

  test("login has no serious or critical accessibility violations", async ({ page }) => {
    await page.goto("/auth", { waitUntil: "domcontentloaded" });
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? "")),
    ).toHaveLength(0);
  });

  test("manifest, icons, language and viewport are valid", async ({ page, request }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("lang", /pt-BR|en/);
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      "content",
      /viewport-fit=cover/,
    );
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute("href", /site\.webmanifest/);
    const manifestResponse = await request.get("/site.webmanifest");
    expect(manifestResponse.ok()).toBe(true);
    const manifest = await manifestResponse.json();
    expect(manifest.lang).toBe("pt-BR");
    expect(manifest.icons.length).toBeGreaterThan(0);
    for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  });

  test("reduced motion neutralizes animations and transitions", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const timing = await page.locator("body").evaluate(() => {
      const probe = document.createElement("div");
      probe.className = "animate-rise";
      document.body.append(probe);
      const style = getComputedStyle(probe);
      const result = { animation: style.animationDuration, transition: style.transitionDuration };
      probe.remove();
      return result;
    });
    // Browsers serialize the same duration differently ("0.01ms" vs "1e-05s").
    const toMs = (v: string) => (v.endsWith("ms") ? parseFloat(v) : parseFloat(v) * 1000);
    expect(toMs(timing.animation)).toBeLessThanOrEqual(0.01);
    expect(toMs(timing.transition)).toBeLessThanOrEqual(0.01);
  });
});
