import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("public evidence links the source, proof, and settlement transactions", () => {
  const source = readFileSync(new URL("../components/deployments/PublicEvidence.tsx", import.meta.url), "utf8");
  assert.match(source, /sourceTransaction/);
  assert.match(source, /proofTransaction/);
  assert.match(source, /settlementTransaction/);
  assert.match(source, /target="_blank"/);
});

test("home page has a public offline-first branch", () => {
  const source = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /PublicEvidence/);
  assert.match(source, /NEXT_PUBLIC_EMBEDDED_DEMO/);
});
