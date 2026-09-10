import type { CrossChainEvent } from "../trustfutures/orchestrator";
import type { Address, Bytes32 } from "../trustfutures/types";

export type IntegerString = `${bigint}`;
export type TransactionChain = "sepolia" | "creditcoin";

export interface ChainTransaction {
  chain: TransactionChain;
  hash: string;
  blockNumber: number | IntegerString;
}

export interface CommandEnvelope<T> {
  data: T;
  events: CrossChainEvent[];
  transactions: ChainTransaction[];
}

export interface JobResource {
  jobKey: Bytes32;
  jobId: IntegerString;
  agentId: string;
  amountIn: IntegerString;
  minOut: IntegerString;
  coverageAmount: IntegerString;
  deadline: IntegerString;
  state: string;
  createTxHash: string;
  policyId?: Bytes32;
  outcome?: "success" | "violation" | "expired";
  executionTxHash?: string;
}

export interface ShapFeature {
  name: string;
  value?: number;
  shapValue: number;
  label?: string;
}

export interface ApiRiskProfile {
  failureProbabilityBps: number;
  modelHash: Bytes32;
  modelVersion: string;
  confidence: number;
  abstain: boolean;
  source: string;
  features: ShapFeature[];
  trainingData?: string;
  liveFeatures?: string;
  calibrationMethod?: string;
  dataLineage?: { datasetVersion: string; datasetHash: string; liveOutcomeCount: number };
  diagnostics?: { abstentionReasons: string[]; warnings: string[]; confidence: number; featureDrift: number | null; outOfDistribution: boolean };
}

export interface ApiQuote {
  jobKey: Bytes32;
  underwriter: Address;
  coverageAmount: IntegerString;
  premiumAmount: IntegerString;
  juniorAmount: IntegerString;
  seniorAmount: IntegerString;
  validUntil: IntegerString;
  modelHash: Bytes32;
  nonce: IntegerString;
  failureProbabilityBps: number;
  premiumBps: number;
  signature: string;
  strategy: "conservative" | "balanced" | "aggressive";
  factors: ShapFeature[];
  riskProfile: ApiRiskProfile;
  llmExplanation: {
    summary: string;
    topRisks: string[];
    protectiveTerms: string | string[];
  };
}

export interface AuctionResource {
  jobKey: Bytes32;
  quotes: ApiQuote[];
}

export interface PolicyResource {
  policyId: Bytes32;
  jobKey: Bytes32;
  agentId: string;
  underwriter: Address;
  strategy: string;
  coverageAmount: IntegerString;
  premiumAmount: IntegerString;
  juniorAmount: IntegerString;
  seniorAmount: IntegerString;
  state: string;
  lockTxHash: string;
  settlementTxHash?: string;
  clientPayout?: IntegerString;
  juniorLoss?: IntegerString;
  seniorLoss?: IntegerString;
  underwriterPremium?: IntegerString;
  lpPremium?: IntegerString;
}

export interface ProofResource {
  id: string;
  jobKey: Bytes32;
  state: string;
  outcome: "success" | "violation" | "expired";
  proofSource: string;
  sourceTxHash: string;
  sourceBlockNumber: number | IntegerString;
  creditcoinTxHash: string;
  creditcoinBlockNumber: number | IntegerString;
}

export interface AgentHistory {
  successCount: number;
  violationCount: number;
  expiryCount: number;
  meanSlippageBps: number;
  meanLatenessBps: number;
  amountVsP95Bps: number;
  deadlineTightnessBps: number;
  volatilityBps: number;
}

export interface AgentResource {
  agentId: string;
  name: string;
  history: AgentHistory;
}

export interface AgentRiskResource extends ApiRiskProfile {
  agentId: string;
  attestedFeatures: AgentHistory;
}

export interface VaultResource {
  totalAssets: IntegerString;
  reserved: IntegerString;
  freeAssets: IntegerString;
  totalShares: IntegerString;
}

export interface DemoStateResource {
  agents: AgentResource[];
  jobs: JobResource[];
  policies: PolicyResource[];
  proofs: ProofResource[];
}

type JsonRecord = Record<string, unknown>;

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`invalid ${label}`);
  return value as JsonRecord;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`invalid ${label}`);
  return value;
}

function integerString(value: unknown, label: string): IntegerString {
  const parsed = string(value, label);
  if (!/^-?\d+$/.test(parsed)) throw new TypeError(`invalid ${label}`);
  return parsed as IntegerString;
}

