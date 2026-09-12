"use client";

import type { RiskFeature } from "../../lib/trustfutures/types";
import { StatusChip } from "../ui/StatusChip";
import { RiskAnalyticsPanel, type RiskExplanation, type RiskProvenance } from "./RiskAnalyticsPanel";

export interface DisplayQuote {
  id: string;
  underwriter: string;
  coverageAmount: string | number | bigint;
  premiumAmount: string | number | bigint;
  juniorAmount: string | number | bigint;
  validUntil?: string | number | bigint;
  modelHash?: string;
  nonce?: string | number | bigint;
  probability?: number;
  features: readonly RiskFeature[];
  explanation: RiskExplanation;
  provenance?: RiskProvenance;
  strategy?: string;
}

export interface QuoteCardProps {
  quote: DisplayQuote;
  selected?: boolean;
  disabled?: boolean;
  busy?: boolean;
  rank?: number;
  onSelect?: (quote: DisplayQuote) => void | Promise<void>;
}

function compactAddress(address: string): string {
  return address.length > 15 ? `${address.slice(0, 8)}…${address.slice(-6)}` : address;
}

function displayUnits(value: string | number | bigint): string {
  const numeric = typeof value === "bigint" ? Number(value) : Number(value);
  return Number.isFinite(numeric) ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(numeric) : String(value);
}

export function QuoteCard({ quote, selected = false, disabled = false, busy = false, rank, onSelect }: QuoteCardProps) {
  return (
    <article className={`quote-card${selected ? " quote-card--selected" : ""}`}>
      <header className="quote-card__header">
        <div>
          <span className="quote-card__eyebrow">UNDERWRITER {rank ? `0${rank}` : "NODE"}</span>
          <h3>{quote.strategy ?? "Calibrated bond"}</h3>
          <code>{compactAddress(quote.underwriter)}</code>
        </div>
        <StatusChip label={selected ? "SELECTED" : "SIGNED"} tone={selected ? "success" : "cyan"} />
      </header>
      <div className="quote-card__economics">
        <div><span>PREMIUM</span><strong>{displayUnits(quote.premiumAmount)}</strong><small>mUSDC</small></div>
        <div><span>COVERAGE</span><strong>{displayUnits(quote.coverageAmount)}</strong><small>mUSDC</small></div>
        <div><span>JUNIOR</span><strong>{displayUnits(quote.juniorAmount)}</strong><small>20% FIRST LOSS</small></div>
      </div>
      <RiskAnalyticsPanel
        features={quote.features}
        explanation={quote.explanation}
        probability={quote.probability}
        modelVersion={quote.modelHash}
        provenance={quote.provenance}
        compact
      />
      <footer className="quote-card__footer">
        <div>
          <span>NONCE</span>
          <code>{quote.nonce == null ? "—" : String(quote.nonce)}</code>
        </div>
        <button className="technical-button technical-button--primary" type="button" disabled={disabled || busy || selected} onClick={() => onSelect?.(quote)}>
          {busy ? "LOCKING CAPITAL…" : selected ? "POLICY LOCKED" : "ACCEPT + LOCK POLICY"}
        </button>
      </footer>
    </article>
  );
}
