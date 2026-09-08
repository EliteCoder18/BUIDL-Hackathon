"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits, parseUnits, zeroAddress } from "viem";
import { useAccount, useReadContracts } from "wagmi";
import { coverageVaultAbi, mockErc20Abi, underwriterRegistryAbi } from "../../lib/contracts/abis";
import { loadDeploymentManifest, type TestnetDeploymentManifest } from "../../lib/contracts/deployments";
import { buildApprovePlan, buildMintPlan, buildUnderwriterDepositPlan, buildVaultDepositPlan } from "../../lib/contracts/transactions";
import { useTransactionAction } from "../../lib/wallet/useTransactionAction";
import { StatusChip } from "../ui/StatusChip";
import { TechnicalPanel } from "../ui/TechnicalPanel";
import { TransactionStatus } from "../wallet/TransactionStatus";

const display = (value: unknown) => typeof value === "bigint" ? Number(formatUnits(value, 6)).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—";

export function PublicCapitalDesk() {
  const { address, isConnected } = useAccount();
  const action = useTransactionAction();
  const [deployment, setDeployment] = useState<TestnetDeploymentManifest>();
  const [amount, setAmount] = useState("250");
  const [error, setError] = useState("");
  useEffect(() => { loadDeploymentManifest().then(setDeployment).catch((cause) => setError(cause instanceof Error ? cause.message : "Deployment unavailable")); }, []);

  const contracts = useMemo(() => {
    const account = address ?? zeroAddress;
    const token = deployment?.creditcoin.mockUsdc ?? zeroAddress;
    const vault = deployment?.creditcoin.coverageVault ?? zeroAddress;
    const registry = deployment?.creditcoin.underwriterRegistry ?? zeroAddress;
    return [
      { chainId: 102031, address: token, abi: mockErc20Abi, functionName: "balanceOf", args: [account] },
      { chainId: 102031, address: vault, abi: coverageVaultAbi, functionName: "totalAssets" },
      { chainId: 102031, address: vault, abi: coverageVaultAbi, functionName: "freeAssets" },
      { chainId: 102031, address: vault, abi: coverageVaultAbi, functionName: "reserved" },
      { chainId: 102031, address: vault, abi: coverageVaultAbi, functionName: "shares", args: [account] },
      { chainId: 102031, address: registry, abi: underwriterRegistryAbi, functionName: "deposited", args: [account] },
      { chainId: 102031, address: registry, abi: underwriterRegistryAbi, functionName: "locked", args: [account] },
    ] as const;
  }, [address, deployment]);
  const reads = useReadContracts({ contracts, query: { enabled: Boolean(deployment && address), refetchInterval: 12_000 } });
  const result = (index: number) => reads.data?.[index]?.result;

  async function transact(role: "mint" | "senior" | "junior") {
    if (!deployment || !address) { setError("Connect MetaMask before moving testnet capital."); return; }
    setError("");
    try {
      const units = parseUnits(role === "mint" ? "1000" : amount, 6);
      if (role === "mint") await action.run(buildMintPlan(102031, deployment.creditcoin.mockUsdc, address, units));
      if (role === "senior") {
        await action.run(buildApprovePlan(102031, deployment.creditcoin.mockUsdc, deployment.creditcoin.coverageVault, units));
        await action.run(buildVaultDepositPlan(deployment.creditcoin.coverageVault, units));
      }
      if (role === "junior") {
        await action.run(buildApprovePlan(102031, deployment.creditcoin.mockUsdc, deployment.creditcoin.underwriterRegistry, units));
        await action.run(buildUnderwriterDepositPlan(deployment.creditcoin.underwriterRegistry, units));
      }
      await reads.refetch();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Capital transaction failed"); }
  }

  return (
    <div className="route-stack">
      <div className="capital-metrics">
        <span><small>YOUR mUSDC</small><strong>{display(result(0))}</strong></span><span><small>VAULT ASSETS</small><strong>{display(result(1))}</strong></span><span><small>FREE SENIOR</small><strong>{display(result(2))}</strong></span><span><small>RESERVED</small><strong>{display(result(3))}</strong></span>
      </div>
      <div className="capital-actionbar"><label><span>TRANSACTION AMOUNT / mUSDC</span><input value={amount} inputMode="decimal" onChange={(event) => setAmount(event.target.value)} /></label><button className="technical-button" disabled={!isConnected || action.busy} onClick={() => transact("mint")}>MINT 1,000 TEST mUSDC</button></div>
      <div className="gas-faucet-line"><span>CC3 transactions require free tCTC gas.</span><a href="https://docs.creditcoin.org/wallets/using-testnet-faucet" target="_blank" rel="noreferrer">OPEN OFFICIAL CREDITCOIN FAUCET GUIDE ↗</a></div>
      <div className="capital-role-grid">
        <TechnicalPanel eyebrow="SENIOR / 80%" title="LP liquidity vault" action={<StatusChip label={`${display(result(4))} SHARES`} tone="cyan" />}><p>Supply the senior reserve used after junior first-loss capital is exhausted.</p><button className="technical-button technical-button--primary technical-button--wide" disabled={!isConnected || action.busy} onClick={() => transact("senior")}>APPROVE + DEPOSIT SENIOR CAPITAL</button></TechnicalPanel>
        <TechnicalPanel eyebrow="JUNIOR / 20%" title="Underwriter first loss" action={<StatusChip label={`${display(result(6))} LOCKED`} tone="warning" />}><p>Stake junior mUSDC before signing portable EIP-712 risk quotes.</p><div className="capital-position"><span>DEPOSITED</span><strong>{display(result(5))} mUSDC</strong></div><button className="technical-button technical-button--wide" disabled={!isConnected || action.busy} onClick={() => transact("junior")}>APPROVE + DEPOSIT JUNIOR CAPITAL</button></TechnicalPanel>
      </div>
      {(error || action.phase !== "idle") && <TransactionStatus phase={error ? "error" : action.phase} chainId={102031} hash={action.hash} error={error || action.error} />}
    </div>
  );
}
