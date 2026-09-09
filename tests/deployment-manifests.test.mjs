import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { validateDeploymentFiles } from "../scripts/validate-deployment.mjs";

test("repository deployment manifests expose healthy API, worker, risk, and Next.js services", async () => {
  const result = await validateDeploymentFiles(path.resolve("."));
  assert.deepEqual(result.renderServices, [
    "trustfutures-api",
    "trustfutures-proof-worker",
    "trustfutures-risk",
  ]);
  assert.equal(result.vercelFramework, "nextjs");
});

test("deployment validation rejects secret values embedded in a Render blueprint", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "trustfutures-deploy-"));
  await writeFile(path.join(root, "render.yaml"), JSON.stringify({ services: [{
    type: "web",
    name: "trustfutures-api",
    runtime: "node",
    buildCommand: "npm ci",
    startCommand: "npm run api",
    healthCheckPath: "/healthz",
    envVars: [{ key: "DATABASE_URL", value: "postgresql://admin:secret@example.test/db" }],
  }] }));
  await writeFile(path.join(root, "vercel.json"), JSON.stringify({ framework: "nextjs" }));

  await assert.rejects(validateDeploymentFiles(root), /embedded secret|proof-worker|risk/);
});
