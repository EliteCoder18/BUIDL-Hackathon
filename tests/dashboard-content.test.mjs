import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("technical dashboard presents orchestration, proof, and pooled-capital telemetry", () => {
  const page = fs.readFileSync("apps/web/app/page.tsx", "utf8");
  for (const label of ["Cross-chain reliability operations", "LIVE NETWORK DAG", "SENIOR LIQUIDITY", "CONFIRMED PROOFS", "NEW MANDATE"]) {
    assert.match(page, new RegExp(label));
  }
  assert.doesNotMatch(page, /ConnectButton/);
  assert.match(fs.readFileSync("apps/web/app/providers.tsx", "utf8"), /NEXT_PUBLIC_API_URL/);
});
