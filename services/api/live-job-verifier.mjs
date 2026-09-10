import { AbiCoder, Interface, getAddress, keccak256 } from "ethers";

export const LIVE_JOB_ABI = [
  "function createJob(uint256 agentId,address inputToken,address outputToken,address executor,uint256 amountIn,uint256 minOut,uint64 deadline) returns (uint256 jobId)",
  "event JobCreated(uint256 indexed jobId,address indexed client,address indexed agent,uint256 amountIn,uint256 minOut,uint64 deadline)",
];

const iface = new Interface(LIVE_JOB_ABI);

export async function verifyLiveJob({ sourceTxHash, expectedManager, provider }) {
  const [receipt, transaction] = await Promise.all([
    provider.getTransactionReceipt(sourceTxHash),
    provider.getTransaction(sourceTxHash),
  ]);
  if (!receipt || !transaction) throw new Error("Sepolia transaction is not mined");
  const manager = getAddress(expectedManager);
  if (receipt.status !== 1 || !receipt.to || !transaction.to || getAddress(receipt.to) !== manager || getAddress(transaction.to) !== manager) {
    throw new Error("Transaction was not confirmed by the configured TreasuryJobManager");
  }
  const decoded = iface.decodeFunctionData("createJob", transaction.data);
  const log = receipt.logs
    .filter((entry) => getAddress(entry.address) === manager)
    .map((entry) => { try { return iface.parseLog(entry); } catch { return null; } })
    .find((entry) => entry?.name === "JobCreated");
  if (!log) throw new Error("Confirmed transaction has no JobCreated event");
  if (getAddress(log.args.client) !== getAddress(transaction.from)) throw new Error("JobCreated client does not match transaction signer");
  const [agentId, inputToken, outputToken, executor, amountIn, minOut, deadline] = decoded;
  if (amountIn !== log.args.amountIn || minOut !== log.args.minOut || deadline !== log.args.deadline) throw new Error("JobCreated event does not match transaction terms");
  const jobId = log.args.jobId;
  const jobKey = keccak256(AbiCoder.defaultAbiCoder().encode(["uint256", "address", "uint256"], [11155111n, manager, jobId]));
  return {
    sourceTxHash,
    jobKey,
    jobId: jobId.toString(),
    agentId: agentId.toString(),
    client: getAddress(transaction.from),
    agent: getAddress(log.args.agent),
    inputToken: getAddress(inputToken),
    outputToken: getAddress(outputToken),
    executor: getAddress(executor),
    amountIn: amountIn.toString(),
    minOut: minOut.toString(),
    deadline: deadline.toString(),
  };
}
