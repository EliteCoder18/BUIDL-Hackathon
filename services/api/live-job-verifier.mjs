import { AbiCoder, Interface, getAddress, keccak256 } from "ethers";

export const LIVE_JOB_ABI = [
  "function createJob(uint256 agentId,address inputToken,address outputToken,address executor,uint256 amountIn,uint256 minOut,uint64 deadline) returns (uint256 jobId)",
  "function jobs(uint256) view returns (address client,address agent,uint256 agentId,address inputToken,address outputToken,address executor,uint256 amountIn,uint256 minOut,uint64 deadline,uint8 outcome)",
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
  if (receipt.status !== 1 || !receipt.to || !transaction.to || getAddress(receipt.to) !== getAddress(transaction.to)) {
    throw new Error("Transaction was not confirmed by the configured TreasuryJobManager");
  }
  const log = receipt.logs
    .filter((entry) => getAddress(entry.address) === manager)
    .map((entry) => { try { return iface.parseLog(entry); } catch { return null; } })
    .find((entry) => entry?.name === "JobCreated");
  if (!log) throw new Error("Transaction was not confirmed by the configured TreasuryJobManager");
  if (getAddress(log.args.client) !== getAddress(transaction.from)) throw new Error("JobCreated client does not match transaction signer");
  const jobId = log.args.jobId;
  let agentId;
  let inputToken;
  let outputToken;
  let executor;
  let amountIn;
  let minOut;
  let deadline;
  let agent = log.args.agent;
  if (getAddress(transaction.to) === manager) {
    [agentId, inputToken, outputToken, executor, amountIn, minOut, deadline] = iface.decodeFunctionData("createJob", transaction.data);
  } else {
    const encoded = await provider.call({ to: manager, data: iface.encodeFunctionData("jobs", [jobId]) }, receipt.blockNumber);
    const stored = iface.decodeFunctionResult("jobs", encoded);
    const [storedClient, storedAgent, storedAgentId, storedInputToken, storedOutputToken, storedExecutor, storedAmountIn, storedMinOut, storedDeadline, storedOutcome] = stored;
    [agent, agentId, inputToken, outputToken, executor, amountIn, minOut, deadline] = [storedAgent, storedAgentId, storedInputToken, storedOutputToken, storedExecutor, storedAmountIn, storedMinOut, storedDeadline];
    if (getAddress(storedClient) !== getAddress(transaction.from) || storedOutcome !== 0n) {
      throw new Error("Stored job does not match transaction signer or creation state");
    }
  }
  if (getAddress(agent) !== getAddress(log.args.agent) || amountIn !== log.args.amountIn || minOut !== log.args.minOut || deadline !== log.args.deadline) {
    throw new Error("JobCreated event does not match transaction terms");
  }
  const jobKey = keccak256(AbiCoder.defaultAbiCoder().encode(["uint256", "address", "uint256"], [11155111n, manager, jobId]));
  return {
    sourceTxHash,
    jobKey,
    jobId: jobId.toString(),
    agentId: agentId.toString(),
    client: getAddress(transaction.from),
    agent: getAddress(agent),
    inputToken: getAddress(inputToken),
    outputToken: getAddress(outputToken),
    executor: getAddress(executor),
    amountIn: amountIn.toString(),
    minOut: minOut.toString(),
    deadline: deadline.toString(),
  };
}
