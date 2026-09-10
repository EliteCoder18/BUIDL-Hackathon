const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const PRIVATE_KEY = /^0x[0-9a-fA-F]{64}$/;
const ALLOWED_PUBLIC_KEYS = new Set([
  "NEXT_PUBLIC_API_URL",
  "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID",
  "NEXT_PUBLIC_SEPOLIA_RPC_URL",
  "NEXT_PUBLIC_CREDITCOIN_RPC_URL",
]);
const SECRET_PUBLIC_KEY = /(DATABASE|PRIVATE|SECRET|TOKEN|PASSWORD|OPENAI|SIGNER)/i;

function required(env, key) {
  const value = env[key]?.trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function integer(env, key, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = env[key]?.trim() || String(fallback);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${key} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function address(env, key) {
  const value = required(env, key);
  if (!ADDRESS.test(value)) throw new Error(`${key} must be a 20-byte hex address`);
  return value;
}

function privateKey(env, key) {
  const value = required(env, key);
  if (!PRIVATE_KEY.test(value)) throw new Error(`${key} must be a 32-byte hex private key`);
  return value;
}

export function validateApiEnvironment(env = process.env) {
  const databaseUrl = required(env, "DATABASE_URL");
  const creditcoinChainId = integer(env, "CREDITCOIN_CHAIN_ID", 0);
  if (creditcoinChainId !== 102031) throw new Error("CREDITCOIN_CHAIN_ID must be 102031 for CC3 Testnet");
  const underwriterPrivateKeys = [
    privateKey(env, "UNDERWRITER_CONSERVATIVE_PRIVATE_KEY"),
    privateKey(env, "UNDERWRITER_BALANCED_PRIVATE_KEY"),
    privateKey(env, "UNDERWRITER_AGGRESSIVE_PRIVATE_KEY"),
  ];
  if (new Set(underwriterPrivateKeys.map((value) => value.toLowerCase())).size !== underwriterPrivateKeys.length) {
    throw new Error("underwriter private keys must be distinct");
  }
  const liveWallet = env.TRUSTFUTURES_LIVE_WALLET === "true";
  if (liveWallet) {
    required(env, "SEPOLIA_RPC_URL");
    address(env, "TREASURY_JOB_MANAGER_ADDRESS");
    const liveAgentId = required(env, "LIVE_AGENT_ID");
    if (!/^\d+$/.test(liveAgentId)) throw new Error("LIVE_AGENT_ID must be numeric");
  }
  return {
    databaseUrl,
    creditcoinChainId,
    policyManagerAddress: address(env, "POLICY_MANAGER_ADDRESS"),
    underwriterPrivateKeys,
    corsOrigin: required(env, "CORS_ORIGIN"),
    riskServiceUrl: required(env, "RISK_SERVICE_URL"),
  };
}

export function validateWorkerEnvironment(env = process.env) {
  const databaseUrl = required(env, "DATABASE_URL");
  const creditcoinChainId = integer(env, "CREDITCOIN_CHAIN_ID", 0);
  if (creditcoinChainId !== 102031) throw new Error("CREDITCOIN_CHAIN_ID must be 102031 for CC3 Testnet");
  const sourceChainKey = integer(env, "USC_SEPOLIA_CHAIN_KEY", 0);
  if (sourceChainKey !== 1) throw new Error("USC_SEPOLIA_CHAIN_KEY must be 1 for Sepolia");
  return {
    databaseUrl,
    sourceRpcUrl: required(env, "SEPOLIA_RPC_URL"),
    creditcoinRpcUrl: required(env, "CREDITCOIN_RPC_URL"),
    creditcoinChainId,
    proofBuilderUrl: required(env, "PROOF_BUILDER_URL"),
    sourceChainKey,
    adapterAddress: address(env, "ATTESTCOIN_ADAPTER_ADDRESS"),
    creditcoinPrivateKey: privateKey(env, "CREDITCOIN_PRIVATE_KEY"),
    pollIntervalMs: integer(env, "PROOF_WORKER_POLL_MS", 5000, { min: 250, max: 60_000 }),
    maxAttempts: integer(env, "PROOF_WORKER_MAX_ATTEMPTS", 5, { min: 1, max: 20 }),
  };
}

export function publicEnvironmentKeys(env = process.env) {
  const keys = Object.keys(env).filter((key) => key.startsWith("NEXT_PUBLIC_")).sort();
  return {
    allowed: keys.filter((key) => ALLOWED_PUBLIC_KEYS.has(key)),
    unsafe: keys.filter((key) => !ALLOWED_PUBLIC_KEYS.has(key) || SECRET_PUBLIC_KEY.test(key)),
  };
}
