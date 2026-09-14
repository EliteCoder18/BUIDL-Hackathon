import { expect, test } from "@playwright/test";
import { createQuotedJob, resetDemo } from "./helpers";

test("job navigation resumes quotes and policy locking across operations", async ({ page, request }) => {
  await resetDemo(request);
  await createQuotedJob(page, "success");
  const quoteUrl = page.url();

  await page.getByRole("link", { name: "Overview" }).click();
  const resumeQuotes = page.getByRole("link", { name: "Resume job" });
  await expect(resumeQuotes).toHaveAttribute("href", new URL(quoteUrl).pathname);
  await expect(page.locator(".network-telemetry")).not.toContainText("—");
  await resumeQuotes.click();
  await expect(page).toHaveURL(quoteUrl);

  const clippedActions = await page.locator(".quote-card").evaluateAll((cards) => cards.filter((card) => {
    const action = card.querySelector("button");
    if (!action) return true;
    const cardBox = card.getBoundingClientRect();
    const actionBox = action.getBoundingClientRect();
    return actionBox.left < cardBox.left || actionBox.right > cardBox.right;
  }).length);
  expect(clippedActions).toBe(0);

});
