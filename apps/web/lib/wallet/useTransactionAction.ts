"use client";

import { useCallback, useState } from "react";
import type { Abi, Address, TransactionReceipt } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { creditcoinTestnet, publicSepolia } from "./chains";
import { walletErrorMessage } from "./errors";

export type TransactionPhase = "idle" | "switching" | "signing" | "mining" | "success" | "error";

export interface ContractWritePlan {
  chainId: 11155111 | 102031;
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
}

export function useTransactionAction() {
  const { chainId, isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const sepoliaClient = usePublicClient({ chainId: publicSepolia.id });
  const creditcoinClient = usePublicClient({ chainId: creditcoinTestnet.id });
  const [phase, setPhase] = useState<TransactionPhase>("idle");
  const [hash, setHash] = useState<`0x${string}`>();
  const [error, setError] = useState("");

  const reset = useCallback(() => { setPhase("idle"); setHash(undefined); setError(""); }, []);

  const run = useCallback(async (plan: ContractWritePlan): Promise<TransactionReceipt> => {
    if (!isConnected) throw new Error("Connect MetaMask before sending a transaction.");
    setError(""); setHash(undefined);
    try {
      if (chainId !== plan.chainId) {
        setPhase("switching");
        await switchChainAsync({ chainId: plan.chainId });
      }
      setPhase("signing");
      // ABI/function coupling is validated by the pure plan builders before this wallet boundary.
      const transactionHash = await writeContractAsync(plan as Parameters<typeof writeContractAsync>[0]);
      setHash(transactionHash); setPhase("mining");
      const client = plan.chainId === publicSepolia.id ? sepoliaClient : creditcoinClient;
      if (!client) throw new Error("Public RPC client is unavailable for the selected chain.");
      const receipt = await client.waitForTransactionReceipt({ hash: transactionHash, confirmations: 1 });
      if (receipt.status !== "success") throw new Error("Transaction reverted on-chain.");
      setPhase("success");
      return receipt;
    } catch (cause) {
      setPhase("error"); setError(walletErrorMessage(cause));
      throw cause;
    }
  }, [chainId, creditcoinClient, isConnected, sepoliaClient, switchChainAsync, writeContractAsync]);

  return { run, reset, phase, hash, error, busy: ["switching", "signing", "mining"].includes(phase) };
}
