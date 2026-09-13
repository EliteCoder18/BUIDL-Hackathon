"use client";

import type { AgentResource, AgentRiskResource } from "../../lib/api";
import { riskChartModel } from "../risk/risk-model";
import { TechnicalPanel } from "../ui/TechnicalPanel";
import { buildAgentProfile } from "./agent-profile-model";

const shortHash = (value?: string) => value ? `${value.slice(0, 10)}…${value.slice(-8)}` : "Unavailable";

function readableFeature(name: string) {
  return name.replace(/_bps$/i, "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function AgentProfileCard({ agent, risk }: { agent: AgentResource; risk: AgentRiskResource }) {
  const profile = buildAgentProfile(agent.history);
  const chart = riskChartModel(risk.features);
  const sourceLabel = risk.source.includes("fallback") ? "FALLBACK MODEL" : "MODEL VERIFIED";
  const registryId = agent.agentId.padStart(4, "0");

  return <TechnicalPanel
    eyebrow={`ERC-8004 / REGISTRY #${registryId}`}
    title={agent.name}
    explanation="Recorded mandate outcomes and calibrated model signals determine whether this agent is coverable and how its bond is priced."
  >
    <article className="agent-profile">
      <div className="agent-profile__identity">
        <div className={`agent-sigil agent-sigil--${Number(agent.agentId) % 2}`} aria-hidden="true">
          <svg viewBox="0 0 120 120"><path d="M60 10 103 35v50L60 110 17 85V35Z" /><path d="M36 48 60 34l24 14v28L60 90 36 76Z" /><circle cx="60" cy="60" r="7" /></svg>
        </div>
        <div className="agent-profile__nameplate">
          <span><i /> IDENTITY VERIFIED</span>
          <strong>Registered execution agent</strong>
          <code>agent://erc-8004/{agent.agentId}</code>
          <div><b className={risk.source.includes("fallback") ? "is-warning" : "is-verified"}>{sourceLabel}</b><b>SWAP EXECUTION</b><b>SEPOLIA</b></div>
        </div>
        <div className="agent-profile__score">
          <small>HISTORICAL RELIABILITY</small>
          <strong>{profile.reliability.toFixed(1)}%</strong>
          <span>{agent.history.successCount} successful of {profile.completedMandates} recorded</span>
        </div>
      </div>

      <div className="agent-outcomes" aria-label={`${agent.history.successCount} successful, ${agent.history.violationCount} violated, ${agent.history.expiryCount} expired mandates`}>
        <header><span>ATTESTED MANDATE HISTORY</span><strong>{profile.completedMandates} TOTAL</strong></header>
        <div className="agent-outcomes__track">
          {profile.outcomes.map((outcome) => <i key={outcome.label} className={`agent-outcomes__segment agent-outcomes__segment--${outcome.tone}`} style={{ width: `${outcome.share}%` }} />)}
        </div>
        <div className="agent-outcomes__legend">
          {profile.outcomes.map((outcome) => <span key={outcome.label}><i className={`agent-outcomes__dot agent-outcomes__dot--${outcome.tone}`} /><b>{outcome.count}</b> {outcome.label}</span>)}
        </div>
      </div>

      <dl className="agent-operating-ledger">
        <div><dt>MEAN SLIPPAGE</dt><dd>{agent.history.meanSlippageBps} <small>BPS</small></dd></div>
        <div><dt>MEAN LATENESS</dt><dd>{agent.history.meanLatenessBps} <small>BPS</small></dd></div>
        <div><dt>MODEL CONFIDENCE</dt><dd>{(risk.confidence * 100).toFixed(0)}<small>%</small></dd></div>
        <div><dt>NEXT-JOB FAILURE RISK</dt><dd className="is-risk">{(risk.failureProbabilityBps / 100).toFixed(1)}<small>%</small></dd></div>
      </dl>

      <section className="agent-risk-ledger">
        <header><div><span>MODEL DECISION BASIS</span><strong>Risk contribution by observed signal</strong></div><code>{risk.modelVersion}</code></header>
        <div className="agent-risk-ledger__rows">
          {chart.rows.map((feature) => <div className="agent-risk-row" key={feature.name}>
            <span>{readableFeature(feature.name)}<small>OBSERVED {feature.valueLabel}</small></span>
            <div><i className={`agent-risk-row__bar agent-risk-row__bar--${feature.direction}`} style={{ width: `${Math.max(feature.magnitude, feature.magnitude ? 3 : 0)}%` }} /></div>
            <strong className={`agent-risk-row__impact agent-risk-row__impact--${feature.direction}`}>{feature.shapValue > 0 ? "+" : ""}{feature.impactLabel}</strong>
          </div>)}
        </div>
        <footer><span><i className="agent-outcomes__dot agent-outcomes__dot--success" />LOWERS RISK</span><span><i className="agent-outcomes__dot agent-outcomes__dot--violation" />RAISES RISK</span></footer>
      </section>

      <details className="agent-model-evidence">
        <summary>Audit model evidence</summary>
        <div><span><small>SOURCE</small><strong>{risk.source}</strong></span><span><small>CALIBRATION</small><strong>{risk.calibrationMethod ?? "Unavailable"}</strong></span><span><small>LIVE OUTCOMES</small><strong>{risk.dataLineage?.liveOutcomeCount ?? 0}</strong></span><span><small>MODEL HASH</small><code>{shortHash(risk.modelHash)}</code></span></div>
      </details>
    </article>
  </TechnicalPanel>;
}
