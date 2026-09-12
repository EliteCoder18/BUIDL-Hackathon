"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { decodeEventLog, encodeAbiParameters, keccak256, parseAbiParameters, type Address, type Hash } from "viem";
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import type { CreateJobInput } from "../api/client";
import { useCrossChainOrchestrator } from "../orchestration";
import { mockErc20Abi, treasuryJobManagerAbi } from "./contracts";
import { nextMandateAction, parsePendingMandate, PENDING_MANDATE_KEY, verifiedMandateKey, type ConfirmedMandate, type PendingMandate } from "./mandate-recovery";
import { walletTransactionPlan, type LiveManifest } from "./transaction-plan";

export type WalletMandateInput = CreateJobInput & { deadline: bigint };

function message(error: unknown) {
  const source = error as { code?: number; shortMessage?: string; message?: string };
  if (source.code === 4001 || /rejected/i.test(source.shortMessage ?? "")) return "Signature request rejected. Nothing was submitted.";
  return source.shortMessage ?? source.message ?? "MetaMask transaction failed.";
}

export function useWalletMandate(input?: WalletMandateInput) {
  const router = useRouter();
  const { api, send } = useCrossChainOrchestrator();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const client = usePublicClient({ chainId: 11155111 });
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [manifest, setManifest] = useState<LiveManifest>();
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hashes, setHashes] = useState<Hash[]>([]);
  const [confirmedMandate, setConfirmedMandate] = useState<ConfirmedMandate>();
  useEffect(() => { fetch("/testnet.json").then((response) => response.json()).then((value) => setManifest(value as LiveManifest)).catch(() => setError("Testnet contract manifest is unavailable.")); }, []);
  useEffect(() => {
    const pending = parsePendingMandate(sessionStorage.getItem(PENDING_MANDATE_KEY));
    if (!pending || !input || pending.input.agentId !== input.agentId || pending.input.coverageAmount !== input.coverageAmount) return;
    setConfirmedMandate({ jobKey: pending.jobKey, txHash: pending.txHash });
    setHashes((current) => {
      if (current.length >= 3) return current;
      const next = [...current];
      next[2] = pending.txHash;
      return next;
    });
    setIndex(3);
    setError("Mandate confirmed on Sepolia. Retry signed quote generation; no wallet transaction will be sent.");
  }, [input]);
  const plan = useMemo(() => manifest && input ? walletTransactionPlan(manifest, { agentId: BigInt(input.agentId), amountIn: BigInt(input.amountIn), minOut: BigInt(input.minOut), coverageAmount: BigInt(input.coverageAmount), deadline: input.deadline }) : [], [manifest, input]);
  const steps = plan.slice(0, 3).map((step, stepIndex) => ({ label: step.action === "create-job" ? "Create funded mandate" : step.action === "approve" ? "Approve job manager" : "Mint test mUSDC", chain: "Sepolia", status: (confirmedMandate || stepIndex < index ? "confirmed" : stepIndex === index ? "active" : "pending") as "confirmed" | "active" | "pending", hash: stepIndex === 2 && confirmedMandate ? confirmedMandate.txHash : hashes[stepIndex] }));

  async function hydrateQuotes(mandate: ConfirmedMandate) {
    if (!input) throw new Error("Mandate input is unavailable.");
    const live = await api.getLiveQuotes(mandate.txHash, input.coverageAmount);
    const jobKey = verifiedMandateKey(mandate.jobKey, live.job.jobKey);
    sessionStorage.setItem(`trustfutures:live:${jobKey}`, JSON.stringify(live));
    sessionStorage.removeItem(PENDING_MANDATE_KEY);
    router.push(`/quotes/${jobKey}?mode=wallet`);
  }

  async function retryQuotes() {
    if (!confirmedMandate) return;
    setBusy(true); setError("");
    try { await hydrateQuotes(confirmedMandate); }
    catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  }

  async function advance() {
    if (nextMandateAction(index, confirmedMandate) === "request-quotes") { await retryQuotes(); return; }
    if (!input || !manifest || !address || !isConnected || !client) { setError("Connect MetaMask to continue with the public testnet path."); return; }
    if (chainId !== 11155111) { await switchChainAsync({ chainId: 11155111 }); return; }
    setBusy(true); setError("");
    try {
      let hash: Hash;
      if (index === 0) hash = await writeContractAsync({ chainId: 11155111, address: manifest.sepolia.mockUsdc, abi: mockErc20Abi, functionName: "mint", args: [address, BigInt(input.amountIn)] });
      else if (index === 1) hash = await writeContractAsync({ chainId: 11155111, address: manifest.sepolia.mockUsdc, abi: mockErc20Abi, functionName: "approve", args: [manifest.sepolia.treasuryJobManager, BigInt(input.amountIn)] });
      else hash = await writeContractAsync({ chainId: 11155111, address: manifest.sepolia.treasuryJobManager, abi: treasuryJobManagerAbi, functionName: "createJob", args: [BigInt(input.agentId), manifest.sepolia.mockUsdc, manifest.sepolia.mockWeth, manifest.sepolia.mockDexExecutor, BigInt(input.amountIn), BigInt(input.minOut), input.deadline] });
      const receipt = await client.waitForTransactionReceipt({ hash });
      setHashes((current) => { const next = [...current]; next[index] = hash; return next; });
      if (index < 2) { setIndex(index + 1); return; }
      const created = receipt.logs.map((log) => { try { return decodeEventLog({ abi: treasuryJobManagerAbi, eventName: "JobCreated", data: log.data, topics: log.topics }); } catch { return null; } }).find(Boolean);
      if (!created) throw new Error("Confirmed receipt did not contain JobCreated.");
      const jobId = (created.args as { jobId: bigint }).jobId;
      const jobKey = keccak256(encodeAbiParameters(parseAbiParameters("uint256, address, uint256"), [11155111n, manifest.sepolia.treasuryJobManager as Address, jobId]));
      const confirmed = { jobKey, txHash: hash } satisfies ConfirmedMandate;
      const pending = { jobKey, txHash: hash, input: { ...input, deadline: input.deadline.toString() as `${bigint}` } } satisfies PendingMandate;
      sessionStorage.setItem(PENDING_MANDATE_KEY, JSON.stringify(pending));
      setConfirmedMandate(confirmed);
      setIndex(3);
      send({ type: "WALLET_TX_CONFIRMED", operation: "createJob", jobKey, txHash: hash });
      await hydrateQuotes(confirmed);
    } catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  }
  return { steps, busy, error, advance, retryQuotes: confirmedMandate && error ? retryQuotes : undefined };
}
