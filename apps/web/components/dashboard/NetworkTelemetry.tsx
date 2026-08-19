import { MetricReadout } from "../ui/MetricReadout";

export interface NetworkTelemetryProps {
  sepoliaBlock?: number | string;
  creditcoinBlock?: number | string;
  proofLatency?: string;
  reservedCapital?: string;
}

export function NetworkTelemetry({
  sepoliaBlock = "—",
  creditcoinBlock = "—",
  proofLatency = "—",
  reservedCapital = "—",
}: NetworkTelemetryProps) {
  return (
    <div className="network-telemetry">
      <MetricReadout label="SEPOLIA HEAD" value={sepoliaBlock} detail="SOURCE CHAIN" tone="green" />
      <MetricReadout label="CC3 HEAD" value={creditcoinBlock} detail="CAPITAL CHAIN" tone="amber" />
      <MetricReadout label="PROOF LATENCY" value={proofLatency} detail="ATTESTCOIN" tone="cyan" />
      <MetricReadout label="RESERVED" value={reservedCapital} detail="mUSDC" />
    </div>
  );
}

