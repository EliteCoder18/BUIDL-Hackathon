import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("public provider uses an injected connector without WalletConnect credentials", () => {
  const provider = readFileSync(new URL("../app/wallet-providers.tsx", import.meta.url), "utf8");
  assert.match(provider, /injected\(/);
  assert.doesNotMatch(provider, /getDefaultConfig|projectId/);
  assert.match(provider, /creditcoinTestnet/);
});

test("wallet control exposes connect, disconnect, and chain switching", () => {
  const control = readFileSync(new URL("../app/wallet-control.tsx", import.meta.url), "utf8");
  assert.match(control, /useConnect/);
  assert.match(control, /useDisconnect/);
  assert.match(control, /useSwitchChain/);
  assert.match(control, /MetaMask/i);
});
