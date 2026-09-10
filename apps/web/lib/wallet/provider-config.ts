import { defineChain } from "viem";
import { resolveWalletMode } from "./mode";

export const creditcoinTestnet = defineChain({
  id: 102031,
  name: "Creditcoin CC3 Testnet",
  nativeCurrency: { name: "Creditcoin", symbol: "CTC", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_CREDITCOIN_RPC_URL ?? "https://rpc.cc3-testnet.creditcoin.network"] },
  },
  blockExplorers: {
    default: { name: "Creditcoin Blockscout", url: "https://creditcoin-testnet.blockscout.com" },
  },
  testnet: true,
});

export function walletConnectorKinds(projectId: string | undefined): Array<"injected" | "walletConnect"> {
  return resolveWalletMode(projectId).kind === "external" ? ["injected", "walletConnect"] : ["injected"];
}
