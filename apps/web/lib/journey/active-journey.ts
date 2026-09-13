const JOURNEY_ROUTE = /^\/(quotes|policies|proofs)\/0x[0-9a-fA-F]{64}$/;

export const ACTIVE_JOURNEY_KEY = "trustfutures:active-journey";

export function parseJourneyPath(value: string | null): string | undefined {
  return value && JOURNEY_ROUTE.test(value) ? value : undefined;
}

export function isJourneyPath(value: string): boolean {
  return parseJourneyPath(value) !== undefined;
}

export function cancelWalletJourney(jobKey: string, dependencies: {
  storage: Pick<Storage, "removeItem">;
  reset: () => void;
  navigate: (href: string) => void;
}): void {
  dependencies.storage.removeItem(`trustfutures:live:${jobKey}`);
  dependencies.storage.removeItem(`${ACTIVE_JOURNEY_KEY}:wallet`);
  dependencies.reset();
  dependencies.navigate("/jobs/new");
}
