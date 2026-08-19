import test from "node:test";
import assert from "node:assert/strict";

import {
  createPolicy,
  settlePolicy,
  PolicyState,
} from "../services/domain/policy.mjs";

const quote = {
  jobKey: "0xjob",
  underwriter: "0xunderwriter",
  coverageAmount: 1_000_000n,
  premiumAmount: 100_000n,
  juniorAmount: 200_000n,
  validUntil: 2_000,
  nonce: 1n,
};

test("failure pays full coverage junior first and charges remaining loss to LPs", () => {
  const policy = createPolicy(quote, { now: 1_000, seniorAvailable: 800_000n });
  const settlement = settlePolicy(policy, "failure");

  assert.equal(settlement.state, PolicyState.SettledFailure);
  assert.equal(settlement.clientPayout, 1_000_000n);
  assert.equal(settlement.juniorLoss, 200_000n);
  assert.equal(settlement.seniorLoss, 800_000n);
  assert.equal(settlement.underwriterPremium, 0n);
  assert.equal(settlement.lpPremium, 0n);
});

test("success releases capital and splits premium 30/70", () => {
  const policy = createPolicy(quote, { now: 1_000, seniorAvailable: 800_000n });
  const settlement = settlePolicy(policy, "success");

  assert.equal(settlement.state, PolicyState.SettledSuccess);
  assert.equal(settlement.juniorReleased, 200_000n);
  assert.equal(settlement.seniorReleased, 800_000n);
  assert.equal(settlement.underwriterPremium, 30_000n);
  assert.equal(settlement.lpPremium, 70_000n);
});

test("rejects quotes where junior stake is not 20 percent of coverage", () => {
  assert.throws(
    () => createPolicy({ ...quote, juniorAmount: 199_999n }, { now: 1_000, seniorAvailable: 800_001n }),
    /20%/
  );
});

test("rejects expired quotes and double settlement", () => {
  assert.throws(() => createPolicy(quote, { now: 2_001, seniorAvailable: 800_000n }), /expired/);
  const policy = createPolicy(quote, { now: 1_000, seniorAvailable: 800_000n });
  settlePolicy(policy, "success");
  assert.throws(() => settlePolicy(policy, "failure"), /already settled/);
});
