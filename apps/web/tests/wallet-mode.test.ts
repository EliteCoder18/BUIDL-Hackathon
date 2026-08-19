import assert from "node:assert/strict";
import test from "node:test";

import { resolveWalletMode } from "../lib/wallet/mode";

test("embedded mode never initializes WalletConnect without a configured project", () => {
  assert.deepEqual(resolveWalletMode(undefined), {
    kind: "embedded",
    label: "Embedded demo account",
  });
  assert.equal(resolveWalletMode("trustfutures-testnet").kind, "embedded");
});

test("a plausible WalletConnect project id enables external wallet mode", () => {
  const projectId = "a".repeat(32);
  assert.deepEqual(resolveWalletMode(projectId), {
    kind: "external",
    label: "External wallet",
    projectId,
  });
});
