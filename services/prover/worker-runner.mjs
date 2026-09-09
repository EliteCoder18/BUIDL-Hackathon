import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateWorkerEnvironment } from "../deployment/config.mjs";
import { PostgresProofQueue } from "./postgres-proof-queue.mjs";

function sanitizedError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/([a-z][a-z0-9+.-]*:\/\/)[^@\s]+@/gi, "$1[redacted]@").slice(0, 500);
}

function retryDelayMs(attemptCount) {
  return Math.min(60_000 * (2 ** Math.max(0, attemptCount - 1)), 15 * 60_000);
}

export function createProofWorkerRunner({
  queue,
  proveAndSubmit,
  config,
  pollIntervalMs = config.pollIntervalMs,
  logger = console,
  now = () => new Date(),
}) {
  let stopped = false;
  let wake = null;

  async function runOnce() {
    if (stopped) return null;
    const job = await queue.claimNext({ maxAttempts: config.maxAttempts });
    if (!job) return null;
    logger.info(JSON.stringify({ service: "proof-worker", event: "claimed", jobKey: job.jobKey, attempt: job.attemptCount }));
    try {
      const creditcoinTxHash = await proveAndSubmit(job.sourceTxHash, config);
      await queue.transition(job.jobKey, "submitted", { creditcoinTxHash });
      const confirmed = await queue.transition(job.jobKey, "confirmed", { creditcoinTxHash });
      logger.info(JSON.stringify({ service: "proof-worker", event: "confirmed", jobKey: job.jobKey, creditcoinTxHash }));
      return confirmed;
    } catch (error) {
      const message = sanitizedError(error);
      const nextAttemptAt = job.attemptCount < config.maxAttempts
        ? new Date(now().getTime() + retryDelayMs(job.attemptCount))
        : null;
      const failed = await queue.transition(job.jobKey, "failed", { error: message, nextAttemptAt });
      logger.error(JSON.stringify({ service: "proof-worker", event: "failed", jobKey: job.jobKey, attempt: job.attemptCount, retrying: Boolean(nextAttemptAt), error: message }));
      return failed;
    }
  }

  async function start() {
    while (!stopped) {
      await runOnce();
      if (stopped) break;
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, pollIntervalMs);
        wake = () => {
          clearTimeout(timer);
          resolve();
        };
      });
      wake = null;
    }
  }

  async function stop() {
    if (stopped) return;
    stopped = true;
    wake?.();
    await queue.close();
  }

  return { runOnce, start, stop };
}

async function main() {
  const config = validateWorkerEnvironment(process.env);
  const queue = new PostgresProofQueue(config.databaseUrl);
  await queue.migrate();
  const { proveAndSubmit } = await import("./attestcoin-worker.ts");
  const runner = createProofWorkerRunner({ queue, proveAndSubmit, config });
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await runner.stop();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  await runner.start();
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(JSON.stringify({ service: "proof-worker", event: "fatal", error: sanitizedError(error) }));
    process.exitCode = 1;
  });
}
