"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { creditcoinTestnet, publicSepolia } from "../lib/wallet/chains";

export function ExternalWalletControl() {
  const { address, chainId, isConnected } = useAccount();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const connector = connectors.find((candidate) => candidate.name.toLowerCase().includes("meta")) ?? connectors[0];

  if (!isConnected) {
    return (
      <div className="wallet-connect-wrap"><button className="wallet-connect" type="button" disabled={!connector || isPending} onClick={() => connector && connect({ connector })}>
        <i />{isPending ? "CONNECTING…" : "CONNECT METAMASK"}
      </button>{error && <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">INSTALL / UNLOCK METAMASK ↗</a>}</div>
    );
  }

  return (
    <div className="wallet-console">
      <span className="wallet-console__account"><i />{address?.slice(0, 6)}…{address?.slice(-4)}</span>
      <div className="wallet-console__networks" aria-label="Switch transaction network">
        <button type="button" className={chainId === publicSepolia.id ? "active" : ""} disabled={switching} onClick={() => switchChain({ chainId: publicSepolia.id })}>SEP</button>
        <button type="button" className={chainId === creditcoinTestnet.id ? "active" : ""} disabled={switching} onClick={() => switchChain({ chainId: creditcoinTestnet.id })}>CC3</button>
      </div>
      <button className="wallet-console__disconnect" type="button" onClick={() => disconnect()} aria-label="Disconnect wallet">×</button>
    </div>
  );
}
