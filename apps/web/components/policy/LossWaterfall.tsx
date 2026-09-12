"use client";

import type { CSSProperties } from "react";
import type { OrchestratorState } from "../../lib/trustfutures/orchestrator";
import { calculateWaterfall } from "./loss-waterfall-model";

export interface LossWaterfallProps {
  coverage?: number;
  loss?: number;
  state?: OrchestratorState;
  asset?: string;
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

export function LossWaterfall({
  coverage = 1_000,
  loss,
  state = "IDLE",
  asset = "mUSDC",
}: LossWaterfallProps) {
  const slashed = state === "SETTLED_SLASHED";
  const snapshot = calculateWaterfall(coverage, slashed ? (loss ?? coverage) : 0);
  const juniorRemainingPercent = snapshot.juniorInitial === 0 ? 0 : (snapshot.juniorRemaining / snapshot.juniorInitial) * 100;
  const seniorRemainingPercent = snapshot.seniorInitial === 0 ? 0 : (snapshot.seniorRemaining / snapshot.seniorInitial) * 100;
  const style = {
    "--junior-remaining": `${juniorRemainingPercent}%`,
    "--senior-remaining": `${seniorRemainingPercent}%`,
  } as CSSProperties;

  return (
    <div className={`loss-waterfall${slashed ? " loss-waterfall--slashed" : ""}`} style={style}>
      <div className="loss-waterfall__header">
        <div>
          <span>TOTAL PERFORMANCE BOND</span>
          <strong>{formatAmount(snapshot.coverage)} {asset}</strong>
        </div>
        <div className="loss-waterfall__payout">
          <span>VERIFIED PAYOUT</span>
          <strong>{formatAmount(snapshot.payout)} {asset}</strong>
        </div>
      </div>
      <div className="loss-waterfall__bar" aria-label={`Capital waterfall. Junior ${formatAmount(snapshot.juniorRemaining)} and senior ${formatAmount(snapshot.seniorRemaining)} ${asset} remaining.`}>
        <div className="loss-waterfall__tranche loss-waterfall__tranche--junior">
          <span className="loss-waterfall__fill" />
          <div className="loss-waterfall__label"><strong>20%</strong><span>JUNIOR FIRST-LOSS</span></div>
        </div>
        <div className="loss-waterfall__tranche loss-waterfall__tranche--senior">
          <span className="loss-waterfall__fill" />
          <div className="loss-waterfall__label"><strong>80%</strong><span>SENIOR LP VAULT</span></div>
        </div>
      </div>
      <div className="loss-waterfall__ledger">
        <span><i className="loss-waterfall__key loss-waterfall__key--junior" />Junior remaining <strong>{formatAmount(snapshot.juniorRemaining)}</strong></span>
        <span><i className="loss-waterfall__key loss-waterfall__key--senior" />Senior remaining <strong>{formatAmount(snapshot.seniorRemaining)}</strong></span>
        <span className="loss-waterfall__order">LOSS ORDER 01 → 02</span>
      </div>
    </div>
  );
}
