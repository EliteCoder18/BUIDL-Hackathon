import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function deploymentVerificationCommands({ hasVirtualEnv = existsSync(path.join(root, ".venv/bin/python")) } = {}) {
  return [
    { label: "deployment manifests", command: "npm", args: ["run", "validate:deployment"] },
    { label: "root tests", command: "npm", args: ["test"] },
    { label: "root typecheck", command: "npm", args: ["run", "typecheck"] },
    { label: "web tests", command: "npm", args: ["--prefix", "apps/web", "test"] },
    { label: "web build", command: "npm", args: ["--prefix", "apps/web", "run", "build"] },
    { label: "risk tests", command: hasVirtualEnv ? path.join(root, ".venv/bin/python") : "python3", args: ["-m", "pytest", "services/ml"] },
  ];
}

function runProcess({ label, command, args }) {
  console.log(`\n[verify] ${label}`);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit", env: process.env });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed (${code ?? signal})`));
    });
  });
}

export async function runVerification({
  run = runProcess,
  commands = deploymentVerificationCommands(),
} = {}) {
  for (const command of commands) await run(command);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runVerification().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
