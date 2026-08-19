export interface WaterfallSnapshot {
  coverage: number;
  loss: number;
  juniorInitial: number;
  juniorRemaining: number;
  seniorInitial: number;
  seniorRemaining: number;
  payout: number;
}

export function calculateWaterfall(coverage: number, requestedLoss: number): WaterfallSnapshot {
  const safeCoverage = Math.max(0, Number.isFinite(coverage) ? coverage : 0);
  const payout = Math.min(safeCoverage, Math.max(0, Number.isFinite(requestedLoss) ? requestedLoss : 0));
  const juniorInitial = safeCoverage * 0.2;
  const seniorInitial = safeCoverage - juniorInitial;
  const juniorLoss = Math.min(juniorInitial, payout);
  const seniorLoss = Math.max(0, payout - juniorLoss);

  return {
    coverage: safeCoverage,
    loss: payout,
    juniorInitial,
    juniorRemaining: juniorInitial - juniorLoss,
    seniorInitial,
    seniorRemaining: seniorInitial - seniorLoss,
    payout,
  };
}

