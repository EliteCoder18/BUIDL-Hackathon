/**
 * Real CC3 submission worker. It waits for a Sepolia transaction's block to be
 * attested, asks Attestcoin's ProofBuilder for a continuity proof, then invokes
 * AttestcoinOutcomeAdapter.execute on Creditcoin.
 */
import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { chainInfo, proofProvider } from "@gluwa/usc-sdk";

const ADAPTER_ABI = [
  "function execute(uint8,uint64,uint64,bytes,bytes32,tuple(bytes32 hash,bool isLeft)[],bytes32,bytes32[]) returns (bool)",
];

export type WorkerConfig = {
  sourceChainKey: number;
  sourceRpcUrl: string;
  creditcoinRpcUrl: string;
  proofBuilderUrl: string;
  creditcoinPrivateKey: string;
  adapterAddress: string;
};

export async function proveAndSubmit(sourceTxHash: string, config: WorkerConfig): Promise<string> {
  const source = new JsonRpcProvider(config.sourceRpcUrl);
  const creditcoin = new JsonRpcProvider(config.creditcoinRpcUrl);
  const tx = await source.getTransaction(sourceTxHash);
  if (!tx?.blockNumber) throw new Error("Source transaction is missing or unmined");

  const builder = new proofProvider.service.ProofBuilder(config.sourceChainKey, config.proofBuilderUrl);
  // SDK 0.18's declaration references a nominal provider type; runtime accepts ethers v6 provider.
  const chain = new chainInfo.PrecompileChainInfoProvider(creditcoin as never);
  await chain.getLatestAttestedHeightAndHash(config.sourceChainKey);
  await builder.waitUntilHeightAttested(config.sourceChainKey, tx.blockNumber, 15_000, 1_200_000);
  const result = await builder.getProof(sourceTxHash);
  if (!result.success || !result.data) throw new Error(`Attestcoin proof failed: ${result.error ?? "unknown"}`);

  const proof = result.data;
  const signer = new Wallet(config.creditcoinPrivateKey, creditcoin);
  const adapter = new Contract(config.adapterAddress, ADAPTER_ABI, signer);
  const submitted = await adapter.execute(
    0,
    proof.chainKey,
    proof.headerNumber,
    proof.txBytes,
    proof.merkleProof.root,
    proof.merkleProof.siblings,
    proof.continuityProof.lowerEndpointDigest,
    proof.continuityProof.roots,
  );
  const receipt = await submitted.wait();
  if (!receipt?.hash) throw new Error("Creditcoin proof transaction was not mined");
  return receipt.hash;
}
