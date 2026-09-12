export interface WalletStepView { label: string; chain: string; status: "pending" | "active" | "confirmed"; hash?: string }

export function WalletTransactionStepper({ steps, busy, error, onAdvance, retry }: { steps: WalletStepView[]; busy: boolean; error?: string; onAdvance: () => void; retry?: { label: string; onClick: () => void } }) {
  const active = steps.find((step) => step.status === "active");
  return <section className="wallet-stepper" aria-live="polite" aria-busy={busy}>
    <header><span>METAMASK TRANSACTION PLAN</span><strong>{active ? `${active.chain} · ${active.label}` : "CLIENT SIGNATURES CONFIRMED"}</strong></header>
    <ol>{steps.map((step, index) => <li key={`${step.chain}:${step.label}`} className={`wallet-step wallet-step--${step.status}`}><b>{String(index + 1).padStart(2, "0")}</b><span><strong>{step.label}</strong><small>{step.chain}{step.hash ? ` · ${step.hash.slice(0, 10)}…${step.hash.slice(-6)}` : ""}</small></span></li>)}</ol>
    {error && <p className="form-error" role="alert">{error}</p>}
    {active && <button type="button" className="technical-button technical-button--primary technical-button--wide" disabled={busy} onClick={onAdvance}>{busy ? "AWAITING CONFIRMATION…" : `CONTINUE IN METAMASK · ${active.chain}`}</button>}
    {!active && retry && <button type="button" className="technical-button technical-button--primary technical-button--wide" disabled={busy} onClick={retry.onClick}>{busy ? "REQUESTING SIGNED QUOTES…" : retry.label}</button>}
  </section>;
}
