import assert from "node:assert/strict";
import test from "node:test";
import { readExecutionMode, writeExecutionMode } from "../lib/wallet/execution-mode";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) { return values.get(key) ?? null; },
    setItem(key: string, value: string) { values.set(key, value); },
  };
}

test("execution mode defaults to demo and persists an explicit wallet choice", () => {
  const storage = memoryStorage();
  assert.equal(readExecutionMode(storage), "demo");
  writeExecutionMode(storage, "wallet");
  assert.equal(readExecutionMode(storage), "wallet");
});

test("invalid persisted execution modes fail closed to demo", () => {
  const storage = memoryStorage();
  storage.setItem("trustfutures:execution-mode", "mainnet");
  assert.equal(readExecutionMode(storage), "demo");
});
