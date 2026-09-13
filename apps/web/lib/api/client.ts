import type { CrossChainEvent } from "../trustfutures/orchestrator";
import type { Address, Bytes32 } from "../trustfutures/types";
import {
  parseAgentRisk,
  parseAgents,
  parseAuction,
  parseCommandEnvelope,
  parseDemoState,
  parseJob,
  parseLiveQuotes,
  parseLiveMarket,
  parsePolicy,
  parseProof,
  parseVault,
  type AgentRiskResource,
  type AgentResource,
  type AuctionResource,
  type CommandEnvelope,
  type DemoStateResource,
  type JobResource,
  type LiveQuotesResource,
  type LiveMarketResource,
  type PolicyResource,
  type ProofResource,
  type VaultResource,
} from "./schema";

export const DEFAULT_API_BASE_URL = "http://127.0.0.1:3001";

export interface CreateJobInput {
  agentId: string;
  amountIn: `${bigint}`;
  minOut: `${bigint}`;
  deadlineSeconds: number;
  coverageAmount: `${bigint}`;
}

export interface TrustFuturesApiOptions {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  onEvents?: (events: readonly CrossChainEvent[]) => void;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Parser<T> = (value: unknown) => T;

export function createTrustFuturesApi(options: TrustFuturesApiOptions = {}) {
  const baseUrl = (options.baseUrl ?? DEFAULT_API_BASE_URL).replace(/\/+$/, "");
  const fetchImpl = options.fetch ?? globalThis.fetch;

  async function request<T>(path: string, parser: Parser<T>, init?: RequestInit): Promise<T> {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      headers: init?.body === undefined
        ? init?.headers
        : { "content-type": "application/json", ...init.headers },
    });
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ApiError(`API returned invalid JSON (${response.status})`, response.status);
    }
    if (!response.ok) {
      const source = body && typeof body === "object" ? body as Record<string, unknown> : {};
      throw new ApiError(
        typeof source.error === "string" ? source.error : `API request failed (${response.status})`,
        response.status,
        typeof source.code === "string" ? source.code : undefined,
      );
    }
    return parser(body);
  }

  async function command<T>(path: string, dataParser: Parser<T>, body: unknown): Promise<CommandEnvelope<T>> {
    const envelope = await request(path, (value) => parseCommandEnvelope(value, dataParser), {
      method: "POST",
      body: JSON.stringify(body),
    });
    options.onEvents?.(envelope.events);
    return envelope;
  }

  return {
    getDemoState: () => request("/v1/demo/state", parseDemoState),
    getAgents: async (): Promise<AgentResource[]> => (await request("/v1/agents", parseAgents)).agents,
    getAgentRisk: (agentId: string): Promise<AgentRiskResource> => request(`/v1/agents/${encodeURIComponent(agentId)}/risk`, parseAgentRisk),
    getJob: (jobKey: Bytes32): Promise<JobResource> => request(`/v1/jobs/${jobKey}`, parseJob),
    getQuotes: (jobKey: Bytes32): Promise<AuctionResource> => request(`/v1/quotes/${jobKey}`, parseAuction),
    getPolicy: (policyId: Bytes32): Promise<PolicyResource> => request(`/v1/policies/${policyId}`, parsePolicy),
    getVault: (): Promise<VaultResource> => request("/v1/vault", parseVault),
    getLiveVault: (): Promise<VaultResource> => request("/v1/live/vault", parseVault),
    getProof: (jobKey: Bytes32): Promise<ProofResource> => request(`/v1/proofs/${jobKey}`, parseProof),
    createJob: (input: CreateJobInput) => command("/v1/jobs", parseJob, input),
    openAuction: (jobKey: Bytes32) => command(`/v1/jobs/${jobKey}/open-auction`, parseAuction, {}),
    acceptPolicy: (jobKey: Bytes32, quoteIndex: number) => command("/v1/policies", parsePolicy, { jobKey, quoteIndex }),
    executeJob: (jobKey: Bytes32, outcome: "success" | "violation") => command(`/v1/jobs/${jobKey}/execute`, parseJob, { outcome }),
    proveOutcome: (jobKey: Bytes32) => command("/v1/proofs", parseProof, { jobKey }),
    settlePolicy: (policyId: Bytes32) => command(`/v1/policies/${policyId}/settle`, parsePolicy, {}),
    getLiveQuotes: (sourceTxHash: `0x${string}`, coverageAmount: `${bigint}`): Promise<LiveQuotesResource> => request("/v1/live/quotes", parseLiveQuotes, { method: "POST", body: JSON.stringify({ sourceTxHash, coverageAmount }) }),
    getLiveMarket: (client: Address): Promise<LiveMarketResource> => request(`/v1/live/market?client=${encodeURIComponent(client)}`, parseLiveMarket),
  };
}

export type TrustFuturesApi = ReturnType<typeof createTrustFuturesApi>;
export type {
  AgentRiskResource,
  AgentResource,
  AuctionResource,
  DemoStateResource,
  JobResource,
  LiveQuotesResource,
  LiveMarketResource,
  PolicyResource,
  ProofResource,
  VaultResource,
} from "./schema";
