import type { OrchestratorState } from "../../lib/trustfutures/orchestrator";
import { buildSagaSteps } from "./saga-model";

export interface SagaRailProps {
  state: OrchestratorState;
  compact?: boolean;
}

export function SagaRail({ state, compact = false }: SagaRailProps) {
  const steps = buildSagaSteps(state);

  return (
    <div className={`saga-rail${compact ? " saga-rail--compact" : ""}`} aria-label={`Cross-chain lifecycle: ${state}`}>
      {steps.map((step, index) => (
        <div key={step.id} className={`saga-rail__step saga-rail__step--${step.status}`} aria-current={step.status === "active" ? "step" : undefined}>
          <div className="saga-rail__track" aria-hidden="true">
            <span className="saga-rail__index">{String(index + 1).padStart(2, "0")}</span>
            {index < steps.length - 1 && <span className="saga-rail__connector" />}
          </div>
          <div className="saga-rail__copy">
            <strong>{step.label}</strong>
            <span>{step.network}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

