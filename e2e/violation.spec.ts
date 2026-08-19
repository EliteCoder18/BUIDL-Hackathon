import { expect, test } from "@playwright/test";
import { acceptBalancedPolicy, createQuotedJob, resetDemo } from "./helpers";

test("violation pays coverage, applies junior-first loss, and raises the next premium", async ({ page, request }) => {
  await resetDemo(request);
  await createQuotedJob(page, "violation");
  const before = Number(await page.locator(".quote-card__economics strong").nth(3).innerText());
  await acceptBalancedPolicy(page);
  await page.getByRole("button", { name: "01 / EXECUTE VIOLATION" }).click();
  await page.getByRole("button", { name: "02 / BUILD + SUBMIT PROOF" }).click();
  await page.getByRole("button", { name: "03 / SETTLE PERFORMANCE BOND" }).click();
  await expect(page.getByText("CLIENT PAID / CAPITAL SLASHED", { exact: true })).toBeVisible();
  await expect(page.getByText(/Client payout: 100 mUSDC/)).toBeVisible();
  await expect(page.locator(".loss-waterfall__ledger")).toContainText("Junior remaining 0");
  await createQuotedJob(page, "success");
  const after = Number(await page.locator(".quote-card__economics strong").nth(3).innerText());
  expect(after).toBeGreaterThan(before);
});
