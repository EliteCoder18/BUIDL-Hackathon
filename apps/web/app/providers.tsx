"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState } from "react";
import { resolveWalletMode } from "../lib/wallet/mode";
import { CrossChainOrchestratorProvider } from "../lib/orchestration";

const ExternalWalletProviders = dynamic(
  () => import("./wallet-providers").then((module) => module.ExternalWalletProviders),
  { ssr: false },
);

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 2_000, retry: 1 } },
  }));
  const walletMode = resolveWalletMode(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID);
  const application = <CrossChainOrchestratorProvider apiBaseUrl={process.env.NEXT_PUBLIC_API_URL}>{children}</CrossChainOrchestratorProvider>;
  const content = walletMode.kind === "external"
    ? <ExternalWalletProviders projectId={walletMode.projectId}>{application}</ExternalWalletProviders>
    : application;
  return <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>;
}
