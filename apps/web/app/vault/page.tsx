"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useAccount } from "wagmi";
import { LossWaterfall } from "../../components/policy/LossWaterfall";
import { MetricReadout } from "../../components/ui/MetricReadout";
import { StatusChip } from "../../components/ui/StatusChip";
import { TechnicalPanel } from "../../components/ui/TechnicalPanel";
import type { VaultResource } from "../../lib/api";
import { useTrustFuturesApi } from "../../lib/orchestration";
import { useExecutionMode } from "../execution-mode-provider";

const units = (value?: string) => value === undefined ? undefined : Number(value) / 1e6;
const displayNumber = (value?: number) => value === undefined ? "—" : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
const displayUnits = (value?: string) => displayNumber(units(value));
export default function VaultPage() {
  const api = useTrustFuturesApi();
  const { mode } = useExecutionMode();
  const { address } = useAccount();
  const [vault, setVault] = useState<VaultResource>();
  const [activePolicyCount, setActivePolicyCount] = useState<number>();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setVault(undefined);
    setActivePolicyCount(undefined);
    setError("");

    if (mode === "wallet" && !address) {
      setError("Connect MetaMask to read the live Creditcoin vault.");
      return () => { active = false; };
    }

    if (mode === "wallet") {
      const capitalRequest = api.getLiveVault().then((nextVault) => {
        if (active) setVault(nextVault);
        return nextVault;
      });
      const historyRequest = api.getLiveMarket(address!).then((market) => {
        if (active) {
          setVault((current) => current ?? market.vault);
          setActivePolicyCount(market.activePolicyCount);
        }
        return market;
      });
      Promise.allSettled([capitalRequest, historyRequest]).then(([capital, history]) => {
        if (!active || capital.status === "fulfilled" || history.status === "fulfilled") return;
        const cause = capital.reason;
        setError(cause instanceof Error ? cause.message : "Vault unavailable");
      });
    } else {
      api.getVault().then((nextVault) => {
        if (active) setVault(nextVault);
      }).catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Vault unavailable");
      });
    }
    return () => { active = false; };
  }, [address, api, mode]);
  const assets = units(vault?.totalAssets);
  const reserved = units(vault?.reserved);
  const freeAssets = units(vault?.freeAssets);
  const utilization = assets && reserved !== undefined ? reserved / assets * 100 : undefined;
  const boundedUtilization = Math.min(100, Math.max(0, utilization ?? 0));
  const coverageCapacity = freeAssets === undefined ? undefined : freeAssets / 0.8;
  const activeCoverage = reserved === undefined ? undefined : reserved / 0.8;
  const matchedJunior = reserved === undefined ? undefined : reserved / 4;
  return <div className="route-stack vault-route"><header className="route-heading vault-heading"><div><p className="kicker">CREDITCOIN CC3 / ERC-4626-STYLE VAULT</p><h1>Senior capital telemetry</h1><p>LP liquidity supplies 80% of every accepted bond after the underwriter posts first-loss capital.</p></div><StatusChip label={vault ? "CAPITAL ONLINE" : error ? "VAULT OFFLINE" : "READING VAULT"} tone={vault ? "success" : error ? "danger" : "warning"} pulse={!error} /></header>{error && <div className="error-banner">{error}</div>}
  <div className="dashboard-grid dashboard-grid--metrics"><MetricReadout label="TOTAL ASSETS" value={displayUnits(vault?.totalAssets)} detail="mUSDC" explanation="All senior liquidity currently held by the Creditcoin coverage vault." tone="cyan" /><MetricReadout label="RESERVED" value={displayUnits(vault?.reserved)} detail="mUSDC" explanation="Senior capital already committed to active performance guarantees." tone="amber" /><MetricReadout label="FREE LIQUIDITY" value={displayUnits(vault?.freeAssets)} detail="mUSDC" explanation="Capital available to support new agent mandates." tone="green" /><MetricReadout label={mode === "wallet" ? "ACTIVE POLICIES" : "UTILIZATION"} value={mode === "wallet" ? activePolicyCount ?? "—" : utilization === undefined ? "—" : `${utilization.toFixed(1)}%`} detail={mode === "wallet" ? "CREDITCOIN CC3" : "RESERVED / ASSETS"} explanation="Utilization is reserved capital divided by total vault assets." /></div>
  <TechnicalPanel eyebrow="LIQUIDITY COMMAND CENTER" title="Capacity, commitment, and protection" explanation="This view separates capital already locked behind guarantees from liquidity that can still underwrite new mandates.">
    <div className="vault-command-grid">
      <div className="vault-orbit" style={{ "--vault-fill": `${boundedUtilization * 3.6}deg` } as CSSProperties} role="progressbar" aria-label="Vault utilization" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(boundedUtilization)}>
        <div className="vault-orbit__core"><small>UTILIZATION</small><strong>{utilization === undefined ? "—" : `${utilization.toFixed(1)}%`}</strong><span>{activePolicyCount === undefined ? mode === "wallet" ? "READING POLICIES" : "EMBEDDED MARKET" : `${activePolicyCount} ACTIVE ${activePolicyCount === 1 ? "POLICY" : "POLICIES"}`}</span></div>
        <i className="vault-orbit__satellite" aria-hidden="true" />
      </div>
      <div className="vault-capacity-ledger">
        <header><span>AVAILABLE COVERAGE CAPACITY</span><strong>{displayNumber(coverageCapacity)} <small>mUSDC</small></strong><p>Free senior liquidity can support 80% of this additional coverage.</p></header>
        <dl>
          <div><dt>ACTIVE COVERAGE</dt><dd>{displayNumber(activeCoverage)} mUSDC</dd><span className="vault-capacity-ledger__bar"><i style={{ width: `${boundedUtilization}%` }} /></span></div>
          <div><dt>SENIOR CAPITAL LOCKED</dt><dd>{displayNumber(reserved)} mUSDC</dd></div>
          <div><dt>UNDERWRITER FIRST-LOSS MATCH</dt><dd>{displayNumber(matchedJunior)} mUSDC</dd></div>
        </dl>
        <footer><span><i className="network-dot network-dot--creditcoin" />80% SENIOR VAULT</span><span><i className="network-dot network-dot--sepolia" />20% JUNIOR FIRST LOSS</span></footer>
      </div>
    </div>
  </TechnicalPanel>
  <TechnicalPanel eyebrow="CAPITAL STRUCTURE" title="Junior first-loss protects senior liquidity" explanation="For every 100 mUSDC of coverage, the underwriter risks 20 first. The vault supplies the remaining 80 and earns most of the premium."><LossWaterfall coverage={1_000} state="CREDITCOIN_POLICY_LOCKED" /><div className="vault-utilization"><header><span>VAULT UTILIZATION</span><strong>{utilization === undefined ? "—" : `${utilization.toFixed(2)}%`}</strong></header><div><i style={{ width: `${boundedUtilization}%` }} /></div></div></TechnicalPanel>
  <div className="proof-detail-grid"><TechnicalPanel eyebrow="PREMIUM ROUTING" title="Success distribution" explanation="When the agent succeeds, reserved capital unlocks and the premium is split between senior LPs and the underwriter."><div className="distribution-ring"><div><strong>70%</strong><span>SENIOR LPs</span></div><div><strong>30%</strong><span>UNDERWRITER</span></div></div></TechnicalPanel><TechnicalPanel eyebrow="LOSS ROUTING" title="Objective violation" explanation="A verified violation pays the client. Junior capital is consumed before any senior reserve is drawn."><div className="spec-ledger"><span><b>01</b> CONSUME 20% JUNIOR STAKE</span><span><b>02</b> DRAW 80% SENIOR RESERVE</span><span><b>03</b> PAY 100% COVERAGE TO CLIENT</span><span><b>04</b> UPDATE ATTESTED AGENT HISTORY</span></div></TechnicalPanel></div>
  </div>;
}
