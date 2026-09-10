import { isAddress, type Address } from "viem";

export interface LiveManifest {
  sepolia: { chainId: number; mockUsdc: Address; mockWeth: Address; mockDexExecutor: Address; treasuryJobManager: Address };
  creditcoin: { chainId: number; mockUsdc: Address; policyManager: Address };
}

export interface WalletMandateInput {
  agentId: bigint;
  amountIn: bigint;
  minOut: bigint;
  coverageAmount: bigint;
  deadline: bigint;
}

export type WalletAction = "mint" | "approve" | "create-job" | "accept-policy";
export interface WalletStep { chainId: 11155111 | 102031; action: WalletAction; contract: Address; args: readonly unknown[] }

function validateManifest(manifest: LiveManifest) {
  if (manifest.sepolia.chainId !== 11155111) throw new Error("Expected Sepolia chain ID 11155111");
  if (manifest.creditcoin.chainId !== 102031) throw new Error("Expected Creditcoin CC3 chain ID 102031");
  const addresses = [manifest.sepolia.mockUsdc, manifest.sepolia.mockWeth, manifest.sepolia.mockDexExecutor, manifest.sepolia.treasuryJobManager, manifest.creditcoin.mockUsdc, manifest.creditcoin.policyManager];
  if (!addresses.every((address) => isAddress(address))) throw new Error("Live testnet manifest contains an invalid contract address");
}

export function walletTransactionPlan(manifest: LiveManifest, input: WalletMandateInput): WalletStep[] {
  validateManifest(manifest);
  return [
    { chainId: 11155111, action: "mint", contract: manifest.sepolia.mockUsdc, args: [input.amountIn] },
    { chainId: 11155111, action: "approve", contract: manifest.sepolia.mockUsdc, args: [manifest.sepolia.treasuryJobManager, input.amountIn] },
    { chainId: 11155111, action: "create-job", contract: manifest.sepolia.treasuryJobManager, args: [input.agentId, manifest.sepolia.mockUsdc, manifest.sepolia.mockWeth, manifest.sepolia.mockDexExecutor, input.amountIn, input.minOut, input.deadline] },
    { chainId: 102031, action: "mint", contract: manifest.creditcoin.mockUsdc, args: [input.coverageAmount] },
    { chainId: 102031, action: "approve", contract: manifest.creditcoin.mockUsdc, args: [manifest.creditcoin.policyManager, input.coverageAmount] },
    { chainId: 102031, action: "accept-policy", contract: manifest.creditcoin.policyManager, args: [] },
  ];
}
