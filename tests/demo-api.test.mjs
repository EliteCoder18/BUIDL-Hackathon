import assert from "node:assert/strict";
import test from "node:test";

import { createApi } from "../services/api/app.mjs";
import { createDemoSaga } from "../services/demo/demo-saga.mjs";
import { createLocalChainRuntime } from "../services/local-chain/runtime.mjs";

async function requestJson(api, method, pathname, body) {
  const response = await api.handle(new Request(`http://local${pathname}`, {
    method,
    headers: { "content-type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body),
  }));
  return { response, body: await response.json() };
}

test("command API drives a mandate through successful cross-chain settlement", async (t) => {
  const runtime = await createLocalChainRuntime({ sepoliaPort: 0, creditcoinPort: 0 });
  t.after(() => runtime.close());
  const api = createApi({ saga: createDemoSaga(runtime) });

  const created = await requestJson(api, "POST", "/v1/jobs", {
    agentId: "0",
    amountIn: "100000000",
    minOut: "99000000",
    deadlineSeconds: 3600,
    coverageAmount: "100000000",
  });
  assert.equal(created.response.status, 200);
  assert.equal(created.body.events[0].type, "START_MANDATE");
  assert.match(created.body.data.jobKey, /^0x[0-9a-f]{64}$/i);

  const jobKey = created.body.data.jobKey;
  const auction = await requestJson(api, "POST", `/v1/jobs/${jobKey}/open-auction`, {});
  assert.equal(auction.body.data.quotes.length, 3);
  assert.match(auction.body.data.quotes[1].signature, /^0x[0-9a-f]{130}$/i);

  const accepted = await requestJson(api, "POST", "/v1/policies", { jobKey, quoteIndex: 1 });
  assert.equal(accepted.body.events.at(-1).type, "POLICY_LOCKED");
  const policyId = accepted.body.data.policyId;

  await requestJson(api, "POST", `/v1/jobs/${jobKey}/execute`, { outcome: "success" });
  const proof = await requestJson(api, "POST", "/v1/proofs", { jobKey });
  assert.equal(proof.body.data.proofSource, "local-attestcoin-simulation");
  const settled = await requestJson(api, "POST", `/v1/policies/${policyId}/settle`, {});
  assert.equal(settled.body.data.state, "SETTLED_SUCCESS");

  const policy = await requestJson(api, "GET", `/v1/policies/${policyId}`);
  const vault = await requestJson(api, "GET", "/v1/vault");
  const agents = await requestJson(api, "GET", "/v1/agents");
  assert.equal(policy.body.state, "SETTLED_SUCCESS");
  assert.equal(vault.body.reserved, "0");
  assert.equal(agents.body.agents.length, 2);
});

test("command API rejects malformed commands before invoking a saga", async () => {
  const api = createApi({ saga: { createJob() { throw new Error("must not execute"); } } });
  const invalidJob = await requestJson(api, "POST", "/v1/jobs", {
    agentId: "0",
    amountIn: "0",
    minOut: "99000000",
    deadlineSeconds: 3600,
    coverageAmount: "100000000",
  });
  assert.equal(invalidJob.response.status, 400);
  assert.equal(invalidJob.body.code, "INVALID_AMOUNT");

  const invalidOutcome = await requestJson(api, "POST", `/v1/jobs/0x${"11".repeat(32)}/execute`, { outcome: "corrupt" });
  assert.equal(invalidOutcome.response.status, 400);
  assert.equal(invalidOutcome.body.code, "INVALID_OUTCOME");
});
