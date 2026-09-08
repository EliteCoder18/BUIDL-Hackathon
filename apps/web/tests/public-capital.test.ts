import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("public capital desk supports senior LP and junior underwriter deposits", () => {
  const source = readFileSync(new URL("../components/transactions/PublicCapitalDesk.tsx", import.meta.url), "utf8");
  assert.match(source, /buildVaultDepositPlan/);
  assert.match(source, /buildUnderwriterDepositPlan/);
  assert.match(source, /buildApprovePlan/);
  assert.match(source, /useReadContracts/);
  assert.match(source, /docs\.creditcoin\.org\/wallets\/using-testnet-faucet/);
});

test("underwriting desk signs EIP-712 and accepts portable quote envelopes", () => {
  const source = readFileSync(new URL("../app/underwrite/page.tsx", import.meta.url), "utf8");
  assert.match(source, /signQuote/);
  assert.match(source, /buildAcceptQuotePlan/);
  assert.match(source, /JSON\.parse/);
});
