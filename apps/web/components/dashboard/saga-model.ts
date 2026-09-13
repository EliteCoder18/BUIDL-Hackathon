import type { OrchestratorState } from "../../lib/trustfutures/orchestrator";

export type SagaStepStatus = "complete" | "active" | "pending" | "failed";

export interface SagaStep {
  id: "mandate" | "finality" | "auction" | "policy" | "proof";
  label: string;
  network: "SEPOLIA" | "CREDITCOIN" | "ATTESTCOIN";
  status: SagaStepStatus;
}

const STEP_DEFINITIONS = [
  { id: "mandate", label: "Mandate", network: "SEPOLIA" },
  { id: "finality", label: "Source finality", network: "SEPOLIA" },
  { id: "auction", label: "Risk auction", network: "CREDITCOIN" },
  { id: "policy", label: "Capital bond", network: "CREDITCOIN" },
  { id: "proof", label: "Outcome proof", network: "ATTESTCOIN" },
] as const;

const ACTIVE_STEP: Record<OrchestratorState, number> = {
  IDLE: 0,
  SEPOLIA_MANDATE_PENDING: 0,
  SEPOLIA_MANDATE_MINED: 1,
  AUCTION_ACTIVE: 2,
  QUOTE_SIGNED: 3,
  CREDITCOIN_POLICY_LOCKED: 4,
  ATTESTCOIN_PROVING: 4,
  SETTLED_SUCCESS: 5,
  SETTLED_SLASHED: 5,
};

export function buildSagaSteps(state: OrchestratorState): SagaStep[] {
  const activeIndex = ACTIVE_STEP[state];
  return STEP_DEFINITIONS.map((step, index) => ({
    ...step,
    status: index < activeIndex ? "complete" : index === activeIndex ? "active" : "pending",
  }));
}
