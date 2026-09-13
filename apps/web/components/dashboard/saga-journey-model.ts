import type { OrchestratorState } from "../../lib/trustfutures/orchestrator";
import { buildSagaSteps } from "./saga-model";

const DESCRIPTIONS = {
  mandate: "Client funds a constrained execution mandate",
  finality: "Sepolia receipt becomes canonical",
  auction: "Underwriters price objective failure risk",
  policy: "Junior and senior capital lock on Creditcoin",
  proof: "Outcome evidence releases or pays the bond",
} as const;

export function buildSagaJourney(state: OrchestratorState) {
  const steps = buildSagaSteps(state).map((step) => ({ ...step, description: DESCRIPTIONS[step.id] }));
  const completedCount = steps.filter(({ status }) => status === "complete").length;
  return {
    steps,
    current: steps.find(({ status }) => status === "active") ?? steps[steps.length - 1],
    completedCount,
    progress: completedCount / steps.length * 100,
  };
}
