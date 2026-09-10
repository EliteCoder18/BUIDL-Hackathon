import { parseAbi } from "viem";

export const mockErc20Abi = parseAbi([
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
]);

export const treasuryJobManagerAbi = parseAbi([
  "function createJob(uint256 agentId, address inputToken, address outputToken, address executor, uint256 amountIn, uint256 minOut, uint64 deadline) returns (uint256 jobId)",
  "function jobKey(uint256 jobId) view returns (bytes32)",
  "event JobCreated(uint256 indexed jobId, address indexed client, address indexed agent, uint256 amountIn, uint256 minOut, uint64 deadline)",
]);

export const policyManagerAbi = parseAbi([
  "function acceptQuote((bytes32 jobKey,address underwriter,uint256 coverageAmount,uint256 premiumAmount,uint256 juniorAmount,uint64 validUntil,bytes32 modelHash,uint256 nonce) quote, bytes signature) returns (bytes32 id)",
  "function policyId((bytes32 jobKey,address underwriter,uint256 coverageAmount,uint256 premiumAmount,uint256 juniorAmount,uint64 validUntil,bytes32 modelHash,uint256 nonce) quote) view returns (bytes32)",
]);
