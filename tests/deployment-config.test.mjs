import assert from "node:assert/strict";
import test from "node:test";

import {
  publicEnvironmentKeys,
  validateApiEnvironment,
  validateWorkerEnvironment,
} from "../services/deployment/config.mjs";

const privateKey = (digit) => `0x${digit.repeat(64)}`;

test("worker configuration accepts only the supported public testnets", () => {
  const config = validateWorkerEnvironment({
    DATABASE_URL: "postgresql://postgres:secret@db.example.test:5432/postgres?sslmode=require",
    SEPOLIA_RPC_URL: "https://sepolia.example.test",
    CREDITCOIN_RPC_URL: "https://creditcoin.example.test",
    CREDITCOIN_CHAIN_ID: "102031",
    PROOF_BUILDER_URL: "https://proof.example.test",
    USC_SEPOLIA_CHAIN_KEY: "1",
    ATTESTCOIN_ADAPTER_ADDRESS: `0x${"a".repeat(40)}`,
    CREDITCOIN_PRIVATE_KEY: privateKey("1"),
    PROOF_WORKER_POLL_MS: "2500",
    PROOF_WORKER_MAX_ATTEMPTS: "4",
  });

  assert.equal(config.creditcoinChainId, 102031);
  assert.equal(config.sourceChainKey, 1);
  assert.equal(config.pollIntervalMs, 2500);
  assert.equal(config.maxAttempts, 4);
  assert.equal(config.adapterAddress, `0x${"a".repeat(40)}`);
});

test("worker configuration fails closed when secrets are missing or a mainnet-like chain is selected", () => {
  assert.throws(() => validateWorkerEnvironment({}), /DATABASE_URL/);
  assert.throws(() => validateWorkerEnvironment({
    DATABASE_URL: "postgresql://db",
    SEPOLIA_RPC_URL: "https://sepolia.example.test",
    CREDITCOIN_RPC_URL: "https://creditcoin.example.test",
    CREDITCOIN_CHAIN_ID: "1",
    PROOF_BUILDER_URL: "https://proof.example.test",
    USC_SEPOLIA_CHAIN_KEY: "1",
    ATTESTCOIN_ADAPTER_ADDRESS: `0x${"a".repeat(40)}`,
    CREDITCOIN_PRIVATE_KEY: privateKey("1"),
  }), /102031/);
});

test("API configuration rejects reused underwriter identities", () => {
  const shared = privateKey("2");
  assert.throws(() => validateApiEnvironment({
    DATABASE_URL: "postgresql://db",
    CREDITCOIN_CHAIN_ID: "102031",
    POLICY_MANAGER_ADDRESS: `0x${"b".repeat(40)}`,
    UNDERWRITER_CONSERVATIVE_PRIVATE_KEY: shared,
    UNDERWRITER_BALANCED_PRIVATE_KEY: shared,
    UNDERWRITER_AGGRESSIVE_PRIVATE_KEY: privateKey("3"),
  }), /distinct/);
});

test("public environment audit identifies secret-shaped frontend variables", () => {
  assert.deepEqual(publicEnvironmentKeys({
    NEXT_PUBLIC_API_URL: "https://api.example.test",
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: "public-project-id",
    NEXT_PUBLIC_DATABASE_URL: "postgresql://secret",
    NEXT_PUBLIC_SIGNER_PRIVATE_KEY: privateKey("4"),
  }), {
    allowed: ["NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"],
    unsafe: ["NEXT_PUBLIC_DATABASE_URL", "NEXT_PUBLIC_SIGNER_PRIVATE_KEY"],
  });
});
