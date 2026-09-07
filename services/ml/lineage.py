"""Canonical, runtime-pinned model provenance."""
import json
import platform
from hashlib import sha256
import numpy as np
import sklearn


def model_hash(*, model_bytes, manifest_hash, splits, features, seed, hyperparameters):
    evidence = {"python": platform.python_version(), "numpy": np.__version__, "scikitLearn": sklearn.__version__,
                "manifestHash": manifest_hash, "splits": splits, "features": list(features), "seed": seed,
                "hyperparameters": hyperparameters}
    return "0x" + sha256(json.dumps(evidence, sort_keys=True, separators=(",", ":")).encode() + model_bytes).hexdigest()
