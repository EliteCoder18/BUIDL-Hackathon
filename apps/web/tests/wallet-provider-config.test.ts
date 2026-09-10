import assert from "node:assert/strict";
import test from "node:test";
import { creditcoinTestnet, walletConnectorKinds } from "../lib/wallet/provider-config";

test("injected MetaMask remains available without WalletConnect configuration", () => {
  assert.deepEqual(walletConnectorKinds(undefined), ["injected"]);
  assert.equal(creditcoinTestnet.id, 102031);
});

test("a valid WalletConnect project adds rather than replaces MetaMask", () => {
  assert.deepEqual(walletConnectorKinds("12345678901234567890123456789012"), ["injected", "walletConnect"]);
});
