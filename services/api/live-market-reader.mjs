import { Contract, Interface } from "ethers";

const policyInterface = new Interface([
  "event PolicyAccepted(bytes32 indexed policyId,bytes32 indexed jobKey,address indexed client,address underwriter,uint256 coverageAmount,uint256 premiumAmount)",
  "event PolicySettled(bytes32 indexed policyId,uint8 state,uint256 clientPayout)",
]);
const outcomeInterface = new Interface([
  "event OutcomeProven(bytes32 indexed jobKey,uint8 outcome,bytes32 indexed queryId)",
]);
const vaultAbi = [
  "function totalAssets() view returns (uint256)",
  "function reserved() view returns (uint256)",
  "function freeAssets() view returns (uint256)",
  "function totalShares() view returns (uint256)",
];

export function createLiveVaultReader({ provider, coverageVaultAddress }) {
  const vault = new Contract(coverageVaultAddress, vaultAbi, provider);
  return async function readLiveVault() {
    const [totalAssets, reserved, freeAssets, totalShares] = await Promise.all([
      vault.totalAssets(), vault.reserved(), vault.freeAssets(), vault.totalShares(),
    ]);
    return Object.fromEntries(Object.entries({ totalAssets, reserved, freeAssets, totalShares }).map(([key, value]) => [key, value.toString()]));
  };
}

function eventTopic(iface, name) {
  return iface.getEvent(name).topicHash;
}

async function logsInChunks(provider, filter, fromBlock, toBlock, chunkSize) {
  const ranges = [];
  for (let start = fromBlock; start <= toBlock; start += chunkSize) ranges.push([start, Math.min(toBlock, start + chunkSize - 1)]);
  const logs = [];
  for (let index = 0; index < ranges.length; index += 4) {
    const batch = await Promise.all(ranges.slice(index, index + 4).map(([start, end]) => provider.getLogs({ ...filter, fromBlock: start, toBlock: end })));
    logs.push(...batch.flat());
  }
  return logs;
}

function policyState(settlement) {
  if (!settlement) return "ACTIVE";
  return Number(settlement.state) === 2 ? "SETTLED_SUCCESS" : "SETTLED_FAILURE";
}

export function createLiveMarketReader({
  provider,
  policyManagerAddress,
  outcomeAdapterAddress,
  coverageVaultAddress,
  fromBlock,
  chunkSize = 2_000,
  readVault,
}) {
  let cachedSnapshot;
  let cachedAt = 0;
  let pendingSnapshot;
  const loadVault = readVault ?? (async () => {
    const vault = new Contract(coverageVaultAddress, vaultAbi, provider);
    const [totalAssets, reserved, freeAssets, totalShares] = await Promise.all([
      vault.totalAssets(), vault.reserved(), vault.freeAssets(), vault.totalShares(),
    ]);
    return { totalAssets, reserved, freeAssets, totalShares };
  });

  async function loadSnapshot() {
    if (cachedSnapshot && Date.now() - cachedAt < 15_000) return cachedSnapshot;
    if (pendingSnapshot) return pendingSnapshot;
    pendingSnapshot = (async () => {
      const latestBlock = await provider.getBlockNumber();
      const [allLogs, vault] = await Promise.all([
        logsInChunks(provider, { address: [policyManagerAddress, outcomeAdapterAddress] }, fromBlock, latestBlock, chunkSize),
        loadVault(),
      ]);
      const snapshot = {
        acceptedLogs: allLogs.filter((log) => log.address.toLowerCase() === policyManagerAddress.toLowerCase() && log.topics[0] === eventTopic(policyInterface, "PolicyAccepted")),
        settledLogs: allLogs.filter((log) => log.address.toLowerCase() === policyManagerAddress.toLowerCase() && log.topics[0] === eventTopic(policyInterface, "PolicySettled")),
        proofLogs: allLogs.filter((log) => log.address.toLowerCase() === outcomeAdapterAddress.toLowerCase() && log.topics[0] === eventTopic(outcomeInterface, "OutcomeProven")),
        vault,
      };
      cachedSnapshot = snapshot;
      cachedAt = Date.now();
      return snapshot;
    })();
    try {
      return await pendingSnapshot;
    } finally {
      pendingSnapshot = undefined;
    }
  }

  return async function readLiveMarket(client) {
    const { acceptedLogs, settledLogs, proofLogs, vault } = await loadSnapshot();
    const settlements = new Map(settledLogs.map((log) => {
      const parsed = policyInterface.parseLog(log);
      return [parsed.args.policyId.toLowerCase(), {
        state: parsed.args.state,
        clientPayout: parsed.args.clientPayout,
        transactionHash: log.transactionHash,
      }];
    }));
    const accepted = acceptedLogs.map((log) => ({ log, parsed: policyInterface.parseLog(log) }));
    const walletPolicies = accepted.filter(({ parsed }) => parsed.args.client.toLowerCase() === client.toLowerCase());
    const blocks = new Map(await Promise.all([...new Set(walletPolicies.map(({ log }) => log.blockNumber))].map(async (blockNumber) => [blockNumber, await provider.getBlock(blockNumber)])));
    const policies = walletPolicies.map(({ log, parsed }) => {
      const settlement = settlements.get(parsed.args.policyId.toLowerCase());
      const timestamp = blocks.get(log.blockNumber)?.timestamp;
      return {
        policyId: parsed.args.policyId,
        jobKey: parsed.args.jobKey,
        client: parsed.args.client,
        underwriter: parsed.args.underwriter,
        coverageAmount: parsed.args.coverageAmount.toString(),
        premiumAmount: parsed.args.premiumAmount.toString(),
        state: policyState(settlement),
        acceptedAt: new Date(Number(timestamp) * 1_000).toISOString(),
        lockTxHash: log.transactionHash,
        ...(settlement ? { clientPayout: settlement.clientPayout.toString(), settlementTxHash: settlement.transactionHash } : {}),
      };
    }).sort((left, right) => right.acceptedAt.localeCompare(left.acceptedAt));

    return {
      chainId: 102031,
      activePolicyCount: accepted.length - settlements.size,
      confirmedProofCount: proofLogs.length,
      vault: Object.fromEntries(Object.entries(vault).map(([key, value]) => [key, value.toString()])),
      policies,
    };
  };
}
