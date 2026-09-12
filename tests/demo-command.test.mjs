import assert from "node:assert/strict";
import test from "node:test";

import { buildDemoProcesses } from "../scripts/demo.mjs";

test("demo command starts authoritative API and web with embedded mode enabled", () => {
  const processes = buildDemoProcesses({ hasPythonRuntime: false });
  assert.equal(processes[0].name, "api");
  assert.equal(processes[0].env.TRUSTFUTURES_DEMO, "true");
  assert.equal(processes.find(({ name }) => name === "web").env.NEXT_PUBLIC_API_URL, "http://localhost:3001");
  assert.ok(processes.some(({ name }) => name === "web"));
  assert.ok(!processes.some(({ name }) => name === "risk"));
});

test("demo command includes the calibrated risk service when the local runtime exists", () => {
  assert.ok(buildDemoProcesses({ hasPythonRuntime: true }).some(({ name }) => name === "risk"));
});

test("demo command enables live wallet quote verification when testnet signers are configured", () => {
  const environment = {
    SEPOLIA_RPC_URL: "https://sepolia.example",
    POLICY_MANAGER_ADDRESS: "0x1111111111111111111111111111111111111111",
    UNDERWRITER_CONSERVATIVE_PRIVATE_KEY: "key-a",
    UNDERWRITER_BALANCED_PRIVATE_KEY: "key-b",
    UNDERWRITER_AGGRESSIVE_PRIVATE_KEY: "key-c",
  };
  const api = buildDemoProcesses({ hasPythonRuntime: false, environment }).find(({ name }) => name === "api");
  assert.equal(api.env.TRUSTFUTURES_LIVE_WALLET, "true");
  assert.equal(api.env.CREDITCOIN_CHAIN_ID, "102031");
  assert.match(api.env.TREASURY_JOB_MANAGER_ADDRESS, /^0x[0-9a-fA-F]{40}$/);
});

test("demo command configures public Creditcoin market history reads", () => {
  const api = buildDemoProcesses({ hasPythonRuntime: false, environment: { CREDITCOIN_RPC_URL: "https://creditcoin.example" } }).find(({ name }) => name === "api");

  assert.equal(api.env.CREDITCOIN_RPC_URL, "https://creditcoin.example");
  assert.match(api.env.COVERAGE_VAULT_ADDRESS, /^0x[0-9a-fA-F]{40}$/);
  assert.match(api.env.ATTESTCOIN_OUTCOME_ADAPTER_ADDRESS, /^0x[0-9a-fA-F]{40}$/);
  assert.equal(api.env.CREDITCOIN_DEPLOYMENT_BLOCK, "5446387");
});
