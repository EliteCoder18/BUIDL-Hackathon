import assert from "node:assert/strict";
import test from "node:test";

import { buildAgentProfile } from "../components/agents/agent-profile-model";

test("agent profile derives auditable reliability and outcome proportions", () => {
  const profile = buildAgentProfile({
    successCount: 9,
    violationCount: 1,
    expiryCount: 1,
    meanSlippageBps: 24,
    meanLatenessBps: 42,
    amountVsP95Bps: 9_400,
    deadlineTightnessBps: 280,
    volatilityBps: 300,
  });

  assert.equal(profile.completedMandates, 11);
  assert.equal(profile.reliability, 81.81818181818183);
  assert.deepEqual(profile.outcomes.map(({ label, count }) => ({ label, count })), [
    { label: "Successful", count: 9 },
    { label: "Violated", count: 1 },
    { label: "Expired", count: 1 },
  ]);
  assert.ok(Math.abs(profile.outcomes.reduce((sum, outcome) => sum + outcome.share, 0) - 100) < Number.EPSILON * 100);
});

test("agent profile remains stable without recorded mandates", () => {
  const profile = buildAgentProfile({
    successCount: 0,
    violationCount: 0,
    expiryCount: 0,
    meanSlippageBps: 0,
    meanLatenessBps: 0,
    amountVsP95Bps: 0,
    deadlineTightnessBps: 0,
    volatilityBps: 0,
  });

  assert.equal(profile.completedMandates, 0);
  assert.equal(profile.reliability, 0);
  assert.equal(profile.outcomes.every(({ share }) => share === 0), true);
});
