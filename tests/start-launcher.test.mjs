import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const launcher = path.join(root, "start");

async function waitForFile(file, timeoutMs = 3_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      return await readFile(file, "utf8");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  throw new Error(`timed out waiting for ${file}`);
}

test("root launcher execs npm and forwards SIGINT without an orphan", async () => {
  await access(launcher, constants.X_OK);
  const directory = await mkdtemp(path.join(tmpdir(), "trustfutures-start-"));
  const fakeNpm = path.join(directory, "npm");
  const pidFile = path.join(directory, "pid");
  const signalFile = path.join(directory, "signal");
  await writeFile(fakeNpm, `#!/usr/bin/env bash
set -u
printf '%s' "$$" > "$START_TEST_PID_FILE"
trap 'printf INT > "$START_TEST_SIGNAL_FILE"; exit 0' INT
trap 'printf TERM > "$START_TEST_SIGNAL_FILE"; exit 0' TERM
while :; do sleep 0.05; done
`);
  await chmod(fakeNpm, 0o755);

  const child = spawn(launcher, [], {
    cwd: directory,
    env: {
      ...process.env,
      PATH: `${directory}:${process.env.PATH ?? ""}`,
      START_TEST_PID_FILE: pidFile,
      START_TEST_SIGNAL_FILE: signalFile,
    },
    stdio: "ignore",
  });

  try {
    const observedPid = Number(await waitForFile(pidFile));
    assert.equal(observedPid, child.pid, "launcher must exec npm instead of leaving a wrapper process");
    assert.equal(child.kill("SIGINT"), true);
    const [code, signal] = await once(child, "exit");
    assert.equal(code, 0);
    assert.equal(signal, null);
    assert.equal(await readFile(signalFile, "utf8"), "INT");
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    await rm(directory, { recursive: true, force: true });
  }
});
