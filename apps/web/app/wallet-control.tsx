"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function ExternalWalletControl() {
  return <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />;
}
