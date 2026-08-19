import { expect, type APIRequestContext, type Page } from "@playwright/test";

export async function resetDemo(request: APIRequestContext) {
  const response = await request.post("http://127.0.0.1:3001/v1/demo/reset", { data: {} });
  expect(response.ok()).toBeTruthy();
}

export async function createQuotedJob(page: Page, outcome: "success" | "violation") {
  await page.goto("/jobs/new");
  if (outcome === "violation") await page.getByRole("button", { name: "VIOLATION / SLASH" }).click();
  await page.getByRole("button", { name: "CREATE MANDATE + REQUEST QUOTES" }).click();
  await expect(page).toHaveURL(/\/quotes\/0x[0-9a-f]{64}$/);
  await expect(page.getByText("3 EIP-712 QUOTES")).toBeVisible();
}

export async function acceptBalancedPolicy(page: Page) {
  await page.getByRole("button", { name: "ACCEPT + LOCK POLICY" }).nth(1).click();
  await expect(page).toHaveURL(/\/policies\/0x[0-9a-f]{64}$/);
  await expect(page.getByRole("heading", { name: "CREDITCOIN POLICY LOCKED" })).toBeVisible();
}
