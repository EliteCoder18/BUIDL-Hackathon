import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });

test("mobile landing page makes the demo path obvious without horizontal overflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Performance bonds for AI agents" })).toBeVisible();
  const start = page.getByRole("link", { name: "Start the demo" });
  await expect(start).toBeVisible();
  const startBox = await start.boundingBox();
  expect(startBox?.y).toBeLessThan(844);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole("link", { name: "How it works" }).click();
  await expect(page.getByRole("heading", { name: "From agent selection to settlement" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Cross-chain topology/ })).toBeVisible();
  await page.getByRole("link", { name: "Create job" }).click();
  await expect(page.getByRole("button", { name: "CREATE MANDATE + REQUEST QUOTES" })).toBeVisible();
});
