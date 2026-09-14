import { expect, test } from "@playwright/test";
import { acceptBalancedPolicy, createQuotedJob, resetDemo } from "./helpers";

test("mandate settles successfully and splits premium 30/70", async ({ page, request }) => {
  await resetDemo(request);
  await createQuotedJob(page, "success");
  await acceptBalancedPolicy(page);
  const policyUrl = page.url();
  await page.getByRole("link", { name: "Overview" }).click();
  const resumePolicy = page.getByRole("link", { name: "Resume job" });
  await expect(resumePolicy).toHaveAttribute("href", new URL(policyUrl).pathname);
  await resumePolicy.click();
  await expect(page).toHaveURL(policyUrl);
  await page.getByRole("button", { name: "01 / EXECUTE SUCCESS" }).click();
  await expect(page.getByRole("button", { name: "02 / BUILD + SUBMIT PROOF" })).toBeEnabled();
  await page.getByRole("button", { name: "02 / BUILD + SUBMIT PROOF" }).click();
  await expect(page.getByRole("button", { name: "03 / SETTLE PERFORMANCE BOND" })).toBeEnabled();
  await page.getByRole("button", { name: "03 / SETTLE PERFORMANCE BOND" }).click();
  await expect(page.getByText("CAPITAL UNLOCKED", { exact: true })).toBeVisible();
  await expect(page.getByText(/Underwriter premium: .* · LP premium:/)).toBeVisible();
  await expect(page.getByText("VERIFIED", { exact: true })).toHaveCount(4);
});
