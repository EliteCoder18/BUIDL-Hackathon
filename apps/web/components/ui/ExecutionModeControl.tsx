"use client";

import { useExecutionMode } from "../../app/execution-mode-provider";
import type { ExecutionMode } from "../../lib/wallet/execution-mode";

const OPTIONS: Array<{ value: ExecutionMode; label: string }> = [
  { value: "demo", label: "Demo" },
  { value: "wallet", label: "MetaMask" },
];

export function ExecutionModeControl() {
  const { mode, setMode } = useExecutionMode();
  return (
    <div className="execution-mode" role="radiogroup" aria-label="Execution mode">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={mode === option.value}
          className={mode === option.value ? "is-active" : ""}
          onClick={() => setMode(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
