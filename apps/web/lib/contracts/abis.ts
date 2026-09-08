export const mockErc20Abi = [
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
] as const;

export const treasuryJobManagerAbi = [
  { type: "function", name: "nextJobId", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "jobKey", stateMutability: "view", inputs: [{ name: "jobId", type: "uint256" }], outputs: [{ name: "", type: "bytes32" }] },
  { type: "function", name: "createJob", stateMutability: "nonpayable", inputs: [{ name: "agentId", type: "uint256" }, { name: "inputToken", type: "address" }, { name: "outputToken", type: "address" }, { name: "executor", type: "address" }, { name: "amountIn", type: "uint256" }, { name: "minOut", type: "uint256" }, { name: "deadline", type: "uint64" }], outputs: [{ name: "jobId", type: "uint256" }] },
  { type: "event", name: "JobCreated", inputs: [{ indexed: true, name: "jobId", type: "uint256" }, { indexed: true, name: "client", type: "address" }, { indexed: true, name: "agent", type: "address" }, { indexed: false, name: "amountIn", type: "uint256" }, { indexed: false, name: "minOut", type: "uint256" }, { indexed: false, name: "deadline", type: "uint64" }] },
] as const;

export const coverageVaultAbi = [
  { type: "function", name: "deposit", stateMutability: "nonpayable", inputs: [{ name: "assets", type: "uint256" }], outputs: [{ name: "minted", type: "uint256" }] },
  { type: "function", name: "shares", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "totalAssets", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "freeAssets", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "reserved", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
] as const;

export const underwriterRegistryAbi = [
  { type: "function", name: "deposit", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "deposited", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "locked", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
] as const;

export const policyManagerAbi = [
  { type: "function", name: "acceptQuote", stateMutability: "nonpayable", inputs: [{ name: "quote", type: "tuple", components: [{ name: "jobKey", type: "bytes32" }, { name: "underwriter", type: "address" }, { name: "coverageAmount", type: "uint256" }, { name: "premiumAmount", type: "uint256" }, { name: "juniorAmount", type: "uint256" }, { name: "validUntil", type: "uint64" }, { name: "modelHash", type: "bytes32" }, { name: "nonce", type: "uint256" }] }, { name: "signature", type: "bytes" }], outputs: [{ name: "id", type: "bytes32" }] },
] as const;
