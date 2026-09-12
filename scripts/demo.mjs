import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const deployment = JSON.parse(readFileSync(path.join(root, "deployments/testnet.json"), "utf8"));

export function buildDemoProcesses({ hasPythonRuntime = existsSync(path.join(root, ".venv/bin/python")), environment = process.env } = {}) {
  const shared = { ...environment };
  const apiEnvironment = {
    ...shared,
    TRUSTFUTURES_DEMO: "true",
    RISK_SERVICE_URL: "http://127.0.0.1:8000",
    PORT: "3001",
    CREDITCOIN_CHAIN_ID: shared.CREDITCOIN_CHAIN_ID || String(deployment.creditcoin.chainId),
    POLICY_MANAGER_ADDRESS: shared.POLICY_MANAGER_ADDRESS || deployment.creditcoin.policyManager,
    TREASURY_JOB_MANAGER_ADDRESS: shared.TREASURY_JOB_MANAGER_ADDRESS || deployment.sepolia.treasuryJobManager,
    COVERAGE_VAULT_ADDRESS: shared.COVERAGE_VAULT_ADDRESS || deployment.creditcoin.coverageVault,
    ATTESTCOIN_OUTCOME_ADAPTER_ADDRESS: shared.ATTESTCOIN_OUTCOME_ADAPTER_ADDRESS || deployment.creditcoin.attestcoinOutcomeAdapter,
    CREDITCOIN_DEPLOYMENT_BLOCK: shared.CREDITCOIN_DEPLOYMENT_BLOCK || String(deployment.transactions["creditcoin:PolicyManager"].receipt.blockNumber),
  };
  const liveWalletReady = [
    apiEnvironment.SEPOLIA_RPC_URL,
    apiEnvironment.POLICY_MANAGER_ADDRESS,
    apiEnvironment.TREASURY_JOB_MANAGER_ADDRESS,
    apiEnvironment.UNDERWRITER_CONSERVATIVE_PRIVATE_KEY,
    apiEnvironment.UNDERWRITER_BALANCED_PRIVATE_KEY,
    apiEnvironment.UNDERWRITER_AGGRESSIVE_PRIVATE_KEY,
  ].every(Boolean);
  apiEnvironment.TRUSTFUTURES_LIVE_WALLET = liveWalletReady ? "true" : "false";
  const processes = [
    {
      name: "api",
      command: process.execPath,
      args: ["services/api/server.mjs"],
      env: apiEnvironment,
    },
    {
      name: "web",
      command: process.platform === "win32" ? "npm.cmd" : "npm",
      args: ["--prefix", "apps/web", "run", "dev"],
      env: { ...shared, NEXT_PUBLIC_API_URL: "http://localhost:3001" },
    },
  ];
  if (hasPythonRuntime) {
    processes.splice(1, 0, {
      name: "risk",
      command: path.join(root, ".venv/bin/python"),
      args: ["-m", "uvicorn", "services.ml.app:app", "--host", "127.0.0.1", "--port", "8000"],
      env: shared,
    });
  }
  return processes;
}

function run() {
  const envFile = path.join(root, ".env");
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const children = buildDemoProcesses().map((spec) => {
    const child = spawn(spec.command, spec.args, { cwd: root, env: spec.env, stdio: ["inherit", "pipe", "pipe"] });
    child.stdout.on("data", (chunk) => process.stdout.write(`[${spec.name}] ${chunk}`));
    child.stderr.on("data", (chunk) => process.stderr.write(`[${spec.name}] ${chunk}`));
    return { ...spec, child };
  });
  let stopping = false;
  const stop = (exitCode = 0) => {
    if (stopping) return;
    stopping = true;
    for (const { child } of children) if (!child.killed) child.kill("SIGTERM");
    setTimeout(() => process.exit(exitCode), 250).unref();
  };
  for (const { name, child } of children) {
    child.on("exit", (code, signal) => {
      if (!stopping && code !== 0) {
        process.stderr.write(`[demo] ${name} exited (${code ?? signal})\n`);
        stop(code ?? 1);
      }
    });
  }
  process.once("SIGINT", () => stop(0));
  process.once("SIGTERM", () => stop(0));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
