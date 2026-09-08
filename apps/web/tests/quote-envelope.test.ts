import assert from "node:assert/strict";
import test from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import { quoteTypedData, validateQuoteEnvelope } from "../lib/contracts/quote-envelope";

const signer = privateKeyToAccount(`0x${"00".repeat(31)}01`);
const manager = `0x${"22".repeat(20)}` as const;
const quote = { jobKey: `0x${"11".repeat(32)}` as const, underwriter: signer.address, coverageAmount: 500_000_000n, premiumAmount: 25_000_000n, juniorAmount: 100_000_000n, validUntil: 2_000_000_000n, modelHash: `0x${"33".repeat(32)}` as const, nonce: 1n };
async function envelope() {
  const signature = await signer.signTypedData(quoteTypedData({ chainId: 102031, verifyingContract: manager }, quote));
  return JSON.parse(JSON.stringify({ quote, signature }, (_, value) => typeof value === "bigint" ? value.toString() : value));
}
test("acceptance validates a portable signature against the deployed CC3 domain", async () => {
  const result = await validateQuoteEnvelope(await envelope(), manager, 1_999_999_999n);
  assert.equal(result.quote.coverageAmount, 500_000_000n);
  await assert.rejects(validateQuoteEnvelope(await envelope(), `0x${"44".repeat(20)}`, 1_999_999_999n), /signature/i);
});
test("mutation and expired quotes are rejected before constructing approvals", async () => {
  const input = await envelope(); input.quote.premiumAmount = "1";
  await assert.rejects(validateQuoteEnvelope(input, manager, 1_999_999_999n), /signature/i);
  await assert.rejects(validateQuoteEnvelope(await envelope(), manager, 2_000_000_001n), /expired/i);
});
test("malformed integers, tranche ratios, and oversized coverage are rejected", async () => {
  for (const [field, value] of [["nonce", "-1"], ["nonce", "1e5"], ["validUntil", (2n ** 64n).toString()], ["coverageAmount", "1000000001"], ["juniorAmount", "1"]]) {
    const input = await envelope(); input.quote[field] = value;
    await assert.rejects(validateQuoteEnvelope(input, manager, 1_999_999_999n));
  }
  await assert.rejects(validateQuoteEnvelope(null, manager, 1n));
});
