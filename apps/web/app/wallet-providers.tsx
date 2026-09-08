"use client";

import { createConfig, http, injected, WagmiProvider } from "wagmi";
import { creditcoinTestnet, publicSepolia, supportedChains } from "../lib/wallet/chains";

const config = createConfig({
  chains: supportedChains,
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [publicSepolia.id]: http(publicSepolia.rpcUrls.default.http[0]),
    [creditcoinTestnet.id]: http(creditcoinTestnet.rpcUrls.default.http[0]),
  },
  ssr: true,
});

export function ExternalWalletProviders({ children }: { children: React.ReactNode }) {
  return <WagmiProvider config={config}>{children}</WagmiProvider>;
}
