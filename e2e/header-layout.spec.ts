import { expect, test } from "@playwright/test";

test("desktop brand does not overlap the primary navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(page.locator(".orbital-nav")).toBeVisible();
  await expect(page.locator(".orbital-brand small")).toBeHidden();

  const layout = await page.evaluate(() => {
    const nav = document.querySelector(".orbital-nav")?.getBoundingClientRect();
    const visibleBrandParts = [...document.querySelectorAll<HTMLElement>(".orbital-brand > *")]
      .map((element) => ({ rect: element.getBoundingClientRect(), display: getComputedStyle(element).display }))
      .filter(({ display, rect }) => display !== "none" && rect.width > 0);

    return {
      brandRight: Math.max(...visibleBrandParts.map(({ rect }) => rect.right)),
      navLeft: nav?.left ?? 0,
    };
  });

  expect(layout.brandRight).toBeLessThanOrEqual(layout.navLeft);
});

test("wallet controls never force the brand wordmark over navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1084, height: 877 });
  await page.goto("/");
  await expect(page.locator(".orbital-nav")).toBeVisible();
  await page.locator(".orbital-system").evaluate((system) => {
    system.style.width = "472px";
  });

  const layout = await page.evaluate(() => {
    const nav = document.querySelector(".orbital-nav")?.getBoundingClientRect();
    const visibleBrandParts = [...document.querySelectorAll<HTMLElement>(".orbital-brand > *")]
      .map((element) => ({ rect: element.getBoundingClientRect(), display: getComputedStyle(element).display }))
      .filter(({ display, rect }) => display !== "none" && rect.width > 0);
    return { overlaps: Boolean(nav && visibleBrandParts.some(({ rect }) => rect.right > nav.left)), nav, visibleBrandParts };
  });

  expect(layout.overlaps).toBe(false);
});
