export type Address = `0x${string}`;
export type Bytes32 = `0x${string}`;

/** EIP-712 payload signed by a Creditcoin underwriter. */
export interface Quote {
  jobKey: Bytes32;
  underwriter: Address;
  coverageAmount: bigint;
  premiumAmount: bigint;
  juniorAmount: bigint;
  validUntil: bigint;
  modelHash: Bytes32;
  nonce: bigint;
}

export interface RiskFeature {
  name: string;
  shapValue: number;
}

export interface RiskProfile {
  agentId: string;
  features: RiskFeature[];
  llmExplanation: {
    summary: string;
    topRisks: string[];
    protectiveTerms: string[];
  };
}
