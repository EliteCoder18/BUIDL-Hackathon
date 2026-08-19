import assert from "node:assert/strict";
import test from "node:test";
import { quoteTypedData } from "../lib/wallet/useSignQuote";

test("quote typed data preserves canonical EIP-712 field order", () => {
  const typed = quoteTypedData({ chainId: 102031, verifyingContract: `0x${"11".repeat(20)}` }, {
    jobKey: `0x${"22".repeat(32)}`, underwriter: `0x${"33".repeat(20)}`,
    coverageAmount: 1000n, premiumAmount: 10n, juniorAmount: 200n,
    validUntil: 99n, modelHash: `0x${"44".repeat(32)}`, nonce: 7n,
  });
  assert.equal(typed.primaryType, "Quote");
  assert.deepEqual(typed.types.Quote.map(({ name }) => name), ["jobKey", "underwriter", "coverageAmount", "premiumAmount", "juniorAmount", "validUntil", "modelHash", "nonce"]);
});
