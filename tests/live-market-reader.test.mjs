import assert from "node:assert/strict";
import test from "node:test";
import { Interface, zeroPadValue } from "ethers";

import { createLiveMarketReader } from "../services/api/live-market-reader.mjs";

const POLICY = new Interface([
  "event PolicyAccepted(bytes32 indexed policyId,bytes32 indexed jobKey,address indexed client,address underwriter,uint256 coverageAmount,uint256 premiumAmount)",
  "event PolicySettled(bytes32 indexed policyId,uint8 state,uint256 clientPayout)",
]);
const OUTCOME = new Interface(["event OutcomeProven(bytes32 indexed jobKey,uint8 outcome,bytes32 indexed queryId)"]);
const manager = "0x1111111111111111111111111111111111111111";
const adapter = "0x2222222222222222222222222222222222222222";
const vault = "0x3333333333333333333333333333333333333333";
const client = "0x4444444444444444444444444444444444444444";
const otherClient = "0x5555555555555555555555555555555555555555";
const underwriter = "0x6666666666666666666666666666666666666666";
const policyId = `0x${"aa".repeat(32)}`;
const otherPolicyId = `0x${"bb".repeat(32)}`;
const jobKey = `0x${"cc".repeat(32)}`;
const otherJobKey = `0x${"dd".repeat(32)}`;

function eventLog(iface, event, args, { address, blockNumber, transactionHash }) {
  const encoded = iface.encodeEventLog(iface.getEvent(event), args);
  return { address, blockNumber, transactionHash, data: encoded.data, topics: encoded.topics };
}

test("public market history reports on-chain totals and only the requested wallet's policies", async () => {
  const logs = [
    eventLog(POLICY, "PolicyAccepted", [policyId, jobKey, client, underwriter, 100_000_000n, 14_270_000n], { address: manager, blockNumber: 120, transactionHash: `0x${"01".repeat(32)}` }),
    eventLog(POLICY, "PolicyAccepted", [otherPolicyId, otherJobKey, otherClient, underwriter, 500_000_000n, 9_250_000n], { address: manager, blockNumber: 110, transactionHash: `0x${"02".repeat(32)}` }),
    eventLog(POLICY, "PolicySettled", [otherPolicyId, 2, 0], { address: manager, blockNumber: 115, transactionHash: `0x${"03".repeat(32)}` }),
    eventLog(OUTCOME, "OutcomeProven", [otherJobKey, 1, `0x${"ee".repeat(32)}`], { address: adapter, blockNumber: 114, transactionHash: `0x${"04".repeat(32)}` }),
  ];
  const provider = {
    getBlockNumber: async () => 125,
    getLogs: async ({ address, fromBlock, toBlock }) => logs.filter((log) => address.includes(log.address) && log.blockNumber >= fromBlock && log.blockNumber <= toBlock),
    getBlock: async (blockNumber) => ({ timestamp: blockNumber === 120 ? 1_789_200_000 : 1_789_199_000 }),
  };
  const read = createLiveMarketReader({
    provider,
    policyManagerAddress: manager,
    outcomeAdapterAddress: adapter,
    coverageVaultAddress: vault,
    fromBlock: 100,
    chunkSize: 10,
    readVault: async () => ({ totalAssets: 814_270_000n, reserved: 80_000_000n, freeAssets: 734_270_000n, totalShares: 800_000_000n }),
  });

  const result = await read(client);

  assert.equal(result.chainId, 102031);
  assert.equal(result.activePolicyCount, 1);
  assert.equal(result.confirmedProofCount, 1);
  assert.deepEqual(result.vault, { totalAssets: "814270000", reserved: "80000000", freeAssets: "734270000", totalShares: "800000000" });
  assert.deepEqual(result.policies, [{
    policyId,
    jobKey,
    client,
    underwriter,
    coverageAmount: "100000000",
    premiumAmount: "14270000",
    state: "ACTIVE",
    acceptedAt: "2026-09-12T08:00:00.000Z",
    lockTxHash: `0x${"01".repeat(32)}`,
  }]);
});

test("settled wallet policies include their final state and settlement transaction", async () => {
  const logs = [
    eventLog(POLICY, "PolicyAccepted", [policyId, jobKey, client, underwriter, 100_000_000n, 14_270_000n], { address: manager, blockNumber: 120, transactionHash: `0x${"01".repeat(32)}` }),
    eventLog(POLICY, "PolicySettled", [policyId, 3, 100_000_000n], { address: manager, blockNumber: 121, transactionHash: `0x${"05".repeat(32)}` }),
  ];
  const provider = {
    getBlockNumber: async () => 125,
    getLogs: async ({ address, fromBlock, toBlock }) => logs.filter((log) => address.includes(log.address) && log.blockNumber >= fromBlock && log.blockNumber <= toBlock),
    getBlock: async () => ({ timestamp: 1_789_200_000 }),
  };
  const read = createLiveMarketReader({ provider, policyManagerAddress: manager, outcomeAdapterAddress: adapter, coverageVaultAddress: vault, fromBlock: 100, readVault: async () => ({ totalAssets: 0n, reserved: 0n, freeAssets: 0n, totalShares: 0n }) });

  const [policy] = (await read(client)).policies;

  assert.equal(policy.state, "SETTLED_FAILURE");
  assert.equal(policy.clientPayout, "100000000");
  assert.equal(policy.settlementTxHash, `0x${"05".repeat(32)}`);
});
