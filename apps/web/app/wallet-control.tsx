"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

export function ExternalWalletControl() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, error, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [hasProvider, setHasProvider] = useState(false);
  useEffect(() => setHasProvider("ethereum" in window), []);
  const metaMask = connectors.find((connector) => connector.id.toLowerCase().includes("metamask") || connector.type === "injected");

  if (isConnected && address) {
    return (
      <button className="wallet-compact" type="button" onClick={() => disconnect()} aria-label="Disconnect MetaMask">
        <span>{address.slice(0, 6)}…{address.slice(-4)}</span>
        <small>Disconnect</small>
      </button>
    );
  }

  if (!hasProvider || !metaMask) {
    return (
      <a className="wallet-compact" href="https://metamask.io/download/" target="_blank" rel="noreferrer" aria-label="Get MetaMask">
        <span>Get MetaMask</span>
        <small>Required for live mode</small>
      </a>
    );
  }

  return (
    <div className="wallet-connect-control">
      <button className="wallet-compact" type="button" disabled={isPending} onClick={() => connect({ connector: metaMask })}>
        <span>{isPending ? "Connecting…" : "Connect MetaMask"}</span>
        <small>Public testnet</small>
      </button>
      {error && <span className="wallet-connect-error" role="alert">Connection failed</span>}
    </div>
  );
}
