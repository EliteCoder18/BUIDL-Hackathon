import { defineChain } from "viem";

export const creditcoinTestnet = defineChain({
  id: 102031,
  name: "Creditcoin Testnet",
  nativeCurrency: { name: "Test Creditcoin", symbol: "tCTC", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_CREDITCOIN_RPC_URL ?? "https://rpc.cc3-testnet.creditcoin.network"] },
  },
  blockExplorers: {
    default: { name: "Creditcoin Blockscout", url: "https://creditcoin-testnet.blockscout.com" },
  },
  testnet: true,
});

export const publicSepolia = defineChain({
  id: 11155111,
  name: "Sepolia",
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com"] },
  },
  blockExplorers: { default: { name: "Etherscan", url: "https://sepolia.etherscan.io" } },
  testnet: true,
});

export const supportedChains = [publicSepolia, creditcoinTestnet] as const;

export function explorerTransactionUrl(chainId: number, hash: string): string | undefined {
  const chain = supportedChains.find((candidate) => candidate.id === chainId);
  return chain ? `${chain.blockExplorers.default.url}/tx/${hash}` : undefined;
}
