import assert from "node:assert/strict";
import test from "node:test";
import { createActor } from "xstate";

import {
  ApiError,
  createTrustFuturesApi,
  type CreateJobInput,
} from "../lib/api/client";
import { crossChainOrchestrator } from "../lib/trustfutures/orchestrator";

const JOB_KEY = `0x${"11".repeat(32)}` as const;
const CREATE_JOB: CreateJobInput = {
  agentId: "0",
  amountIn: "100000000",
  minOut: "99000000",
  deadlineSeconds: 3600,
  coverageAmount: "100000000",
};

test("createJob preserves integer strings and advances the real orchestrator from command events", async () => {
  let observedRequest: { url: string; init?: RequestInit } | undefined;
  const actor = createActor(crossChainOrchestrator).start();
  const api = createTrustFuturesApi({
    fetch: async (input, init) => {
      observedRequest = { url: String(input), init };
      return Response.json({
        data: {
          jobKey: JOB_KEY,
          jobId: "7",
          agentId: "0",
          amountIn: "100000000",
          minOut: "99000000",
          coverageAmount: "100000000",
          deadline: "1787216400",
          state: "SEPOLIA_MANDATE_MINED",
          createTxHash: "0xmandate",
        },
        events: [
          { type: "START_MANDATE", jobKey: JOB_KEY, txHash: "0xmandate" },
          { type: "SEPOLIA_RECEIPT", txHash: "0xmandate" },
        ],
        transactions: [{ chain: "sepolia", hash: "0xmandate", blockNumber: 41 }],
      });
    },
    onEvents: (events) => events.forEach((event) => actor.send(event)),
  });

  const command = await api.createJob(CREATE_JOB);

  assert.equal(observedRequest?.url, "http://127.0.0.1:3001/v1/jobs");
  assert.deepEqual(JSON.parse(String(observedRequest?.init?.body)), CREATE_JOB);
  assert.equal(command.data.amountIn, "100000000");
  assert.equal(command.transactions[0].chain, "sepolia");
  assert.equal(actor.getSnapshot().value, "SEPOLIA_MANDATE_MINED");
  assert.equal(actor.getSnapshot().context.jobKey, JOB_KEY);
  actor.stop();
});

test("openAuction rejects malformed command events instead of corrupting orchestration state", async () => {
  const api = createTrustFuturesApi({
    fetch: async () => Response.json({
      data: { jobKey: JOB_KEY, quotes: [] },
      events: [{ type: "POLICY_LOCKED" }],
      transactions: [],
    }),
  });

  await assert.rejects(() => api.openAuction(JOB_KEY), /invalid POLICY_LOCKED event/i);
});

test("API errors expose HTTP status and backend domain code", async () => {
  const api = createTrustFuturesApi({
    fetch: async () => Response.json(
      { code: "WRONG_SAGA_STATE", error: "policy must be locked before execution" },
      { status: 400 },
    ),
  });

  await assert.rejects(
    () => api.executeJob(JOB_KEY, "success"),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 400);
      assert.equal(error.code, "WRONG_SAGA_STATE");
      return true;
    },
  );
});

test("read methods parse the API's plain resource responses", async () => {
  const api = createTrustFuturesApi({
    fetch: async () => Response.json({
      totalAssets: "800000000",
      reserved: "80000000",
      freeAssets: "720000000",
      totalShares: "800000000",
    }),
  });

  assert.deepEqual(await api.getVault(), {
    totalAssets: "800000000",
    reserved: "80000000",
    freeAssets: "720000000",
    totalShares: "800000000",
  });
});

test("public vault read uses the fast capital endpoint", async () => {
  let requestedUrl = "";
  const api = createTrustFuturesApi({
    fetch: async (input) => {
      requestedUrl = String(input);
      return Response.json({ totalAssets: "800000000", reserved: "80000000", freeAssets: "720000000", totalShares: "800000000" });
    },
  });

  assert.equal((await api.getLiveVault()).freeAssets, "720000000");
  assert.equal(requestedUrl, "http://127.0.0.1:3001/v1/live/vault");
});

test("public market reads validate and preserve wallet policy history", async () => {
  let requestedUrl = "";
  const wallet = `0x${"44".repeat(20)}` as const;
  const api = createTrustFuturesApi({
    fetch: async (input) => {
      requestedUrl = String(input);
      return Response.json({
        chainId: 102031,
        activePolicyCount: 1,
        confirmedProofCount: 2,
        vault: { totalAssets: "814270000", reserved: "80000000", freeAssets: "734270000", totalShares: "800000000" },
        policies: [{
          policyId: `0x${"aa".repeat(32)}`,
          jobKey: `0x${"bb".repeat(32)}`,
          client: wallet,
          underwriter: `0x${"66".repeat(20)}`,
          coverageAmount: "100000000",
          premiumAmount: "14270000",
          state: "ACTIVE",
          acceptedAt: "2026-09-12T10:40:00.000Z",
          lockTxHash: `0x${"01".repeat(32)}`,
        }],
      });
    },
  });

  const market = await api.getLiveMarket(wallet);

  assert.equal(requestedUrl, `http://127.0.0.1:3001/v1/live/market?client=${wallet}`);
  assert.equal(market.policies[0].state, "ACTIVE");
  assert.equal(market.policies[0].premiumAmount, "14270000");
});
