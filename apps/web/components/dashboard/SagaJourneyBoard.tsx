import type { OrchestratorState } from "../../lib/trustfutures/orchestrator";
import { buildSagaJourney } from "./saga-journey-model";

export function SagaJourneyBoard({ state }: { state: OrchestratorState }) {
  const journey = buildSagaJourney(state);
  const settled = state === "SETTLED_SUCCESS" || state === "SETTLED_SLASHED";

  return <section className="journey-board" aria-label={`Cross-chain lifecycle: ${state}`}>
    <header className="journey-board__current">
      <div><span>{settled ? "JOURNEY COMPLETE" : "CURRENT NETWORK ACTION"}</span><strong>{settled ? state.replaceAll("_", " ") : journey.current.label}</strong><p>{journey.current.description}</p></div>
      <b>{settled ? "05 / 05" : `${String(journey.completedCount + 1).padStart(2, "0")} / 05`}</b>
    </header>
    <div className="journey-board__progress" role="progressbar" aria-label="Cross-chain journey progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={journey.progress}><i style={{ width: `${journey.progress}%` }} /></div>
    <ol className="journey-board__steps">
      {journey.steps.map((step, index) => <li key={step.id} className={`journey-board__step journey-board__step--${step.status}`} aria-current={step.status === "active" ? "step" : undefined}>
        <span className="journey-board__index">{step.status === "complete" ? "✓" : String(index + 1).padStart(2, "0")}</span>
        <div><strong>{step.label}</strong><small>{step.description}</small></div>
        <b>{step.network}</b>
      </li>)}
    </ol>
    <footer className="journey-board__networks"><span><i className="network-dot network-dot--sepolia" />SEPOLIA · MANDATE</span><span><i className="network-dot network-dot--creditcoin" />CC3 · CAPITAL</span><span><i className="network-dot network-dot--attestcoin" />ATTESTCOIN · PROOF</span></footer>
  </section>;
}
