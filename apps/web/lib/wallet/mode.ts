export type WalletMode =
  | { kind: "embedded"; label: "Embedded demo" }
  | { kind: "public"; label: "Public testnet" };

export function resolveWalletMode(embeddedDemo: string | undefined): WalletMode {
  if (["1", "true", "yes"].includes(embeddedDemo?.trim().toLowerCase() ?? "")) {
    return { kind: "embedded", label: "Embedded demo" };
  }
  return { kind: "public", label: "Public testnet" };
}
