import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { hostedEnvironment } from "../services/deployment/hosted-environment.mjs";

// One free Render service: public Node API plus loopback-only Python risk model.
const env = hostedEnvironment();
const children = [];
let stopping = false;
let killTimer;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill("SIGTERM");
  killTimer = setTimeout(() => {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }
  }, 10_000);
  killTimer.unref();
}

function launch(name, command, args) {
  const child = spawn(command, args, { env, stdio: "inherit" });
  children.push(child);
  child.on("error", () => {
    console.error(`[hosted] Could not start ${name}`);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) {
      console.error(`[hosted] ${name} exited unexpectedly (${code})`);
      stop(1);
    }
    if (children.every((entry) => entry.exitCode !== null || entry.signalCode !== null)) {
      clearTimeout(killTimer);
    }
  });
  return child;
}

process.once("SIGINT", () => stop());
process.once("SIGTERM", () => stop());

launch("risk", process.env.PYTHON_BIN || "python", [
  "-m", "uvicorn", "services.ml.app:app", "--host", "127.0.0.1", "--port", "8000",
]);

let ready = false;
for (let attempt = 0; attempt < 120 && !stopping; attempt++) {
  try {
    const response = await fetch(`${env.RISK_SERVICE_URL}/healthz`, { signal: AbortSignal.timeout(1000) });
    const health = await response.json();
    if (response.ok && health.ok && health.service === "trustfutures-risk") {
      ready = true;
      break;
    }
  } catch { /* The model is still loading. */ }
  await delay(1000);
}
if (!stopping) {
  if (ready) {
    console.log("[hosted] Risk model ready; starting public API");
    launch("api", process.execPath, ["services/api/server.mjs"]);
  } else {
    console.error("[hosted] Risk model startup timed out");
    stop(1);
  }
}
