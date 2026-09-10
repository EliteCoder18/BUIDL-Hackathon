"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { decodeEventLog, encodeAbiParameters, keccak256, parseAbiParameters, type Address, type Hash } from "viem";
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import type { CreateJobInput } from "../api/client";
import { useCrossChainOrchestrator } from "../orchestration";
import { mockErc20Abi, treasuryJobManagerAbi } from "./contracts";
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
  useEffect(() => { fetch("/testnet.json").then((response) => response.json()).then((value) => setManifest(value as LiveManifest)).catch(() => setError("Testnet contract manifest is unavailable.")); }, []);
  const plan = useMemo(() => manifest && input ? walletTransactionPlan(manifest, { agentId: BigInt(input.agentId), amountIn: BigInt(input.amountIn), minOut: BigInt(input.minOut), coverageAmount: BigInt(input.coverageAmount), deadline: input.deadline }) : [], [manifest, input]);
  const steps = plan.slice(0, 3).map((step, stepIndex) => ({ label: step.action === "create-job" ? "Create funded mandate" : step.action === "approve" ? "Approve job manager" : "Mint test mUSDC", chain: "Sepolia", status: (stepIndex < index ? "confirmed" : stepIndex === index ? "active" : "pending") as "confirmed" | "active" | "pending", hash: hashes[stepIndex] }));

  async function advance() {
    if (!input || !manifest || !address || !isConnected || !client) { setError("Connect MetaMask to continue with the public testnet path."); return; }
    if (chainId !== 11155111) { await switchChainAsync({ chainId: 11155111 }); return; }
    setBusy(true); setError("");
    try {
      let hash: Hash;
      if (index === 0) hash = await writeContractAsync({ chainId: 11155111, address: manifest.sepolia.mockUsdc, abi: mockErc20Abi, functionName: "mint", args: [address, BigInt(input.amountIn)] });
      else if (index === 1) hash = await writeContractAsync({ chainId: 11155111, address: manifest.sepolia.mockUsdc, abi: mockErc20Abi, functionName: "approve", args: [manifest.sepolia.treasuryJobManager, BigInt(input.amountIn)] });
      else hash = await writeContractAsync({ chainId: 11155111, address: manifest.sepolia.treasuryJobManager, abi: treasuryJobManagerAbi, functionName: "createJob", args: [BigInt(input.agentId), manifest.sepolia.mockUsdc, manifest.sepolia.mockWeth, manifest.sepolia.mockDexExecutor, BigInt(input.amountIn), BigInt(input.minOut), input.deadline] });
      const receipt = await client.waitForTransactionReceipt({ hash });
      setHashes((current) => [...current, hash]);
      if (index < 2) { setIndex(index + 1); return; }
      const created = receipt.logs.map((log) => { try { return decodeEventLog({ abi: treasuryJobManagerAbi, eventName: "JobCreated", data: log.data, topics: log.topics }); } catch { return null; } }).find(Boolean);
      if (!created) throw new Error("Confirmed receipt did not contain JobCreated.");
      const jobId = (created.args as { jobId: bigint }).jobId;
      const jobKey = keccak256(encodeAbiParameters(parseAbiParameters("uint256, address, uint256"), [11155111n, manifest.sepolia.treasuryJobManager as Address, jobId]));
      const live = await api.getLiveQuotes(hash, input.coverageAmount);
      sessionStorage.setItem(`trustfutures:live:${jobKey}`, JSON.stringify(live));
      send({ type: "WALLET_TX_CONFIRMED", operation: "createJob", jobKey, txHash: hash });
      setIndex(3);
      router.push(`/quotes/${jobKey}?mode=wallet`);
    } catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  }
  return { steps, busy, error, advance };
}