function number(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`invalid ${label}`);
  return value;
}

function bytes(value: unknown, size: number, label: string): `0x${string}` {
  const parsed = string(value, label);
  if (!new RegExp(`^0x[0-9a-fA-F]{${size * 2}}$`).test(parsed)) throw new TypeError(`invalid ${label}`);
  return parsed as `0x${string}`;
}

function optionalString(source: JsonRecord, key: string): string | undefined {
  return source[key] === undefined ? undefined : string(source[key], key);
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new TypeError(`invalid ${label}`);
  return value.map((item, index) => string(item, `${label}[${index}]`));
}

export function parseCrossChainEvent(value: unknown): CrossChainEvent {
  const source = record(value, "orchestration event");
  const type = string(source.type, "event type");
  switch (type) {
    case "START_MANDATE":
      return { type, jobKey: bytes(source.jobKey, 32, "START_MANDATE event jobKey"), txHash: optionalString(source, "txHash") };
    case "SEPOLIA_RECEIPT":
      return { type, txHash: string(source.txHash, "SEPOLIA_RECEIPT event txHash") };
    case "OPEN_AUCTION":
      return { type };
    case "QUOTE_SIGNED":
      return { type, quoteId: string(source.quoteId, "QUOTE_SIGNED event quoteId"), signature: string(source.signature, "QUOTE_SIGNED event signature") };
    case "POLICY_LOCKED":
      return { type, txHash: string(source.txHash, "POLICY_LOCKED event txHash") };
    case "START_PROOF":
      return { type, requestId: string(source.requestId, "START_PROOF event requestId") };
    case "PROOF_SETTLED": {
      const outcome = string(source.outcome, "PROOF_SETTLED event outcome");
      if (outcome !== "success" && outcome !== "slashed") throw new TypeError("invalid PROOF_SETTLED event outcome");
      return { type, proofId: string(source.proofId, "PROOF_SETTLED event proofId"), outcome };
    }
    case "RESET":
      return { type };
    default:
      throw new TypeError(`invalid orchestration event type: ${type}`);
  }
}

function parseTransaction(value: unknown): ChainTransaction {
  const source = record(value, "transaction");
  const chain = string(source.chain, "transaction chain");
  if (chain !== "sepolia" && chain !== "creditcoin") throw new TypeError("invalid transaction chain");
  const blockNumber = typeof source.blockNumber === "number"
    ? number(source.blockNumber, "transaction blockNumber")
    : integerString(source.blockNumber, "transaction blockNumber");
  return { chain, hash: string(source.hash, "transaction hash"), blockNumber };
}

export function parseCommandEnvelope<T>(value: unknown, parseData: (data: unknown) => T): CommandEnvelope<T> {
  const source = record(value, "command envelope");
  if (!Array.isArray(source.events)) throw new TypeError("invalid command events");
  if (!Array.isArray(source.transactions)) throw new TypeError("invalid command transactions");
  return {
    data: parseData(source.data),
    events: source.events.map(parseCrossChainEvent),
    transactions: source.transactions.map(parseTransaction),
  };
}

export function parseJob(value: unknown): JobResource {
  const source = record(value, "job");
  const outcome = source.outcome === undefined ? undefined : string(source.outcome, "job outcome");
  if (outcome !== undefined && outcome !== "success" && outcome !== "violation" && outcome !== "expired") throw new TypeError("invalid job outcome");
  return {
    jobKey: bytes(source.jobKey, 32, "jobKey"),
    jobId: integerString(source.jobId, "jobId"),
    agentId: string(source.agentId, "agentId"),
    amountIn: integerString(source.amountIn, "amountIn"),
    minOut: integerString(source.minOut, "minOut"),
    coverageAmount: integerString(source.coverageAmount, "coverageAmount"),
    deadline: integerString(source.deadline, "deadline"),
    state: string(source.state, "job state"),
    createTxHash: string(source.createTxHash, "createTxHash"),
    policyId: source.policyId === undefined ? undefined : bytes(source.policyId, 32, "policyId"),
    outcome,
    executionTxHash: optionalString(source, "executionTxHash"),
  };
}

function parseFeature(value: unknown): ShapFeature {
  const source = record(value, "SHAP feature");
  return {
    name: string(source.name, "feature name"),
    value: source.value === undefined ? undefined : number(source.value, "feature value"),
    shapValue: number(source.shapValue, "feature shapValue"),
    label: optionalString(source, "label"),
  };
}

