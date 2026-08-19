export const PolicyState = Object.freeze({
  Active: "active",
  SettledSuccess: "settled_success",
  SettledFailure: "settled_failure",
});

const JUNIOR_BPS = 2_000n;
const BPS = 10_000n;

export function createPolicy(quote, { now, seniorAvailable }) {
  if (BigInt(now) > BigInt(quote.validUntil)) throw new Error("quote expired");
  if (quote.coverageAmount <= 0n) throw new Error("coverage must be positive");
  if (quote.juniorAmount * BPS !== quote.coverageAmount * JUNIOR_BPS) {
    throw new Error("junior stake must equal 20% of coverage");
  }

  const seniorRequired = quote.coverageAmount - quote.juniorAmount;
  if (seniorAvailable < seniorRequired) throw new Error("insufficient senior liquidity");

  return {
    ...quote,
    seniorRequired,
    state: PolicyState.Active,
  };
}

export function settlePolicy(policy, outcome) {
  if (policy.state !== PolicyState.Active) throw new Error("policy already settled");

  if (outcome === "failure") {
    policy.state = PolicyState.SettledFailure;
    return {
      state: policy.state,
      clientPayout: policy.coverageAmount,
      juniorLoss: policy.juniorAmount,
      seniorLoss: policy.seniorRequired,
      juniorReleased: 0n,
      seniorReleased: 0n,
      underwriterPremium: 0n,
      lpPremium: 0n,
    };
  }

  if (outcome !== "success") throw new Error("unknown outcome");
  policy.state = PolicyState.SettledSuccess;
  const underwriterPremium = (policy.premiumAmount * 3n) / 10n;
  return {
    state: policy.state,
    clientPayout: 0n,
    juniorLoss: 0n,
    seniorLoss: 0n,
    juniorReleased: policy.juniorAmount,
    seniorReleased: policy.seniorRequired,
    underwriterPremium,
    lpPremium: policy.premiumAmount - underwriterPremium,
  };
}
