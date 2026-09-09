import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { parse } from "yaml";

import { runVerification } from "../scripts/verify-deployment.mjs";

test("deployment verification stops immediately when a required check fails", async () => {
  const executed = [];
  await assert.rejects(runVerification({
    run: async (command) => {
      executed.push(command.label);
      if (command.label === "root tests") throw new Error("test failure");
    },
    commands: [
      { label: "manifests", command: "npm", args: ["run", "validate:deployment"] },
      { label: "root tests", command: "npm", args: ["test"] },
      { label: "web build", command: "npm", args: ["run", "build"] },
    ],
  }), /test failure/);
  assert.deepEqual(executed, ["manifests", "root tests"]);
});

test("CI runs semantic deployment checks and gates the browser transaction dry run", async () => {
  const workflow = parse(await readFile(path.resolve(".github/workflows/ci.yml"), "utf8"));
  assert.ok(workflow.jobs.core);
  assert.ok(workflow.jobs.web);
  assert.ok(workflow.jobs.risk);
  assert.ok(workflow.jobs.deployment);
  assert.deepEqual(workflow.jobs["transaction-dry-run"].needs.sort(), ["core", "deployment", "risk", "web"]);
  const dryRunCommands = workflow.jobs["transaction-dry-run"].steps
    .filter((step) => step.run)
    .map((step) => step.run);
  assert.ok(dryRunCommands.includes("npm run dry-run:local"));
});
