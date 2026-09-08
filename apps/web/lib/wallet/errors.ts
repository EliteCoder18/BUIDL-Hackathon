export function walletErrorMessage(cause: unknown): string {
  const coded = cause as { code?: number; shortMessage?: string; message?: string } | undefined;
  if (coded?.code === 4001) return "The wallet request was rejected. No transaction was sent.";
  const detail = coded?.shortMessage ?? coded?.message ?? (cause instanceof Error ? cause.message : "Unknown wallet error");
  if (/connector not found|provider not found|window\.ethereum/i.test(detail)) {
    return "No injected wallet was found. Install MetaMask, unlock it, and reload this page.";
  }
  const reverted = detail.match(/(?:execution reverted|reverted)(?::| with reason string)?\s*['\"]?([^'\"\n]+)/i);
  if (reverted?.[1]) return `Contract rejected the transaction: ${reverted[1].trim()}`;
  return detail.length > 220 ? `${detail.slice(0, 217)}…` : detail;
}
