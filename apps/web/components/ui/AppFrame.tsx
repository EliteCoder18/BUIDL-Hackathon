"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";
import { useExecutionMode } from "../../app/execution-mode-provider";
import { ExecutionModeControl } from "./ExecutionModeControl";
import { TechnicalShell } from "./TechnicalShell";

const ExternalWalletControl = dynamic(
  () => import("../../app/wallet-control").then((module) => module.ExternalWalletControl),
  { ssr: false },
);

export function AppFrame({ children }: { children: ReactNode }) {
  const [apiOnline, setApiOnline] = useState(false);
  const { mode } = useExecutionMode();
  useEffect(() => {
    let active = true;
    const check = () => fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001"}/healthz`)
      .then((response) => { if (active) setApiOnline(response.ok); })
      .catch(() => { if (active) setApiOnline(false); });
    check();
    const timer = window.setInterval(check, 10_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  const wallet = mode === "wallet"
    ? <ExternalWalletControl />
    : <span className="embedded-account"><i />DEMO ACCOUNT</span>;
  return <TechnicalShell apiOnline={apiOnline} modeLabel={mode === "wallet" ? "PUBLIC TESTNET" : "EMBEDDED TWIN"} journeyScope={mode} modeControl={<ExecutionModeControl />} walletControl={wallet}>{children}</TechnicalShell>;
}
