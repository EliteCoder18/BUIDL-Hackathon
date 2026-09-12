import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PolicyHistory } from "../components/policy/PolicyHistory";
import type { LivePolicyHistoryItem } from "../lib/api/schema";

const policy: LivePolicyHistoryItem = {
  policyId: `0x${"aa".repeat(32)}`,
  jobKey: `0x${"bb".repeat(32)}`,
  client: `0x${"44".repeat(20)}`,
  underwriter: `0x${"66".repeat(20)}`,
  coverageAmount: "100000000",
  premiumAmount: "14270000",
  state: "ACTIVE",
  acceptedAt: "2026-09-12T10:40:00.000Z",
  lockTxHash: `0x${"01".repeat(32)}`,
};

test("policy history renders financial terms, status, and explorer evidence", () => {
  const html = renderToStaticMarkup(createElement(PolicyHistory, { policies: [policy] }));

  assert.match(html, /ACTIVE/);
  assert.match(html, /100\.00/);
  assert.match(html, /14\.27/);
  assert.match(html, /0xaaaaaaaa…aaaaaaaa/);
  assert.match(html, new RegExp(`https://creditcoin-testnet\\.blockscout\\.com/tx/${policy.lockTxHash}`));
});

test("policy history explains when a connected wallet has no policies", () => {
  const html = renderToStaticMarkup(createElement(PolicyHistory, { policies: [] }));

  assert.match(html, /No policies found for this wallet/i);
});

test("policy history does not round tiny non-zero testnet amounts to zero", () => {
  const html = renderToStaticMarkup(createElement(PolicyHistory, { policies: [{ ...policy, coverageAmount: "900", premiumAmount: "70" }] }));

  assert.match(html, /0\.0009/);
  assert.match(html, /0\.00007/);
});
