"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { sepolia } from "wagmi/chains";

export function ExternalWalletProviders({ children, projectId }: { children: React.ReactNode; projectId: string }) {
  const config = getDefaultConfig({ appName: "TrustFutures", projectId, chains: [sepolia], ssr: true });
  return <WagmiProvider config={config}><RainbowKitProvider>{children}</RainbowKitProvider></WagmiProvider>;
}
