import type { DemoStateResource, LiveMarketResource, VaultResource } from "../../lib/api";
import type { ExecutionMode } from "../../lib/wallet/execution-mode";
import type { OrchestratorState } from "../../lib/trustfutures/orchestrator";

export function resolveMarketMetrics(
  mode: ExecutionMode,
  snapshot?: DemoStateResource,
  demoVault?: VaultResource,
  liveMarket?: LiveMarketResource
): {
  latestPolicyId?: string;
  activePolicyCount?: number;
  confirmedProofCount?: number;
  vault?: VaultResource;
  orchestratorState?: OrchestratorState;
} {
  const latestLivePolicy = liveMarket?.policies[0];
  if (mode === "wallet") {
    const orchestratorState: OrchestratorState | undefined =
      latestLivePolicy?.state === "SETTLED_SUCCESS"
        ? "SETTLED_SUCCESS"
        : latestLivePolicy?.state === "SETTLED_FAILURE"
          ? "SETTLED_SLASHED"
          : (latestLivePolicy?.state === "ACTIVE" || (liveMarket?.activePolicyCount ?? 0) > 0)
            ? "CREDITCOIN_POLICY_LOCKED"
            : undefined;

    return {
      latestPolicyId: latestLivePolicy?.policyId,
      activePolicyCount: liveMarket?.activePolicyCount,
      confirmedProofCount: liveMarket?.confirmedProofCount,
      vault: liveMarket?.vault,
      orchestratorState,
    };
  }
  return {
    latestPolicyId: snapshot?.policies.at(-1)?.policyId,
    activePolicyCount: snapshot?.policies.filter((policy) => policy.state === "CREDITCOIN_POLICY_LOCKED").length,
    confirmedProofCount: snapshot?.proofs.filter((proof) => proof.state === "confirmed").length,
    vault: demoVault,
    orchestratorState: undefined,
  };
}
