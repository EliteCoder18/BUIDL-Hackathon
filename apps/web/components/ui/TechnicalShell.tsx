"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { StatusChip } from "./StatusChip";

const NAV_ITEMS = [
  { href: "/", label: "Operations", index: "01" },
  { href: "/agents", label: "Agents", index: "02" },
  { href: "/jobs/new", label: "Create job", index: "03" },
  { href: "/vault", label: "LP vault", index: "04" },
] as const;

export interface TechnicalShellProps {
  children: ReactNode;
  walletControl?: ReactNode;
  apiOnline?: boolean;
  modeLabel?: string;
}

export function TechnicalShell({
  children,
  walletControl,
  apiOnline = true,
  modeLabel = "LOCAL TWIN",
}: TechnicalShellProps) {
  const pathname = usePathname();

  return (
    <div className="technical-shell">
      <aside className="technical-shell__sidebar">
        <Link className="technical-shell__brand" href="/" aria-label="TrustFutures operations home">
          <span className="technical-shell__brand-mark" aria-hidden="true">TF</span>
          <span><strong>TRUST</strong>FUTURES</span>
        </Link>
        <p className="technical-shell__descriptor">AI AGENT RELIABILITY MARKET</p>
        <nav className="technical-shell__nav" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={`technical-shell__nav-item${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}>
                <span>{item.index}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="technical-shell__network-stack" aria-label="Connected networks">
          <span><i className="network-dot network-dot--green" />SEPOLIA</span>
          <span><i className="network-dot network-dot--cyan" />ATTESTCOIN</span>
          <span><i className="network-dot network-dot--amber" />CREDITCOIN CC3</span>
        </div>
      </aside>
      <div className="technical-shell__workspace">
        <header className="technical-shell__topbar">
          <div className="technical-shell__system-state">
            <StatusChip label={apiOnline ? "API SYNCHRONIZED" : "API OFFLINE"} tone={apiOnline ? "success" : "danger"} pulse={apiOnline} />
            <span className="technical-shell__mode">{modeLabel}</span>
          </div>
          {walletControl && <div className="technical-shell__wallet">{walletControl}</div>}
        </header>
        <main className="technical-shell__content">{children}</main>
      </div>
    </div>
  );
}

