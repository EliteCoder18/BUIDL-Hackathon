export type StatusTone = "neutral" | "live" | "success" | "warning" | "danger" | "cyan";

export interface StatusChipProps {
  label: string;
  tone?: StatusTone;
  pulse?: boolean;
}

export function StatusChip({ label, tone = "neutral", pulse = false }: StatusChipProps) {
  return (
    <span className={`status-chip status-chip--${tone}${pulse ? " status-chip--pulse" : ""}`}>
      <span className="status-chip__dot" aria-hidden="true" />
      {label}
    </span>
  );
}

