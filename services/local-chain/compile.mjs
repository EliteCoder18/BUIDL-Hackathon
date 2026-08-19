import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const CONTRACT_ROOT = path.resolve("contracts/src");
let cache;

function collectSolidity(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSolidity(target);
    return target.endsWith(".sol") ? [target] : [];
  });
}

export function compileLocalContracts() {
  if (cache) return cache;
  const sources = Object.fromEntries(collectSolidity(CONTRACT_ROOT).map((file) => [
    path.relative(CONTRACT_ROOT, file),
    { content: fs.readFileSync(file, "utf8") },
  ]));
  sources["@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol"] = {
    content: fs.readFileSync("node_modules/@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol", "utf8"),
  };
  const result = JSON.parse(solc.compile(JSON.stringify({
    language: "Solidity",
    sources,
    settings: {
      evmVersion: "shanghai",
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  })));
  const errors = (result.errors ?? []).filter((entry) => entry.severity === "error");
  if (errors.length) throw new Error(errors.map((entry) => entry.formattedMessage).join("\n"));
  cache = result.contracts;
  return cache;
}

export function localArtifact(file, contract) {
  const artifact = compileLocalContracts()[file]?.[contract];
  if (!artifact) throw new Error(`Missing contract artifact ${file}:${contract}`);
  return { abi: artifact.abi, bytecode: `0x${artifact.evm.bytecode.object}` };
}
