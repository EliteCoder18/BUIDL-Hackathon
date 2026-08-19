"use client";

import { createContext, useContext, useMemo, type PropsWithChildren } from "react";
import { useMachine } from "@xstate/react";

import {
  createTrustFuturesApi,
  type TrustFuturesApi,
} from "../api/client";
import {
  crossChainOrchestrator,
  type CrossChainEvent,
  type OrchestratorContext,
  type OrchestratorState,
} from "../trustfutures/orchestrator";

export interface CrossChainOrchestrationValue {
  state: OrchestratorState;
  context: OrchestratorContext;
  send: (event: CrossChainEvent) => void;
  api: TrustFuturesApi;
}

const CrossChainOrchestrationContext = createContext<CrossChainOrchestrationValue | null>(null);

export interface CrossChainOrchestratorProviderProps extends PropsWithChildren {
  apiBaseUrl?: string;
}

export function CrossChainOrchestratorProvider({ children, apiBaseUrl }: CrossChainOrchestratorProviderProps) {
  const [snapshot, send] = useMachine(crossChainOrchestrator);
  const api = useMemo(() => createTrustFuturesApi({
    baseUrl: apiBaseUrl,
    onEvents: (events) => events.forEach((event) => send(event)),
  }), [apiBaseUrl, send]);
  const value = useMemo<CrossChainOrchestrationValue>(() => ({
    state: snapshot.value as OrchestratorState,
    context: snapshot.context,
    send,
    api,
  }), [api, send, snapshot.context, snapshot.value]);

  return (
    <CrossChainOrchestrationContext.Provider value={value}>
      {children}
    </CrossChainOrchestrationContext.Provider>
  );
}

export function useCrossChainOrchestrator(): CrossChainOrchestrationValue {
  const value = useContext(CrossChainOrchestrationContext);
  if (!value) throw new Error("useCrossChainOrchestrator must be used inside CrossChainOrchestratorProvider");
  return value;
}

export function useTrustFuturesApi(): TrustFuturesApi {
  return useCrossChainOrchestrator().api;
}
