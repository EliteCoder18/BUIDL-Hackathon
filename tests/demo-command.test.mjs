import assert from "node:assert/strict";
import test from "node:test";

import { buildDemoProcesses } from "../scripts/demo.mjs";

test("demo command starts authoritative API and web with embedded mode enabled", () => {
  const processes = buildDemoProcesses({ hasPythonRuntime: false });
  assert.equal(processes[0].name, "api");
  assert.equal(processes[0].env.TRUSTFUTURES_DEMO, "true");
  assert.ok(processes.some(({ name }) => name === "web"));
  assert.ok(!processes.some(({ name }) => name === "risk"));
});

test("demo command includes the calibrated risk service when the local runtime exists", () => {
  assert.ok(buildDemoProcesses({ hasPythonRuntime: true }).some(({ name }) => name === "risk"));
});
