import type { AgentHistory } from "../../lib/api";

export function buildAgentProfile(history: AgentHistory) {
  const completedMandates = history.successCount + history.violationCount + history.expiryCount;
  const share = (count: number) => completedMandates ? count / completedMandates * 100 : 0;
  return {
    completedMandates,
    reliability: share(history.successCount),
    outcomes: [
      { label: "Successful", count: history.successCount, share: share(history.successCount), tone: "success" },
      { label: "Violated", count: history.violationCount, share: share(history.violationCount), tone: "violation" },
      { label: "Expired", count: history.expiryCount, share: share(history.expiryCount), tone: "expiry" },
    ] as const,
  };
}
