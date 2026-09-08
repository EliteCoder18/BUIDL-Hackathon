import assert from "node:assert/strict";
import test from "node:test";

import { resolveWalletMode } from "../lib/wallet/mode";

test("public injected-wallet mode is the zero-config default", () => {
  assert.deepEqual(resolveWalletMode(undefined), {
    kind: "public",
    label: "Public testnet",
  });
});

test("the local digital twin requires an explicit embedded-demo flag", () => {
  assert.deepEqual(resolveWalletMode("1"), {
    kind: "embedded",
    label: "Embedded demo",
  });
  assert.equal(resolveWalletMode("true").kind, "embedded");
  assert.equal(resolveWalletMode("0").kind, "public");
});
