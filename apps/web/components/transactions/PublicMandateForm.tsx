"use client";

import { useEffect, useState, type FormEvent } from "react";
import { parseEventLogs, parseUnits, type Hash } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { loadDeploymentManifest, type TestnetDeploymentManifest } from "../../lib/contracts/deployments";
import { treasuryJobManagerAbi } from "../../lib/contracts/abis";
import { buildApprovePlan, buildCreateJobPlan, buildMintPlan, deriveJobKey } from "../../lib/contracts/transactions";
import { useCrossChainOrchestrator } from "../../lib/orchestration";
import { publicSepolia } from "../../lib/wallet/chains";
import { useTransactionAction } from "../../lib/wallet/useTransactionAction";
import { SagaRail } from "../dashboard/SagaRail";
import { StatusChip } from "../ui/StatusChip";
import { TechnicalPanel } from "../ui/TechnicalPanel";
import { TransactionStatus } from "../wallet/TransactionStatus";

function positiveInteger(value: FormDataEntryValue | null, label: string): bigint {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) throw new Error(`${label} must be a positive whole number.`);
  const parsed = BigInt(text);
  if (parsed <= 0n) throw new Error(`${label} must be positive.`);
  return parsed;
}

export function PublicMandateForm() {
  const { address, isConnected } = useAccount();
  const client = usePublicClient({ chainId: publicSepolia.id });
  const { state, send } = useCrossChainOrchestrator();
  const action = useTransactionAction();
  const [deployment, setDeployment] = useState<TestnetDeploymentManifest>();
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ jobId: bigint; jobKey: Hash; transactionHash: Hash }>();

  useEffect(() => { loadDeploymentManifest().then(setDeployment).catch((cause) => setError(cause instanceof Error ? cause.message : "Deployment unavailable")); }, []);

  async function mintTestAssets() {
    if (!deployment || !address) return;
    setError("");
    try { await action.run(buildMintPlan(11155111, deployment.sepolia.mockUsdc, address, parseUnits("500", 6))); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Mint failed"); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setCreated(undefined);
    if (!deployment || !address || !client) { setError("Connect MetaMask and wait for deployment metadata before continuing."); return; }
    try {
      const data = new FormData(event.currentTarget);
      const agentId = positiveInteger(data.get("agentId"), "Agent ID");
      const amountIn = parseUnits(String(data.get("amountIn")), 6);
      const minOut = parseUnits(String(data.get("minOut")), 6);
      const deadlineSeconds = Number(positiveInteger(data.get("deadlineSeconds"), "Deadline"));
      if (deadlineSeconds < 300 || deadlineSeconds > 86_400) throw new Error("Deadline must be between 5 minutes and 24 hours.");
      const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);
      const predictedJobId = await client.readContract({ address: deployment.sepolia.treasuryJobManager, abi: treasuryJobManagerAbi, functionName: "nextJobId" });
      const predictedJobKey = deriveJobKey(deployment.sepolia.treasuryJobManager, predictedJobId);

      send({ type: "RESET" });
      send({ type: "START_MANDATE", jobKey: predictedJobKey });
      await action.run(buildApprovePlan(11155111, deployment.sepolia.mockUsdc, deployment.sepolia.treasuryJobManager, amountIn));
      const receipt = await action.run(buildCreateJobPlan({
        manager: deployment.sepolia.treasuryJobManager,
        inputToken: deployment.sepolia.mockUsdc,
        outputToken: deployment.sepolia.mockWeth,
        executor: deployment.sepolia.mockDexExecutor,
        agentId, amountIn, minOut, deadline,
      }));
      const createdLog = parseEventLogs({ abi: treasuryJobManagerAbi, eventName: "JobCreated", logs: receipt.logs })[0];
      if (!createdLog) throw new Error("Confirmed receipt did not contain JobCreated.");
      const jobId = createdLog.args.jobId;
      const jobKey = deriveJobKey(deployment.sepolia.treasuryJobManager, jobId);
      send({ type: "SEPOLIA_RECEIPT", txHash: receipt.transactionHash });
      if (jobKey !== predictedJobKey) send({ type: "HYDRATE", state: "SEPOLIA_MANDATE_MINED", context: { jobKey, sepoliaTxHash: receipt.transactionHash } });
      send({ type: "OPEN_AUCTION" });
      setCreated({ jobId, jobKey, transactionHash: receipt.transactionHash });
    } catch (cause) {
      send({ type: "RESET" });
      setError(cause instanceof Error ? cause.message : "Mandate transaction failed");
    }
  }

  return (
    <div className="route-stack">
      <header className="route-heading"><div><p className="kicker">SEPOLIA / PUBLIC MANDATE TERMINAL</p><h1>Fund a real testnet job</h1><p>Your wallet mints permissionless demo mUSDC, approves only the mandate amount, and submits objective execution terms to the deployed manager.</p></div><StatusChip label="WALLET-OWNED TRANSACTIONS" tone="success" pulse /></header>
      <div className="simulation-disclosure"><strong>TESTNET LAB</strong><p>mUSDC and mWETH are deterministic mock assets. You still need free Sepolia ETH for gas; never send production funds. <a href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia" target="_blank" rel="noreferrer">GET FREE SEPOLIA ETH ↗</a></p></div>
      <div className="form-layout">
        <TechnicalPanel eyebrow="WALLET PREFLIGHT" title="Treasury rebalance mandate">
          <div className="transaction-prefight"><span><small>ACCOUNT</small><code>{address ?? "NOT CONNECTED"}</code></span><span><small>MANAGER</small><code>{deployment?.sepolia.treasuryJobManager ?? "LOADING…"}</code></span></div>
          <button className="technical-button" type="button" disabled={!isConnected || !deployment || action.busy} onClick={mintTestAssets}>MINT 500 TEST mUSDC</button>
          <form className="technical-form public-transaction-form" onSubmit={submit}>
            <label><span>ERC-8004 AGENT ID</span><input name="agentId" inputMode="numeric" pattern="[0-9]+" defaultValue="10130" required /></label>
            <div className="form-pair"><label><span>INPUT mUSDC</span><input name="amountIn" inputMode="decimal" defaultValue="100" required /></label><label><span>MIN OUTPUT mWETH</span><input name="minOut" inputMode="decimal" defaultValue="99" required /></label></div>
            <label><span>EXECUTION WINDOW / SECONDS</span><input name="deadlineSeconds" type="number" min="300" max="86400" defaultValue="3600" required /></label>
            <button className="technical-button technical-button--primary technical-button--wide" disabled={!isConnected || !deployment || action.busy}>{action.busy ? "CONFIRMING ON SEPOLIA…" : "APPROVE + CREATE PUBLIC MANDATE"}</button>
          </form>
          {(error || action.phase !== "idle") && <TransactionStatus phase={error ? "error" : action.phase} chainId={11155111} hash={action.hash} error={error || action.error} />}
        </TechnicalPanel>
        <TechnicalPanel eyebrow="RECEIPT-DRIVEN XSTATE" title="Deterministic transaction saga"><SagaRail state={state} />{created ? <div className="public-receipt"><span>JOB #{created.jobId.toString()} CONFIRMED</span><code>{created.jobKey}</code><a href={`${deployment?.sepolia.explorer}/tx/${created.transactionHash}`} target="_blank" rel="noreferrer">OPEN ETHERSCAN ↗</a></div> : <div className="spec-ledger"><span><b>01</b> MINT TEST ASSET (OPTIONAL)</span><span><b>02</b> APPROVE EXACT INPUT</span><span><b>03</b> SIGN CREATE JOB</span><span><b>04</b> WAIT FOR JOB CREATED RECEIPT</span></div>}</TechnicalPanel>
      </div>
    </div>
  );
}
