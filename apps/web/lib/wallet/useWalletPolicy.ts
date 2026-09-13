"use client";

import { useEffect, useState } from "react";
import { type Address, type Hash } from "viem";
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import type { LiveQuote, LiveQuotesResource } from "../api/schema";
import { useCrossChainOrchestrator } from "../orchestration";
import { mockErc20Abi, policyManagerAbi } from "./contracts";

export function useWalletPolicy(live: LiveQuotesResource, quote: LiveQuote) {
  const { send } = useCrossChainOrchestrator();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const client = usePublicClient({ chainId: 102031 });
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hashes, setHashes] = useState<Hash[]>([]);
  const [asset, setAsset] = useState<Address>();
  useEffect(() => { fetch("/testnet.json").then((response) => response.json()).then((manifest) => setAsset(manifest.creditcoin.mockUsdc as Address)).catch(() => setError("Creditcoin contract manifest is unavailable.")); }, []);
  const labels = ["Mint premium mUSDC", "Approve policy manager", "Accept signed policy"];
  const steps = labels.map((label, stepIndex) => ({ label, chain: "Creditcoin CC3", status: (stepIndex < index ? "confirmed" : stepIndex === index ? "active" : "pending") as "confirmed" | "active" | "pending", hash: hashes[stepIndex] }));
  async function advance() {
    if (!address || !isConnected || !client || !asset) { setError(asset ? "Connect MetaMask to accept this policy." : "Creditcoin contract manifest is still loading."); return; }
    if (chainId !== 102031) { await switchChainAsync({ chainId: 102031 }); return; }
    setBusy(true); setError("");
    try {
      let hash: Hash;
      if (index === 0) hash = await writeContractAsync({ chainId: 102031, address: asset, abi: mockErc20Abi, functionName: "mint", args: [address, BigInt(quote.premiumAmount)] });
      else if (index === 1) hash = await writeContractAsync({ chainId: 102031, address: asset, abi: mockErc20Abi, functionName: "approve", args: [live.domain.verifyingContract, BigInt(quote.premiumAmount)] });
      else hash = await writeContractAsync({ chainId: 102031, address: live.domain.verifyingContract, abi: policyManagerAbi, functionName: "acceptQuote", args: [{ jobKey: quote.jobKey, underwriter: quote.underwriter, coverageAmount: BigInt(quote.coverageAmount), premiumAmount: BigInt(quote.premiumAmount), juniorAmount: BigInt(quote.juniorAmount), validUntil: BigInt(quote.validUntil), modelHash: quote.modelHash, nonce: BigInt(quote.nonce) }, quote.signature] });
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Creditcoin transaction reverted.");
      setHashes((current) => [...current, hash]);
      if (index < 2) setIndex(index + 1);
      else { setIndex(3); send({ type: "WALLET_TX_CONFIRMED", operation: "acceptQuote", txHash: hash, quoteId: `${quote.strategy}-${quote.nonce}`, signature: quote.signature }); }
    } catch (cause) { const source = cause as { code?: number; shortMessage?: string; message?: string }; setError(source.code === 4001 || /rejected/i.test(source.shortMessage ?? "") ? "Signature request rejected. Nothing was submitted." : source.shortMessage ?? source.message ?? "MetaMask transaction failed."); } finally { setBusy(false); }
  }
  async function cancel() {
    if (busy) return false;
    if (index < 2) return true;
    if (!address || !isConnected || !client || !asset) { setError(asset ? "Connect MetaMask to revoke the policy allowance." : "Creditcoin contract manifest is still loading."); return false; }
    setBusy(true); setError("");
    try {
      if (chainId !== 102031) await switchChainAsync({ chainId: 102031 });
      const hash = await writeContractAsync({ chainId: 102031, address: asset, abi: mockErc20Abi, functionName: "approve", args: [live.domain.verifyingContract, 0n] });
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Creditcoin allowance revocation reverted.");
      return true;
    } catch (cause) {
      const source = cause as { code?: number; shortMessage?: string; message?: string };
      setError(source.code === 4001 || /rejected/i.test(source.shortMessage ?? "") ? "Allowance revocation rejected. Policy setup remains open." : source.shortMessage ?? source.message ?? "Could not revoke the policy allowance.");
      return false;
    } finally { setBusy(false); }
  }
  return { steps, busy, error, complete: index === 3, advance, cancel, cancelLabel: index >= 2 ? "Revoke approval + start over" : "Cancel and start new job" };
}
