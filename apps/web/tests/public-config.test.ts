import assert from "node:assert/strict";
import test from "node:test";

import { creditcoinTestnet, supportedChains } from "../lib/wallet/chains";
import { parseDeploymentManifest } from "../lib/contracts/deployments";

const address = (byte: string) => `0x${byte.repeat(40)}`;

test("Creditcoin CC3 uses the official public testnet metadata", () => {
  assert.equal(creditcoinTestnet.id, 102031);
  assert.equal(creditcoinTestnet.nativeCurrency.symbol, "tCTC");
  assert.equal(creditcoinTestnet.rpcUrls.default.http[0], "https://rpc.cc3-testnet.creditcoin.network");
  assert.equal(creditcoinTestnet.blockExplorers?.default.url, "https://creditcoin-testnet.blockscout.com");
  assert.deepEqual(supportedChains.map((chain) => chain.id), [11155111, 102031]);
});

test("deployment parser accepts the checked-in Sepolia and CC3 shape", () => {
  const parsed = parseDeploymentManifest({
    generatedAt: "2026-09-07T00:00:00.000Z",
    sepolia: {
      chainId: 11155111,
      explorer: "https://sepolia.etherscan.io",
      mockUsdc: address("1"), mockWeth: address("2"), mockDexExecutor: address("3"),
      treasuryJobManager: address("4"), erc8004IdentityRegistry: address("5"),
    },
    creditcoin: {
      chainId: 102031,
      explorer: "https://creditcoin-testnet.blockscout.com",
      mockUsdc: address("6"), coverageVault: address("7"), underwriterRegistry: address("8"),
      attestcoinOutcomeAdapter: address("9"), policyManager: address("a"),
    },
    publicLoop: {
      jobKey: `0x${"b".repeat(64)}`,
      policyId: `0x${"c".repeat(64)}`,
      sourceTransaction: `0x${"d".repeat(64)}`,
      proofTransaction: `0x${"e".repeat(64)}`,
      settlementTransaction: `0x${"f".repeat(64)}`,
    },
  });
  assert.equal(parsed.creditcoin.policyManager, address("a"));
  assert.equal(parsed.publicLoop?.jobKey.length, 66);
});

test("deployment parser rejects the wrong chain and malformed addresses", () => {
  assert.throws(() => parseDeploymentManifest({ sepolia: { chainId: 1 } }), /deployment manifest/i);
});
