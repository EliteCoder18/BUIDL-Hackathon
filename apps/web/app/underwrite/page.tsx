"use client";

import { useEffect, useState, type FormEvent } from "react";
import { isAddress, isHash, keccak256, parseUnits, toBytes } from "viem";
import { useAccount } from "wagmi";
import { PublicCapitalDesk } from "../../components/transactions/PublicCapitalDesk";
import { StatusChip } from "../../components/ui/StatusChip";
import { TechnicalPanel } from "../../components/ui/TechnicalPanel";
import { TransactionStatus } from "../../components/wallet/TransactionStatus";
import { loadDeploymentManifest, type TestnetDeploymentManifest } from "../../lib/contracts/deployments";
import { buildAcceptQuotePlan, buildApprovePlan } from "../../lib/contracts/transactions";
import { validateQuoteEnvelope } from "../../lib/contracts/quote-envelope";
import type { Quote } from "../../lib/trustfutures/types";
import { useSignQuote } from "../../lib/wallet/useSignQuote";
import { useTransactionAction } from "../../lib/wallet/useTransactionAction";

interface PortableQuote {
  quote: Record<keyof Quote, string>;
  signature: `0x${string}`;
}

function quoteFromEnvelope(envelope: PortableQuote): Quote {
  const quote = envelope.quote;
  if (!isHash(quote.jobKey) || !isAddress(quote.underwriter) || !isHash(quote.modelHash)) throw new Error("Quote envelope contains invalid identifiers.");
  return { jobKey: quote.jobKey, underwriter: quote.underwriter, modelHash: quote.modelHash, coverageAmount: BigInt(quote.coverageAmount), premiumAmount: BigInt(quote.premiumAmount), juniorAmount: BigInt(quote.juniorAmount), validUntil: BigInt(quote.validUntil), nonce: BigInt(quote.nonce) };
}

export default function UnderwritePage() {
  const { address, isConnected } = useAccount();
  const signer = useSignQuote();
  const action = useTransactionAction();
  const [deployment, setDeployment] = useState<TestnetDeploymentManifest>();
  const [envelope, setEnvelope] = useState("");
  const [imported, setImported] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { loadDeploymentManifest().then(setDeployment).catch((cause) => setError(cause instanceof Error ? cause.message : "Deployment unavailable")); }, []);

  async function sign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!deployment || !address) { setError("Connect MetaMask before signing as an underwriter."); return; }
    try {
      const data = new FormData(event.currentTarget);
      const jobKey = String(data.get("jobKey"));
      if (!isHash(jobKey)) throw new Error("Job key must be a 32-byte hex value.");
      const coverageAmount = parseUnits(String(data.get("coverage")), 6);
      if (coverageAmount <= 0n || coverageAmount > parseUnits("1000", 6)) throw new Error("Coverage must be between 0 and 1,000 mUSDC.");
      const premiumAmount = parseUnits(String(data.get("premium")), 6);
      const quote: Quote = {
        jobKey, underwriter: address, coverageAmount, premiumAmount,
        juniorAmount: coverageAmount / 5n,
        validUntil: BigInt(Math.floor(Date.now() / 1000) + 3600),
        modelHash: keccak256(toBytes("trustfutures-public-manual-quote-v1")),
        nonce: BigInt(String(data.get("nonce"))),
      };
      if (quote.juniorAmount * 5n !== quote.coverageAmount) throw new Error("Coverage must divide cleanly into a 20% junior tranche.");
      const signature = await signer.signQuote({ chainId: 102031, verifyingContract: deployment.creditcoin.policyManager }, quote);
      const portable = JSON.stringify({ quote, signature }, (_, value) => typeof value === "bigint" ? value.toString() : value, 2);
      setEnvelope(portable);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Quote signing failed"); }
  }

  async function accept() {
    setError("");
    if (!deployment) return;
    try {
      const parsed = JSON.parse(imported) as PortableQuote;
      const { quote, signature } = await validateQuoteEnvelope(parsed, deployment.creditcoin.policyManager, BigInt(Math.floor(Date.now() / 1000)));
      if (quote.premiumAmount > 0n) await action.run(buildApprovePlan(102031, deployment.creditcoin.mockUsdc, deployment.creditcoin.policyManager, quote.premiumAmount));
      await action.run(buildAcceptQuotePlan(deployment.creditcoin.policyManager, quote, signature));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Quote acceptance failed"); }
  }

  return <div className="route-stack">
    <header className="route-heading"><div><p className="kicker">CREDITCOIN CC3 / NON-CUSTODIAL MARKET DESK</p><h1>Sign risk. Lock capital.</h1><p>Underwriters create portable EIP-712 bids locally. Clients import a signed envelope, approve its exact premium, and lock the 20/80 policy on CC3.</p></div><StatusChip label="NO BROWSER KEYS STORED" tone="success" pulse /></header>
    <PublicCapitalDesk />
    <div className="underwrite-grid">
      <TechnicalPanel eyebrow="UNDERWRITER CONSOLE" title="Create a canonical signed quote"><form className="technical-form" onSubmit={sign}><label><span>JOB KEY</span><input name="jobKey" placeholder="0x…" required /></label><div className="form-pair"><label><span>COVERAGE / mUSDC</span><input name="coverage" defaultValue="500" inputMode="decimal" required /></label><label><span>PREMIUM / mUSDC</span><input name="premium" defaultValue="25" inputMode="decimal" required /></label></div><label><span>NONCE</span><input name="nonce" defaultValue="1" inputMode="numeric" required /></label><button className="technical-button technical-button--primary technical-button--wide" disabled={!isConnected || signer.isPending}>SIGN EIP-712 QUOTE</button></form>{envelope && <div className="portable-envelope"><header><span>PORTABLE QUOTE ENVELOPE</span><button onClick={() => navigator.clipboard.writeText(envelope)}>COPY JSON</button></header><pre>{envelope}</pre></div>}</TechnicalPanel>
      <TechnicalPanel eyebrow="CLIENT CONSOLE" title="Accept a portable quote"><label className="envelope-input"><span>PASTE SIGNED QUOTE JSON</span><textarea value={imported} onChange={(event) => setImported(event.target.value)} placeholder={'{"quote": {…}, "signature": "0x…"}'} /></label><button className="technical-button technical-button--primary technical-button--wide" disabled={!isConnected || !imported || action.busy} onClick={accept}>APPROVE PREMIUM + LOCK POLICY</button>{(error || action.phase !== "idle") && <TransactionStatus phase={error ? "error" : action.phase} chainId={102031} hash={action.hash} error={error || action.error} />}<div className="simulation-disclosure"><strong>MULTI-PARTY BY DESIGN</strong><p>The signer must already have junior stake; the vault must have senior liquidity. Share the JSON out-of-band—private keys never leave either wallet.</p></div></TechnicalPanel>
    </div>
  </div>;
}
