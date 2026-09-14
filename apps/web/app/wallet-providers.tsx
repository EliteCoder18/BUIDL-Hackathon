"use client";

import { useMemo } from "react";
import { createConfig, http, WagmiProvider } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { sepolia } from "wagmi/chains";
import { creditcoinTestnet, walletConnectorKinds } from "../lib/wallet/provider-config";

export function ExternalWalletProviders({ children, projectId }: { children: React.ReactNode; projectId?: string }) {
  const config = useMemo(() => {
    const connectors = walletConnectorKinds(projectId).map((kind) => kind === "injected"
      ? injected({ target: "metaMask" })
      : walletConnect({ projectId: projectId! }));
    return createConfig({
      chains: [sepolia, creditcoinTestnet],
      connectors,
      transports: {
        [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
        [creditcoinTestnet.id]: http(process.env.NEXT_PUBLIC_CREDITCOIN_RPC_URL),
      },
      ssr: true,
    });
  }, [projectId]);
  return <WagmiProvider config={config}>{children}</WagmiProvider>;
}
