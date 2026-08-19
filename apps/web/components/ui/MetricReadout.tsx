import type { ReactNode } from "react";

export interface MetricReadoutProps {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "default" | "green" | "cyan" | "amber" | "red";
}

export function MetricReadout({ label, value, detail, tone = "default" }: MetricReadoutProps) {
  return (
    <div className={`satellite-readout metric-readout metric-readout--${tone}`}>
      <span className="metric-readout__label">{label}</span>
      <strong className="metric-readout__value">{value}</strong>
      {detail && <span className="metric-readout__detail">{detail}</span>}
    </div>
  );
}
