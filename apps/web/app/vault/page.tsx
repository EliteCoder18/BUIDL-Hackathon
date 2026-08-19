"use client";

import { useEffect, useState } from "react";
import { LossWaterfall } from "../../components/policy/LossWaterfall";
import { MetricReadout } from "../../components/ui/MetricReadout";
import { StatusChip } from "../../components/ui/StatusChip";
import { TechnicalPanel } from "../../components/ui/TechnicalPanel";
import type { VaultResource } from "../../lib/api";
import { useTrustFuturesApi } from "../../lib/orchestration";

const units = (value?: string) => value ? Number(value) / 1e6 : 0;
export default function VaultPage() {
  const api = useTrustFuturesApi();
  const [vault, setVault] = useState<VaultResource>();
  const [error, setError] = useState("");
  useEffect(() => { api.getVault().then(setVault).catch((cause) => setError(cause instanceof Error ? cause.message : "Vault unavailable")); }, [api]);
  const assets = units(vault?.totalAssets); const reserved = units(vault?.reserved); const utilization = assets ? reserved / assets * 100 : 0;
  return <div className="route-stack"><header className="route-heading"><div><p className="kicker">CREDITCOIN CC3 / ERC-4626-STYLE VAULT</p><h1>Senior capital telemetry</h1><p>LP liquidity supplies 80% of every accepted bond after the underwriter posts first-loss capital.</p></div><StatusChip label="TESTNET ASSETS ONLY" tone="warning" /></header>{error && <div className="error-banner">{error}</div>}
  <div className="dashboard-grid dashboard-grid--metrics"><MetricReadout label="TOTAL ASSETS" value={assets.toLocaleString()} detail="mUSDC" tone="cyan" /><MetricReadout label="RESERVED" value={reserved.toLocaleString()} detail="ACTIVE POLICIES" tone="amber" /><MetricReadout label="FREE LIQUIDITY" value={units(vault?.freeAssets).toLocaleString()} detail="AVAILABLE TO LOCK" tone="green" /><MetricReadout label="UTILIZATION" value={`${utilization.toFixed(1)}%`} detail="RESERVED / ASSETS" /></div>
  <TechnicalPanel eyebrow="CAPITAL STRUCTURE" title="Junior first-loss protects senior liquidity"><LossWaterfall coverage={1_000} state="CREDITCOIN_POLICY_LOCKED" /><div className="vault-utilization"><header><span>VAULT UTILIZATION</span><strong>{utilization.toFixed(2)}%</strong></header><div><i style={{ width: `${utilization}%` }} /></div></div></TechnicalPanel>
  <div className="proof-detail-grid"><TechnicalPanel eyebrow="PREMIUM ROUTING" title="Success distribution"><div className="distribution-ring"><div><strong>70%</strong><span>SENIOR LPs</span></div><div><strong>30%</strong><span>UNDERWRITER</span></div></div></TechnicalPanel><TechnicalPanel eyebrow="LOSS ROUTING" title="Objective violation"><div className="spec-ledger"><span><b>01</b> CONSUME 20% JUNIOR STAKE</span><span><b>02</b> DRAW 80% SENIOR RESERVE</span><span><b>03</b> PAY 100% COVERAGE TO CLIENT</span><span><b>04</b> UPDATE ATTESTED AGENT HISTORY</span></div></TechnicalPanel></div>
  </div>;
}
