"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState } from "react";
import { CrossChainOrchestratorProvider } from "../lib/orchestration";
import { ExecutionModeProvider } from "./execution-mode-provider";

const ExternalWalletProviders = dynamic(
  () => import("./wallet-providers").then((module) => module.ExternalWalletProviders),
  { ssr: false },
);

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 2_000, retry: 1 } },
  }));
  const application = <CrossChainOrchestratorProvider apiBaseUrl={process.env.NEXT_PUBLIC_API_URL}>{children}</CrossChainOrchestratorProvider>;
  return (
    <QueryClientProvider client={queryClient}>
      <ExternalWalletProviders projectId={process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID}>
        <ExecutionModeProvider>{application}</ExecutionModeProvider>
      </ExternalWalletProviders>
    </QueryClientProvider>
  );
}
