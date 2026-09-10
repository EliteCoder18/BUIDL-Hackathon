"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { readExecutionMode, writeExecutionMode, type ExecutionMode } from "../lib/wallet/execution-mode";

type ExecutionModeContextValue = { mode: ExecutionMode; setMode: (mode: ExecutionMode) => void };
const ExecutionModeContext = createContext<ExecutionModeContextValue | null>(null);

export function ExecutionModeProvider({ children }: { children: ReactNode }) {
  const [mode, updateMode] = useState<ExecutionMode>("demo");
  useEffect(() => updateMode(readExecutionMode(window.localStorage)), []);
  const setMode = useCallback((next: ExecutionMode) => {
    updateMode(next);
    writeExecutionMode(window.localStorage, next);
  }, []);
  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);
  return <ExecutionModeContext.Provider value={value}>{children}</ExecutionModeContext.Provider>;
}

export function useExecutionMode() {
  const value = useContext(ExecutionModeContext);
  if (!value) throw new Error("useExecutionMode must be used within ExecutionModeProvider");
  return value;
}
