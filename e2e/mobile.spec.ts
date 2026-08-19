import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });

test("mobile command center preserves navigation and topology semantics", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Cross-chain reliability operations" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Cross-chain topology/ })).toBeVisible();
  await page.getByRole("link", { name: /03 Create job/ }).click();
  await expect(page.getByRole("button", { name: "CREATE MANDATE + REQUEST QUOTES" })).toBeVisible();
});
