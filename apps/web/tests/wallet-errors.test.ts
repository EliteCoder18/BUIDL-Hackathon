import assert from "node:assert/strict";
import test from "node:test";

import { walletErrorMessage } from "../lib/wallet/errors";

test("wallet errors distinguish rejection, missing wallet, and reverted calls", () => {
  assert.match(walletErrorMessage({ code: 4001 }), /rejected/i);
  assert.match(walletErrorMessage(new Error("Connector not found")), /MetaMask|injected/i);
  assert.match(walletErrorMessage(new Error("execution reverted: stake")), /stake/i);
});
