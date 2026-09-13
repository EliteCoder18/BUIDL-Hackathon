const JOURNEY_ROUTE = /^\/(quotes|policies|proofs)\/0x[0-9a-fA-F]{64}$/;

export const ACTIVE_JOURNEY_KEY = "trustfutures:active-journey";

export function parseJourneyPath(value: string | null): string | undefined {
  return value && JOURNEY_ROUTE.test(value) ? value : undefined;
}

export function isJourneyPath(value: string): boolean {
  return parseJourneyPath(value) !== undefined;
}
