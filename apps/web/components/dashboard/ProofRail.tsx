import { StatusChip, type StatusTone } from "../ui/StatusChip";

export type ProofStageStatus = "waiting" | "running" | "verified" | "failed";

export interface ProofStage {
  id: string;
  label: string;
  detail: string;
  status: ProofStageStatus;
  reference?: string;
}

const TONES: Record<ProofStageStatus, StatusTone> = {
  waiting: "neutral",
  running: "cyan",
  verified: "success",
  failed: "danger",
};

export interface ProofRailProps {
  stages: readonly ProofStage[];
}

export function ProofRail({ stages }: ProofRailProps) {
  return (
    <ol className="proof-rail">
      {stages.map((stage, index) => (
        <li key={stage.id} className={`proof-rail__stage proof-rail__stage--${stage.status}`}>
          <span className="proof-rail__sequence" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          <div className="proof-rail__content">
            <div className="proof-rail__heading">
              <strong>{stage.label}</strong>
              <StatusChip label={stage.status.toUpperCase()} tone={TONES[stage.status]} pulse={stage.status === "running"} />
            </div>
            <p>{stage.detail}</p>
            {stage.reference && <code>{stage.reference}</code>}
          </div>
        </li>
      ))}
    </ol>
  );
}

