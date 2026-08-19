import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const root = path.resolve("contracts/src");

function collectSolidityFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectSolidityFiles(fullPath) : [fullPath];
  }).filter((file) => file.endsWith(".sol"));
}

test("TrustFutures Solidity contracts compile and expose source and settlement contracts", () => {
  const files = collectSolidityFiles(root);
  const sources = Object.fromEntries(files.map((file) => [
    path.relative(root, file),
    { content: fs.readFileSync(file, "utf8") },
  ]));
  const decoderPath = path.resolve("node_modules/@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol");
  sources["@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol"] = { content: fs.readFileSync(decoderPath, "utf8") };
  const result = JSON.parse(solc.compile(JSON.stringify({
    language: "Solidity",
    sources,
    settings: { outputSelection: { "*": { "*": ["abi"] } } },
  })));

  const errors = (result.errors ?? []).filter((error) => error.severity === "error");
  assert.deepEqual(errors, []);
  assert.ok(result.contracts["TreasuryJobManager.sol"].TreasuryJobManager);
  assert.ok(result.contracts["PolicyManager.sol"].PolicyManager);
  assert.ok(result.contracts["CoverageVault.sol"].CoverageVault);
});
