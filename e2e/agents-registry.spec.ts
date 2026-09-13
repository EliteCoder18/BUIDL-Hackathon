import { expect, test } from "@playwright/test";
import { resetDemo } from "./helpers";

test("agent registry presents verifiable history and compact risk evidence", async ({ page, request }) => {
  await resetDemo(request);
  await page.goto("/agents");

  await expect(page.getByText("2 VERIFIED AGENTS")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Treasury Delta" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Liquidity Sigma" })).toBeVisible();
  await expect(page.getByText("ATTESTED MANDATE HISTORY")).toHaveCount(2);
  await expect(page.getByText("NEXT-JOB FAILURE RISK")).toHaveCount(2);
  await expect(page.getByText("Risk contribution by observed signal")).toHaveCount(2);
  await expect(page.getByRole("img", { name: "SHAP feature attribution chart" })).toHaveCount(0);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