export function parseRiskProfile(value: unknown): ApiRiskProfile {
  const source = record(value, "risk profile");
  if (!Array.isArray(source.features)) throw new TypeError("invalid risk profile features");
  if (typeof source.abstain !== "boolean") throw new TypeError("invalid risk profile abstain");
  const lineage = source.dataLineage === undefined ? undefined : record(source.dataLineage, "data lineage");
  const diagnostics = source.diagnostics === undefined ? undefined : record(source.diagnostics, "risk diagnostics");
  return {
    failureProbabilityBps: number(source.failureProbabilityBps, "failureProbabilityBps"),
    modelHash: bytes(source.modelHash, 32, "modelHash"),
    modelVersion: string(source.modelVersion, "modelVersion"),
    confidence: number(source.confidence, "confidence"),
    abstain: source.abstain,
    source: string(source.source, "risk source"),
    features: source.features.map(parseFeature),
    trainingData: source.trainingData === undefined ? undefined : string(source.trainingData, "trainingData"),
    liveFeatures: source.liveFeatures === undefined ? undefined : string(source.liveFeatures, "liveFeatures"),
    calibrationMethod: source.calibrationMethod === undefined ? undefined : string(source.calibrationMethod, "calibrationMethod"),
    dataLineage: lineage === undefined ? undefined : { datasetVersion: string(lineage.datasetVersion, "datasetVersion"), datasetHash: string(lineage.datasetHash, "datasetHash"), liveOutcomeCount: number(lineage.liveOutcomeCount, "liveOutcomeCount") },
    diagnostics: diagnostics === undefined ? undefined : { abstentionReasons: stringArray(diagnostics.abstentionReasons, "abstentionReasons"), warnings: stringArray(diagnostics.warnings, "warnings"), confidence: number(diagnostics.confidence, "diagnostic confidence"), featureDrift: diagnostics.featureDrift === null ? null : number(diagnostics.featureDrift, "featureDrift"), outOfDistribution: diagnostics.outOfDistribution === true },
  };
}

export function parseQuote(value: unknown): ApiQuote {
  const source = record(value, "quote");
  const strategy = string(source.strategy, "quote strategy");
  if (strategy !== "conservative" && strategy !== "balanced" && strategy !== "aggressive") throw new TypeError("invalid quote strategy");
  if (!Array.isArray(source.factors)) throw new TypeError("invalid quote factors");
  const explanation = record(source.llmExplanation, "LLM explanation");
  const terms = Array.isArray(explanation.protectiveTerms)
    ? stringArray(explanation.protectiveTerms, "protectiveTerms")
    : string(explanation.protectiveTerms, "protectiveTerms");
  return {
    jobKey: bytes(source.jobKey, 32, "quote jobKey"),
    underwriter: bytes(source.underwriter, 20, "underwriter") as Address,
    coverageAmount: integerString(source.coverageAmount, "coverageAmount"),
    premiumAmount: integerString(source.premiumAmount, "premiumAmount"),
    juniorAmount: integerString(source.juniorAmount, "juniorAmount"),
    seniorAmount: integerString(source.seniorAmount, "seniorAmount"),
    validUntil: integerString(source.validUntil, "validUntil"),
    modelHash: bytes(source.modelHash, 32, "modelHash"),
    nonce: integerString(source.nonce, "nonce"),
    failureProbabilityBps: number(source.failureProbabilityBps, "failureProbabilityBps"),
    premiumBps: number(source.premiumBps, "premiumBps"),
    signature: string(source.signature, "signature"),
    strategy,
    factors: source.factors.map(parseFeature),
    riskProfile: parseRiskProfile(source.riskProfile),
    llmExplanation: {
      summary: string(explanation.summary, "explanation summary"),
      topRisks: stringArray(explanation.topRisks, "topRisks"),
      protectiveTerms: terms,
    },
  };
}

export function parseAuction(value: unknown): AuctionResource {
  const source = record(value, "auction");
  if (!Array.isArray(source.quotes)) throw new TypeError("invalid auction quotes");
  return { jobKey: bytes(source.jobKey, 32, "jobKey"), quotes: source.quotes.map(parseQuote) };
}

