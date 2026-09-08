import { encodeAbiParameters, isAddress, keccak256, type Address } from "viem";
import type { Quote } from "../trustfutures/types";
import { coverageVaultAbi, mockErc20Abi, policyManagerAbi, treasuryJobManagerAbi, underwriterRegistryAbi } from "./abis";

function positive(value: bigint, label: string): bigint {
  if (value <= 0n) throw new Error(`${label} must be positive`);
  return value;
}

function checkedAddress(value: Address, label: string): Address {
  if (!isAddress(value)) throw new Error(`${label} is not a valid address`);
  return value;
}

export function buildMintPlan(chainId: 11155111 | 102031, token: Address, recipient: Address, amount: bigint) {
  return { chainId, address: checkedAddress(token, "Token"), abi: mockErc20Abi, functionName: "mint" as const, args: [checkedAddress(recipient, "Recipient"), positive(amount, "Mint amount")] as const };
}

export function buildApprovePlan(chainId: 11155111 | 102031, token: Address, spender: Address, amount: bigint) {
  return { chainId, address: checkedAddress(token, "Token"), abi: mockErc20Abi, functionName: "approve" as const, args: [checkedAddress(spender, "Spender"), positive(amount, "Approval amount")] as const };
}

export interface CreateJobTerms {
  manager: Address;
  inputToken: Address;
  outputToken: Address;
  executor: Address;
  agentId: bigint;
  amountIn: bigint;
  minOut: bigint;
  deadline: bigint;
}

export function buildCreateJobPlan(terms: CreateJobTerms) {
  if (terms.agentId < 0n) throw new Error("Agent ID cannot be negative");
  positive(terms.deadline, "Deadline");
  return {
    chainId: 11155111 as const,
    address: checkedAddress(terms.manager, "Job manager"),
    abi: treasuryJobManagerAbi,
    functionName: "createJob" as const,
    args: [terms.agentId, checkedAddress(terms.inputToken, "Input token"), checkedAddress(terms.outputToken, "Output token"), checkedAddress(terms.executor, "Executor"), positive(terms.amountIn, "Input amount"), positive(terms.minOut, "Minimum output"), terms.deadline] as const,
  };
}

export function buildVaultDepositPlan(vault: Address, amount: bigint) {
  return { chainId: 102031 as const, address: checkedAddress(vault, "Vault"), abi: coverageVaultAbi, functionName: "deposit" as const, args: [positive(amount, "Deposit amount")] as const };
}

export function buildUnderwriterDepositPlan(registry: Address, amount: bigint) {
  return { chainId: 102031 as const, address: checkedAddress(registry, "Registry"), abi: underwriterRegistryAbi, functionName: "deposit" as const, args: [positive(amount, "Deposit amount")] as const };
}

export function buildAcceptQuotePlan(policyManager: Address, quote: Quote, signature: `0x${string}`) {
  if (signature.length !== 132) throw new Error("Quote signature must be 65 bytes");
  return { chainId: 102031 as const, address: checkedAddress(policyManager, "Policy manager"), abi: policyManagerAbi, functionName: "acceptQuote" as const, args: [quote, signature] as const };
}

export function deriveJobKey(manager: Address, jobId: bigint): `0x${string}` {
  if (jobId < 0n) throw new Error("Job ID cannot be negative");
  return keccak256(encodeAbiParameters(
    [{ type: "uint256" }, { type: "address" }, { type: "uint256" }],
    [11155111n, checkedAddress(manager, "Job manager"), jobId],
  ));
}
