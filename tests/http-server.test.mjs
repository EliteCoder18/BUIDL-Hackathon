import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import test from "node:test";

test("oversized HTTP requests return 413 without taking the API offline", { timeout: 15000 }, async () => {
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const child = spawn(process.execPath, ["services/api/server.mjs"], {
    env: { ...process.env, PORT: String(port), TRUSTFUTURES_DEMO: "false", DATABASE_URL: "", CREDITCOIN_CHAIN_ID: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const exited = once(child, "exit");
  try {
    await new Promise((resolve, reject) => {
      child.stdout.on("data", (data) => { if (data.toString().includes("API listening")) resolve(); });
      child.once("error", reject);
      child.once("exit", () => reject(new Error("API exited before startup")));
    });
    const result = await fetch(`http://127.0.0.1:${port}/v1/proofs`, {
      method: "POST", body: "x".repeat(1_000_001), signal: AbortSignal.timeout(5000),
    }).catch(() => null);
    assert.equal(result?.status, 413, "oversized input must receive an HTTP error instead of crashing the process");
    const health = await fetch(`http://127.0.0.1:${port}/healthz`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ok, true);
  } finally {
    child.kill("SIGTERM");
    await exited;
  }
});
