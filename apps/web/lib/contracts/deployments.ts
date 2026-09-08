import { isAddress, isHash, type Address, type Hash } from "viem";

export interface TestnetDeploymentManifest {
  generatedAt: string;
  sepolia: {
    chainId: 11155111;
    explorer: string;
    erc8004IdentityRegistry: Address;
    mockUsdc: Address;
    mockWeth: Address;
    mockDexExecutor: Address;
    treasuryJobManager: Address;
  };
  creditcoin: {
    chainId: 102031;
    explorer: string;
    mockUsdc: Address;
    coverageVault: Address;
    underwriterRegistry: Address;
    attestcoinOutcomeAdapter: Address;
    policyManager: Address;
  };
  publicLoop?: {
    agentId?: string;
    jobId?: string;
    jobKey: Hash;
    policyId: Hash;
    sourceTransaction: Hash;
    proofTransaction: Hash;
    settlementTransaction: Hash;
    payout?: string;
    premiumBefore?: string;
    premiumAfter?: string;
  };
}

const addressFields = ["erc8004IdentityRegistry", "mockUsdc", "mockWeth", "mockDexExecutor", "treasuryJobManager"] as const;
const creditcoinAddressFields = ["mockUsdc", "coverageVault", "underwriterRegistry", "attestcoinOutcomeAdapter", "policyManager"] as const;

export function parseDeploymentManifest(value: unknown): TestnetDeploymentManifest {
  try {
    if (!value || typeof value !== "object") throw new Error();
    const root = value as Record<string, unknown>;
    const sepolia = root.sepolia as Record<string, unknown>;
    const creditcoin = root.creditcoin as Record<string, unknown>;
    if (!sepolia || !creditcoin || sepolia.chainId !== 11155111 || creditcoin.chainId !== 102031) throw new Error();
    if (typeof root.generatedAt !== "string" || typeof sepolia.explorer !== "string" || typeof creditcoin.explorer !== "string") throw new Error();
    if (addressFields.some((field) => !isAddress(String(sepolia[field])))) throw new Error();
    if (creditcoinAddressFields.some((field) => !isAddress(String(creditcoin[field])))) throw new Error();
    if (root.publicLoop) {
      const loop = root.publicLoop as Record<string, unknown>;
      if (["jobKey", "policyId", "sourceTransaction", "proofTransaction", "settlementTransaction"].some((field) => !isHash(String(loop[field])))) throw new Error();
    }
    return value as TestnetDeploymentManifest;
  } catch {
    throw new Error("Invalid TrustFutures deployment manifest");
  }
}

let deploymentPromise: Promise<TestnetDeploymentManifest> | undefined;

export function loadDeploymentManifest(): Promise<TestnetDeploymentManifest> {
  deploymentPromise ??= fetch("/testnet.json", { cache: "force-cache" })
    .then((response) => {
      if (!response.ok) throw new Error(`Deployment manifest unavailable (${response.status})`);
      return response.json();
    })
    .then(parseDeploymentManifest);
  return deploymentPromise;
}
