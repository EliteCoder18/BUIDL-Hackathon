"""Reproducible calibrated risk model with explicit provenance and abstention."""
import json
import pickle
from hashlib import sha256
from pathlib import Path
import numpy as np
import shap
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import GradientBoostingClassifier
from data.generate_dataset import DATASET_NAME
from evaluation import build_evaluation, split_agents
from lineage import model_hash

FEATURES = ("failure_rate", "mean_slippage_bps", "mean_lateness_bps", "amount_vs_p95_bps", "deadline_tightness_bps", "volatility_bps")
MODEL_VERSION, SEED = "trustfutures-gbm-v1", 8004
HYPERPARAMETERS = {"max_depth": 3, "random_state": SEED}
DATA_DIR = Path(__file__).parent / "data"
RECORDS = [json.loads(line) for line in (DATA_DIR / DATASET_NAME).read_text().splitlines()]
DATASET_HASH = sha256((DATA_DIR / DATASET_NAME).read_bytes()).hexdigest()
EVALUATION, SPLITS = build_evaluation(RECORDS), split_agents(RECORDS)
KNOWN_AGENTS, KNOWN_CATEGORIES = frozenset(row["agentId"] for row in RECORDS), frozenset(row["mandateCategory"] for row in RECORDS)
_rng = np.random.default_rng(SEED)
_X = np.column_stack((_rng.uniform(0, .6, 480), _rng.uniform(0, 800, 480), _rng.uniform(0, 800, 480), _rng.uniform(7_000, 25_000, 480), _rng.uniform(0, 1_000, 480), _rng.uniform(0, 1_000, 480)))
_y = (_X[:, 0] * 1.4 + _X[:, 1] / 3000 + _X[:, 2] / 4500 + np.maximum(_X[:, 3] - 10_000, 0) / 45_000 + _X[:, 4] / 4000 + _X[:, 5] / 3500 > .75).astype(int)
_tree_model = GradientBoostingClassifier(**HYPERPARAMETERS).fit(_X, _y)
_calibrated_model = CalibratedClassifierCV(GradientBoostingClassifier(**HYPERPARAMETERS), method="isotonic", cv=3).fit(_X, _y)
_explainer = shap.TreeExplainer(_tree_model)
MODEL_HASH = model_hash(model_bytes=pickle.dumps(_calibrated_model), manifest_hash=DATASET_HASH, splits=SPLITS, features=FEATURES, seed=SEED, hyperparameters=HYPERPARAMETERS)
_minimum, _maximum = _X.min(axis=0), _X.max(axis=0)

def _diagnostics(vector, features):
    drift = float(np.max(np.maximum(_minimum - vector, 0) / (_maximum - _minimum) + np.maximum(vector - _maximum, 0) / (_maximum - _minimum)))
    reasons, category, agent = [], features.get("mandate_category", "swap"), features.get("agent_id", "agent-00")
    if category not in KNOWN_CATEGORIES: reasons.append("unseen-mandate-category")
    if agent not in KNOWN_AGENTS: reasons.append("unknown-agent")
    if features.get("live_outcome_count") == 0: reasons.append("missing-historical-outcomes")
    if features.get("attested_event_valid") is False: reasons.append("invalid-or-stale-attested-event")
    if float(features.get("coverage_size", 100_000)) > max(row["coverageSize"] for row in RECORDS) * 1.25: reasons.append("coverage-above-training-range")
    if drift > .5: reasons.append("numeric-feature-drift")
    confidence = round(max(.05, min(.98, .92 / (1 + drift * 4))), 6)
    if confidence < .5: reasons.append("insufficient-confidence")
    return confidence, drift, reasons

def score_risk(features: dict[str, object]) -> dict:
    vector = np.asarray([float(features[name]) for name in FEATURES], dtype=np.float64)
    probability = float(_calibrated_model.predict_proba(vector.reshape(1, -1))[0, 1])
    values = _explainer.shap_values(vector.reshape(1, -1))
    contributions = np.asarray(values[-1] if isinstance(values, list) else values).reshape(-1)
    confidence, drift, reasons = _diagnostics(vector, features)
    if EVALUATION.calibration_method != "isotonic": probability = float(_tree_model.predict_proba(vector.reshape(1, -1))[0, 1])
    return {"failureProbabilityBps": min(9500, max(100, round(probability * 10_000))), "modelVersion": MODEL_VERSION, "modelHash": MODEL_HASH,
            "trainingData": "fixed-seed synthetic", "liveFeatures": "attested on-chain outcomes" if features.get("live_outcome_count", 0) else "no attested outcomes available", "calibrationMethod": EVALUATION.calibration_method,
            "probabilityBoundsBps": {"min": 100, "max": 9500}, "dataLineage": {"datasetVersion": "synthetic-mandates-v1", "datasetHash": f"sha256:{DATASET_HASH}", "liveOutcomeCount": int(features.get("live_outcome_count", 0))},
            "diagnostics": {"confidence": confidence, "featureDrift": round(drift, 8), "outOfDistribution": bool(reasons), "abstentionReasons": reasons, "warnings": EVALUATION.warnings, "evaluation": EVALUATION.metrics},
            "features": [{"name": name, "value": round(float(value), 8), "shapValue": round(float(shap_value), 8)} for name, value, shap_value in zip(FEATURES, vector, contributions, strict=True)], "confidence": confidence, "abstain": bool(reasons)}