export function parsePolicy(value: unknown): PolicyResource {
  const source = record(value, "policy");
  const optionalInteger = (key: string) => source[key] === undefined ? undefined : integerString(source[key], key);
  return {
    policyId: bytes(source.policyId, 32, "policyId"),
    jobKey: bytes(source.jobKey, 32, "jobKey"),
    agentId: string(source.agentId, "agentId"),
    underwriter: bytes(source.underwriter, 20, "underwriter") as Address,
    strategy: string(source.strategy, "strategy"),
    coverageAmount: integerString(source.coverageAmount, "coverageAmount"),
    premiumAmount: integerString(source.premiumAmount, "premiumAmount"),
    juniorAmount: integerString(source.juniorAmount, "juniorAmount"),
    seniorAmount: integerString(source.seniorAmount, "seniorAmount"),
    state: string(source.state, "policy state"),
    lockTxHash: string(source.lockTxHash, "lockTxHash"),
    settlementTxHash: optionalString(source, "settlementTxHash"),
    clientPayout: optionalInteger("clientPayout"),
    juniorLoss: optionalInteger("juniorLoss"),
    seniorLoss: optionalInteger("seniorLoss"),
    underwriterPremium: optionalInteger("underwriterPremium"),
    lpPremium: optionalInteger("lpPremium"),
  };
}

export function parseProof(value: unknown): ProofResource {
  const source = record(value, "proof");
  const outcome = string(source.outcome, "proof outcome");
  if (outcome !== "success" && outcome !== "violation" && outcome !== "expired") throw new TypeError("invalid proof outcome");
  const block = (key: string) => typeof source[key] === "number" ? number(source[key], key) : integerString(source[key], key);
  return {
    id: string(source.id, "proof id"),
    jobKey: bytes(source.jobKey, 32, "proof jobKey"),
    state: string(source.state, "proof state"),
    outcome,
    proofSource: string(source.proofSource, "proofSource"),
    sourceTxHash: string(source.sourceTxHash, "sourceTxHash"),
    sourceBlockNumber: block("sourceBlockNumber"),
    creditcoinTxHash: string(source.creditcoinTxHash, "creditcoinTxHash"),
    creditcoinBlockNumber: block("creditcoinBlockNumber"),
  };
}

function parseHistory(value: unknown): AgentHistory {
  const source = record(value, "agent history");
  return {
    successCount: number(source.successCount, "successCount"),
    violationCount: number(source.violationCount, "violationCount"),
    expiryCount: number(source.expiryCount, "expiryCount"),
    meanSlippageBps: number(source.meanSlippageBps, "meanSlippageBps"),
    meanLatenessBps: number(source.meanLatenessBps, "meanLatenessBps"),
    amountVsP95Bps: number(source.amountVsP95Bps, "amountVsP95Bps"),
    deadlineTightnessBps: number(source.deadlineTightnessBps, "deadlineTightnessBps"),
    volatilityBps: number(source.volatilityBps, "volatilityBps"),
  };
}

function parseAgent(value: unknown): AgentResource {
  const source = record(value, "agent");
  return { agentId: string(source.agentId, "agentId"), name: string(source.name, "agent name"), history: parseHistory(source.history) };
}

export function parseAgents(value: unknown): { agents: AgentResource[] } {
  const source = record(value, "agents response");
  if (!Array.isArray(source.agents)) throw new TypeError("invalid agents");
  return { agents: source.agents.map(parseAgent) };
}

export function parseAgentRisk(value: unknown): AgentRiskResource {
  const source = record(value, "agent risk");
  return {
    agentId: string(source.agentId, "agentId"),
    attestedFeatures: parseHistory(source.attestedFeatures),
    ...parseRiskProfile(source),
  };
}

export function parseVault(value: unknown): VaultResource {
  const source = record(value, "vault");
  return {
    totalAssets: integerString(source.totalAssets, "totalAssets"),
    reserved: integerString(source.reserved, "reserved"),
    freeAssets: integerString(source.freeAssets, "freeAssets"),
    totalShares: integerString(source.totalShares, "totalShares"),
  };
}

export function parseDemoState(value: unknown): DemoStateResource {
  const source = record(value, "demo state");
  if (!Array.isArray(source.agents) || !Array.isArray(source.jobs) || !Array.isArray(source.policies) || !Array.isArray(source.proofs)) {
    throw new TypeError("invalid demo state collections");
  }
  return {
    agents: source.agents.map(parseAgent),
    jobs: source.jobs.map(parseJob),
    policies: source.policies.map(parsePolicy),
    proofs: source.proofs.map(parseProof),
  };
}
