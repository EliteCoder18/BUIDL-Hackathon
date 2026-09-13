import assert from "node:assert/strict";
import test from "node:test";

import * as activeJourney from "../lib/journey/active-journey";
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

test("cancelling wallet policy setup removes the resumable job session", () => {
  const removeCalls: string[] = [];
  const routes: string[] = [];
  let resets = 0;
  const cancel = (activeJourney as { cancelWalletJourney?: (jobKey: string, dependencies: { storage: Pick<Storage, "removeItem">; reset: () => void; navigate: (href: string) => void }) => void }).cancelWalletJourney;
  assert.equal(typeof cancel, "function");
  if (!cancel) return;

  cancel(`0x${"33".repeat(32)}`, {
    storage: { removeItem: (key) => { removeCalls.push(key); } },
    reset: () => { resets += 1; },
    navigate: (href) => { routes.push(href); },
  });

  assert.deepEqual(removeCalls, [
    "trustfutures:live:0x3333333333333333333333333333333333333333333333333333333333333333",
    "trustfutures:active-journey:wallet",
  ]);
  assert.equal(resets, 1);
  assert.deepEqual(routes, ["/jobs/new"]);
});
