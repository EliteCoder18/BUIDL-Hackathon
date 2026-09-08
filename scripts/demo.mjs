import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function buildDemoProcesses({ hasPythonRuntime = existsSync(path.join(root, ".venv/bin/python")) } = {}) {
  const shared = { ...process.env };
  const processes = [
    {
      name: "api",
      command: process.execPath,
      args: ["services/api/server.mjs"],
      env: { ...shared, TRUSTFUTURES_DEMO: "true", RISK_SERVICE_URL: "http://127.0.0.1:8000", PORT: "3001" },
    },
    {
      name: "web",
      command: process.platform === "win32" ? "npm.cmd" : "npm",
      args: ["--prefix", "apps/web", "run", "dev"],
      env: { ...shared, NEXT_PUBLIC_API_URL: "http://localhost:3001", NEXT_PUBLIC_EMBEDDED_DEMO: "1" },
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
