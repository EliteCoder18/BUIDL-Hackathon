"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useMemo, useState } from "react";

type Quote = { name: string; risk: string; premium: string; tone: string };
type ApiQuote = { strategy: string; failureProbabilityBps: number; premiumAmount: string };

const quotes: Quote[] = [
  { name: "Aegis", risk: "6.8%", premium: "8.4 mUSDC", tone: "conservative" },
  { name: "Vector", risk: "5.1%", premium: "6.8 mUSDC", tone: "balanced" },
  { name: "Orbit", risk: "3.9%", premium: "5.6 mUSDC", tone: "aggressive" },
];

export default function Page() {
  const [marketQuotes, setMarketQuotes] = useState(quotes);
  const [selected, setSelected] = useState(1);
  const [settlement, setSettlement] = useState<"active" | "failure" | "success">("active");
  const [policyMessage, setPolicyMessage] = useState("Select a quote to inspect its collateral split.");
  useEffect(() => {
    const api = process.env.NEXT_PUBLIC_API_URL;
    if (!api) return;
    fetch(`${api}/v1/quotes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobKey: "0x0000000000000000000000000000000000000000000000000000000000000449", coverageAmount: "100000000", history: { successCount: 18, violationCount: 0, expiryCount: 0, meanSlippageBps: 23, meanLatenessBps: 8, amountVsP95Bps: 10000, deadlineTightnessBps: 280, volatilityBps: 300 } }) })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(({ quotes: result }: { quotes: ApiQuote[] }) => setMarketQuotes(result.map((quote, index) => ({ name: ["Aegis", "Vector", "Orbit"][index], risk: `${(quote.failureProbabilityBps / 100).toFixed(1)}%`, premium: `${(Number(quote.premiumAmount) / 1_000_000).toFixed(2)} mUSDC`, tone: quote.strategy }))))
      .catch(() => undefined);
  }, []);
  const selectedQuote = useMemo(() => marketQuotes[selected] ?? marketQuotes[0], [marketQuotes, selected]);
  return (
    <main>
      <header>
        <div className="brand">TRUST<span>FUTURES</span></div>
        <nav><a href="#agents">Agents</a><a href="#market">Market</a><a href="#proof">Proofs</a><ConnectButton showBalance={false} /></nav>
      </header>
      <section className="hero">
        <p className="eyebrow">Cross-chain performance bonds for ERC-8004 agents</p>
        <h1>Hire any AI agent.<br /><i>Market prices failure.</i></h1>
        <p className="lede">Sepolia work outcomes. Attestcoin verification. Creditcoin capital. One deterministic payout when mandate trust breaks.</p>
        <div className="hero-actions"><button className="primary" onClick={() => document.getElementById("market")?.scrollIntoView({ behavior: "smooth" })}>Create insured job</button><button className="ghost" onClick={() => document.getElementById("proof")?.scrollIntoView({ behavior: "smooth" })}>Watch settlement</button></div>
        <div className="signal"><span className="pulse" /> 3 autonomous underwriters online · CC3 testnet</div>
      </section>
      <section id="agents" className="grid agent-grid"><p className="eyebrow">Agent market</p>
        <article className="card agent"><div className="avatar">τ</div><div><p className="eyebrow">ERC-8004 #1842</p><h2>Treasury Delta</h2><p>Rebalances stablecoin treasury within hard slippage and deadline mandate.</p></div><div className="metrics"><b>92.4%</b><span>attested success</span><b>18</b><span>verified jobs</span></div></article>
        <article className="card risk"><p className="eyebrow">Model verdict</p><h2>{selectedQuote.risk} failure risk</h2><p>History, mandate size, volatility, deadline pressure.</p><div className="factor">↓ 0 violations in last 18 jobs</div><div className="factor">↑ Market volatility 300 bps</div></article>
      </section>
      <section id="market" className="section"><div className="section-title"><div><p className="eyebrow">Quote auction</p><h2>Junior capital meets pooled liquidity.</h2></div><span className="live">LIVE</span></div><div className="quotes">{marketQuotes.map((quote, index) => <button className={`quote ${selected === index ? "selected" : ""}`} key={quote.name} onClick={() => { setSelected(index); setPolicyMessage(`${quote.name} selected. Review risk and premium before signing.`); }}><span>{quote.name}</span><b>{quote.risk}</b><small>failure probability</small><strong>{quote.premium}</strong><small>{quote.tone} premium</small></button>)}</div><div className="policy"><div><p className="eyebrow">Selected policy</p><h3>{selectedQuote.name} guarantees 100 mUSDC treasury mandate</h3><p>20 mUSDC junior first-loss stake · 80 mUSDC senior LP capital · premium split 30/70 on success.</p><small>{policyMessage}</small></div><button className="primary" onClick={() => setPolicyMessage(`Demo acceptance ready for ${selectedQuote.name}. Connect a funded CC3 wallet after testnet deployment to sign the EIP-712 quote.`)}>Accept {selectedQuote.premium} quote</button></div></section>
      <section id="proof" className="grid proof-grid"><article className="card"><p className="eyebrow">Proof explorer</p><h2>Sepolia outcome <span className={settlement}>● {settlement}</span></h2><ol><li>Job #449 opened on Ethereum Sepolia</li><li>Agent mandate attested through Attestcoin</li><li>Creditcoin policy locks 20/80 capital</li><li>{settlement === "active" ? "Awaiting objective outcome" : settlement === "failure" ? "Client payout confirmed" : "Capital released and premium distributed"}</li></ol><div className="row"><button onClick={() => setSettlement("failure")}>Simulate violation</button><button onClick={() => setSettlement("success")}>Simulate success</button></div></article><article className="card vault"><p className="eyebrow">LP vault</p><h2>482.0 mUSDC</h2><p>Senior liquidity backing attested agent mandates.</p><div className="vault-bar"><span style={{ width: "38%" }} /></div><div className="split-metrics"><span>38% utilized<b>183.2 mUSDC</b></span><span>12 policies<b>7.1% APY*</b></span></div><small>*testnet simulated yield</small></article></section>
      <footer>TrustFutures · Testnet-only prototype · No mainnet funds or legal insurance claims.</footer>
    </main>
  );
}
