export type ExecutionMode = "demo" | "wallet";

export const EXECUTION_MODE_KEY = "trustfutures:execution-mode";

export function readExecutionMode(storage?: Pick<Storage, "getItem">): ExecutionMode {
  return storage?.getItem(EXECUTION_MODE_KEY) === "wallet" ? "wallet" : "demo";
}

export function writeExecutionMode(storage: Pick<Storage, "setItem">, mode: ExecutionMode) {
  storage.setItem(EXECUTION_MODE_KEY, mode);
}
