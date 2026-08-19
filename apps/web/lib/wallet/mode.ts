export type WalletMode =
  | { kind: "embedded"; label: "Embedded demo account" }
  | { kind: "external"; label: "External wallet"; projectId: string };

const PLACEHOLDER_IDS = new Set(["trustfutures-testnet", "your-project-id", ""]);

export function resolveWalletMode(projectId: string | undefined): WalletMode {
  const normalized = projectId?.trim() ?? "";
  if (normalized.length < 20 || PLACEHOLDER_IDS.has(normalized.toLowerCase())) {
    return { kind: "embedded", label: "Embedded demo account" };
  }
  return { kind: "external", label: "External wallet", projectId: normalized };
}
