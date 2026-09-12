import React from "react";
import type { LivePolicyHistoryItem } from "../../lib/api/schema";
import { StatusChip } from "../ui/StatusChip";

const explorer = "https://creditcoin-testnet.blockscout.com";

function shortHash(value: string) {
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

function musdc(value: string) {
  const raw = BigInt(value);
  if (raw > 0n && raw < 10_000n) {
    const fraction = raw.toString().padStart(6, "0").replace(/0+$/, "");
    return `0.${fraction}`;
  }
  return (Number(value) / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function status(policy: LivePolicyHistoryItem) {
  if (policy.state === "SETTLED_SUCCESS") return { label: "SETTLED · SUCCESS", tone: "success" as const };
  if (policy.state === "SETTLED_FAILURE") return { label: "SETTLED · PAYOUT", tone: "danger" as const };
  return { label: "ACTIVE", tone: "cyan" as const };
}

export function PolicyHistory({ policies }: { policies: LivePolicyHistoryItem[] }) {
  if (policies.length === 0) return <div className="policy-history-empty"><strong>NO ON-CHAIN HISTORY</strong><span>No policies found for this wallet.</span></div>;
  return <ol className="policy-history" aria-label="Connected wallet policy transaction history">
    {policies.map((policy) => {
      const state = status(policy);
      return <li key={policy.policyId} className="policy-history__item">
        <header>
          <div><small>POLICY ID</small><code title={policy.policyId}>{shortHash(policy.policyId)}</code></div>
          <StatusChip label={state.label} tone={state.tone} pulse={policy.state === "ACTIVE"} />
        </header>
        <dl>
          <div><dt>COVERAGE</dt><dd>{musdc(policy.coverageAmount)} <small>mUSDC</small></dd></div>
          <div><dt>PREMIUM</dt><dd>{musdc(policy.premiumAmount)} <small>mUSDC</small></dd></div>
          <div><dt>UNDERWRITER</dt><dd title={policy.underwriter}>{shortHash(policy.underwriter)}</dd></div>
          <div><dt>ACCEPTED</dt><dd><time dateTime={policy.acceptedAt}>{new Date(policy.acceptedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC</time></dd></div>
        </dl>
        <footer>
          <span>JOB <code title={policy.jobKey}>{shortHash(policy.jobKey)}</code></span>
          <span className="policy-history__links">
            <a href={`${explorer}/tx/${policy.lockTxHash}`} target="_blank" rel="noreferrer">ACCEPT TX ↗</a>
            {policy.settlementTxHash && <a href={`${explorer}/tx/${policy.settlementTxHash}`} target="_blank" rel="noreferrer">SETTLEMENT TX ↗</a>}
          </span>
        </footer>
      </li>;
    })}
  </ol>;
}
