"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ACTIVE_JOURNEY_KEY, isJourneyPath, parseJourneyPath } from "../../lib/journey/active-journey";
import { StatusChip } from "./StatusChip";

const NAV_ITEMS = [
  { href: "/", label: "Overview", index: "01" },
  { href: "/agents", label: "Agents", index: "02" },
  { href: "/jobs/new", label: "Create job", index: "03" },
  { href: "/vault", label: "Liquidity", index: "04" },
] as const;

export interface TechnicalShellProps {
  children: ReactNode;
  walletControl?: ReactNode;
  modeControl?: ReactNode;
  apiOnline?: boolean;
  modeLabel?: string;
  journeyScope?: string;
}

export function TechnicalShell({
  children,
  walletControl,
  modeControl,
  apiOnline = true,
  modeLabel = "LOCAL TWIN",
  journeyScope = "default",
}: TechnicalShellProps) {
  const pathname = usePathname();
  const [journeyHref, setJourneyHref] = useState("/jobs/new");
  useEffect(() => {
    const storageKey = `${ACTIVE_JOURNEY_KEY}:${journeyScope}`;
    if (pathname === "/jobs/new") {
      sessionStorage.removeItem(storageKey);
      setJourneyHref("/jobs/new");
      return;
    }
    const current = parseJourneyPath(pathname);
    if (current) sessionStorage.setItem(storageKey, current);
    setJourneyHref(current ?? parseJourneyPath(sessionStorage.getItem(storageKey)) ?? "/jobs/new");
  }, [journeyScope, pathname]);
  const activeItem = NAV_ITEMS.find((item) => item.href === "/"
    ? pathname === "/"
    : item.href === "/jobs/new"
      ? pathname.startsWith(item.href) || isJourneyPath(pathname)
      : pathname.startsWith(item.href));

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
          <small>AI AGENT INSURANCE</small>
        </Link>

        <nav className="orbital-nav" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const journeyItem = item.href === "/jobs/new";
            const active = item.href === "/" ? pathname === "/" : journeyItem ? pathname.startsWith(item.href) || isJourneyPath(pathname) : pathname.startsWith(item.href);
            const href = journeyItem ? journeyHref : item.href;
            const label = journeyItem && journeyHref !== "/jobs/new" ? "Resume job" : item.label;
            return (
              <Link
                key={item.href}
                href={href}
                className={`orbital-nav__item${active ? " is-active" : ""}${journeyItem ? " is-primary" : ""}`}
                aria-current={active ? "page" : undefined}
                aria-label={label}
              >
                <span aria-hidden="true">{item.index}</span><b>{label}</b>
              </Link>
            );
          })}
        </nav>

        <div className="orbital-system">
          {modeControl}
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
