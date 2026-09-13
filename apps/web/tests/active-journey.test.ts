import assert from "node:assert/strict";
import test from "node:test";

import { isJourneyPath, parseJourneyPath } from "../lib/journey/active-journey";

test("active journey accepts resumable workflow routes", () => {
  const jobKey = `0x${"11".repeat(32)}`;
  const policyId = `0x${"22".repeat(32)}`;

  assert.equal(parseJourneyPath(`/quotes/${jobKey}`), `/quotes/${jobKey}`);
  assert.equal(parseJourneyPath(`/policies/${policyId}`), `/policies/${policyId}`);
  assert.equal(parseJourneyPath(`/proofs/${jobKey}`), `/proofs/${jobKey}`);
  assert.equal(isJourneyPath(`/policies/${policyId}`), true);
});

test("active journey rejects unrelated and malformed routes", () => {
  assert.equal(parseJourneyPath("/"), undefined);
  assert.equal(parseJourneyPath("/jobs/new"), undefined);
  assert.equal(parseJourneyPath("/quotes/not-a-job"), undefined);
  assert.equal(parseJourneyPath("https://example.com/policies/0x123"), undefined);
  assert.equal(isJourneyPath("/vault"), false);
});
