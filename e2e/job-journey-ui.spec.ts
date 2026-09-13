import { expect, test } from "@playwright/test";

test("create job presents a compact cross-chain journey without overflow", async ({ page }) => {
  await page.goto("/jobs/new");
  await expect(page.getByRole("heading", { name: "From mandate to enforceable guarantee" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Cross-chain journey progress" })).toHaveAttribute("aria-valuenow", "0");
  await expect(page.getByText("CURRENT NETWORK ACTION")).toBeVisible();
  await expect(page.getByText("Client funds a constrained execution mandate", { exact: true })).toHaveCount(2);

  await page.setViewportSize({ width: 375, height: 812 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
