"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";
import { resolveWalletMode } from "../../lib/wallet/mode";
import { TechnicalShell } from "./TechnicalShell";

const ExternalWalletControl = dynamic(
  () => import("../../app/wallet-control").then((module) => module.ExternalWalletControl),
  { ssr: false },
);

export function AppFrame({ children }: { children: ReactNode }) {
  const [apiOnline, setApiOnline] = useState(false);
  const walletMode = resolveWalletMode(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID);
  useEffect(() => {
    let active = true;
    const check = () => fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001"}/healthz`)
      .then((response) => { if (active) setApiOnline(response.ok); })
      .catch(() => { if (active) setApiOnline(false); });
    check();
    const timer = window.setInterval(check, 10_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  const wallet = walletMode.kind === "external"
    ? <ExternalWalletControl />
    : <span className="embedded-account"><i />EMBEDDED DEMO ACCOUNT</span>;
  return <TechnicalShell apiOnline={apiOnline} modeLabel="LOCAL DIGITAL TWIN" walletControl={wallet}>{children}</TechnicalShell>;
}
