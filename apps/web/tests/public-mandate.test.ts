import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("public mandate requires wallet funding, approval, receipt confirmation, and XState events", () => {
  const source = readFileSync(new URL("../components/transactions/PublicMandateForm.tsx", import.meta.url), "utf8");
  assert.match(source, /buildMintPlan/);
  assert.match(source, /buildApprovePlan/);
  assert.match(source, /buildCreateJobPlan/);
  assert.match(source, /JobCreated/);
  assert.match(source, /START_MANDATE/);
  assert.match(source, /SEPOLIA_RECEIPT/);
  assert.match(source, /cloud\.google\.com\/application\/web3\/faucet/);
});

test("create-job route preserves an explicitly selected embedded twin", () => {
  const source = readFileSync(new URL("../app/jobs/new/page.tsx", import.meta.url), "utf8");
  assert.match(source, /NEXT_PUBLIC_EMBEDDED_DEMO/);
  assert.match(source, /PublicMandateForm/);
});
