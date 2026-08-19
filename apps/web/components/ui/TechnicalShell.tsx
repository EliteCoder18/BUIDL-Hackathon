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
  const activeItem = NAV_ITEMS.find((item) => item.href === "/" ? pathname === "/" : pathname.startsWith(item.href));

  return (
    <div className="eclipse-shell">
      <div className="eclipse-ambience" aria-hidden="true">
        <span className="eclipse-ambience__halo" />
        <span className="eclipse-ambience__orbit eclipse-ambience__orbit--one" />
        <span className="eclipse-ambience__orbit eclipse-ambience__orbit--two" />
        <span className="eclipse-ambience__grain" />
      </div>

      <header className="orbital-dock">
        <Link className="orbital-brand" href="/" aria-label="TrustFutures operations home">
          <span className="orbital-brand__sigil" aria-hidden="true"><i /><i /></span>
          <span className="orbital-brand__wordmark"><strong>TRUST</strong><em>FUTURES</em></span>
          <small>RISK OBSERVATORY</small>
        </Link>

        <nav className="orbital-nav" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={`orbital-nav__item${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}>
                <span>{item.index}</span><b>{item.label}</b>
              </Link>
            );
          })}
        </nav>

        <div className="orbital-system">
          <div className="orbital-system__state">
            <StatusChip label={apiOnline ? "SYNCHRONIZED" : "OFFLINE"} tone={apiOnline ? "success" : "danger"} pulse={apiOnline} />
            <span className="orbital-system__mode">{modeLabel}</span>
          </div>
          {walletControl && <div className="orbital-system__wallet">{walletControl}</div>}
        </div>
      </header>

      <aside className="edge-coordinate" aria-hidden="true">
        <span>{activeItem?.index ?? "00"}</span>
        <i />
        <b>{activeItem?.label.toUpperCase() ?? "MARKET"}</b>
      </aside>

      <aside className="chain-constellation" aria-label="Connected networks">
        <span><i className="network-dot network-dot--sepolia" />SEPOLIA</span>
        <span><i className="network-dot network-dot--attestcoin" />ATTESTCOIN</span>
        <span><i className="network-dot network-dot--creditcoin" />CREDITCOIN CC3</span>
      </aside>

      <main className="eclipse-workspace">{children}</main>
    </div>
  );
}
