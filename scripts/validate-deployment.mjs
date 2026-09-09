import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SECRET_KEY = /(DATABASE_URL|PRIVATE_KEY|OPENAI_API_KEY|RPC_URL|PASSWORD|SECRET|TOKEN)/;

function requireService(services, name, expected) {
  const service = services.find((candidate) => candidate.name === name);
  if (!service) throw new Error(`Render service ${name} is required`);
  for (const [key, value] of Object.entries(expected)) {
    if (service[key] !== value) throw new Error(`${name}.${key} must be ${value}`);
  }
  return service;
}

function validateSecrets(services) {
  for (const service of services) {
    for (const variable of service.envVars ?? []) {
      if (SECRET_KEY.test(variable.key) && Object.hasOwn(variable, "value")) {
        throw new Error(`${service.name}.${variable.key} contains an embedded secret`);
      }
    }
  }
}

export async function validateDeploymentFiles(root) {
  const render = JSON.parse(await readFile(path.join(root, "render.yaml"), "utf8"));
  const vercel = JSON.parse(await readFile(path.join(root, "vercel.json"), "utf8"));
  const services = render.services ?? [];
  const api = requireService(services, "trustfutures-api", {
    type: "web",
    runtime: "node",
    startCommand: "npm run api",
    healthCheckPath: "/healthz",
  });
  requireService(services, "trustfutures-proof-worker", {
    type: "worker",
    runtime: "node",
    startCommand: "npm run worker",
  });
  requireService(services, "trustfutures-risk", {
    type: "web",
    runtime: "python",
    healthCheckPath: "/healthz",
  });
  validateSecrets(services);
  const requiredApiEnvironment = ["DATABASE_URL", "CORS_ORIGIN", "RISK_SERVICE_URL"];
  const apiKeys = new Set((api.envVars ?? []).map(({ key }) => key));
  for (const key of requiredApiEnvironment) if (!apiKeys.has(key)) throw new Error(`trustfutures-api requires ${key}`);
  if (vercel.framework !== "nextjs") throw new Error("Vercel framework must be nextjs");
  if (vercel.outputDirectory !== ".next") throw new Error("Vercel outputDirectory must target .next relative to the apps/web project root");
  if (vercel.installCommand !== "npm ci" || vercel.buildCommand !== "npm run build") {
    throw new Error("Vercel commands must run relative to the apps/web project root");
  }
  if (vercel.env && Object.keys(vercel.env).some((key) => SECRET_KEY.test(key))) {
    throw new Error("Vercel configuration must not contain backend secrets");
  }
  return {
    renderServices: services.map(({ name }) => name),
    vercelFramework: vercel.framework,
  };
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const result = await validateDeploymentFiles(root);
  console.log(`Deployment manifests valid: ${result.renderServices.join(", ")}; Vercel ${result.vercelFramework}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
