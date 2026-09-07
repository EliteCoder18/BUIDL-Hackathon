"""Generate the committed fixed-seed synthetic mandate dataset."""
import argparse
import json
from hashlib import sha256
from pathlib import Path

import numpy as np

DATASET_NAME = "synthetic-mandates-v1.jsonl"
MANIFEST_NAME = "synthetic-mandates-v1.manifest.json"
DATASET_SEED = 8004
GENERATION_VERSION = "synthetic-mandates-generator-v1"
CATEGORIES = ("swap", "rebalance", "payment")


def _record(rng, agent_index, mandate_index):
    category = CATEGORIES[(agent_index + mandate_index) % len(CATEGORIES)]
    coverage = int(rng.integers(50_000, 240_001))
    deadline = int(rng.integers(180, 3_601))
    volatility = int(rng.integers(40, 900))
    slippage = int(rng.integers(0, 850))
    latency = int(rng.integers(15, deadline + 1))
    pressure = slippage / 850 + latency / deadline + volatility / 1_500 + (agent_index % 6) / 7
    outcome = "violation" if pressure > 1.45 else "success"
    expected = coverage * 10
    actual = expected - expected * slippage // 10_000 if outcome == "success" else expected * 90 // 100
    return {
        "eventId": f"synthetic-{agent_index:02d}-{mandate_index:03d}", "agentId": f"agent-{agent_index:02d}",
        "mandateCategory": category, "coverageSize": coverage, "deadline": deadline,
        "expectedOutput": expected, "actualOutput": actual, "slippageBps": slippage,
        "completionLatencySeconds": latency, "outcome": outcome, "simulatedVolatilityBps": volatility,
        "datasetSeed": DATASET_SEED, "generationVersion": GENERATION_VERSION, "dataSource": "fixed-seed-synthetic",
    }


def generate_dataset(output_dir: Path) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(DATASET_SEED)
    rows = [_record(rng, agent, mandate) for agent in range(24) for mandate in range(20)]
    payload = "".join(json.dumps(row, sort_keys=True, separators=(",", ":")) + "\n" for row in rows).encode()
    digest = sha256(payload).hexdigest()
    manifest = {"datasetVersion": "synthetic-mandates-v1", "seed": DATASET_SEED, "generationVersion": GENERATION_VERSION,
                "rowCount": len(rows), "sha256": digest, "generationCommand": "python data/generate_dataset.py"}
    (output_dir / DATASET_NAME).write_bytes(payload)
    (output_dir / MANIFEST_NAME).write_text(json.dumps(manifest, sort_keys=True, indent=2) + "\n")
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    target = Path(__file__).parent
    manifest = generate_dataset(target)
    if args.check and sha256((target / DATASET_NAME).read_bytes()).hexdigest() != manifest["sha256"]:
        raise SystemExit("dataset hash mismatch")
    print(json.dumps(manifest, indent=2))
