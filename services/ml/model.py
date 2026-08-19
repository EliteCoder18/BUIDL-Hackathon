"""Deterministic calibrated risk model with tree SHAP attribution."""

from hashlib import sha256

import numpy as np
import shap
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import GradientBoostingClassifier


FEATURES = (
    "failure_rate",
    "mean_slippage_bps",
    "mean_lateness_bps",
    "amount_vs_p95_bps",
    "deadline_tightness_bps",
    "volatility_bps",
)
MODEL_VERSION = "trustfutures-risk-v2-shap-fixed-seed"

_rng = np.random.default_rng(8004)
_X = np.column_stack((
    _rng.uniform(0.0, 0.60, 480),
    _rng.uniform(0.0, 800.0, 480),
    _rng.uniform(0.0, 800.0, 480),
    _rng.uniform(7_000.0, 25_000.0, 480),
    _rng.uniform(0.0, 1_000.0, 480),
    _rng.uniform(0.0, 1_000.0, 480),
))
_signal = (
    _X[:, 0] * 1.40
    + _X[:, 1] / 3_000.0
    + _X[:, 2] / 4_500.0
    + np.maximum(_X[:, 3] - 10_000.0, 0.0) / 45_000.0
    + _X[:, 4] / 4_000.0
    + _X[:, 5] / 3_500.0
)
_y = (_signal > 0.48).astype(int)

_tree_model = GradientBoostingClassifier(max_depth=3, random_state=8004).fit(_X, _y)
_calibrated_model = CalibratedClassifierCV(
    GradientBoostingClassifier(max_depth=3, random_state=8004),
    method="sigmoid",
    cv=3,
).fit(_X, _y)
_explainer = shap.TreeExplainer(_tree_model)
MODEL_HASH = "0x" + sha256(
    MODEL_VERSION.encode() + "|".join(FEATURES).encode() + _X.tobytes() + _y.tobytes()
).hexdigest()
_minimum = _X.min(axis=0)
_maximum = _X.max(axis=0)
_span = _maximum - _minimum


def _confidence(vector: np.ndarray) -> float:
    below = np.maximum(_minimum - vector, 0.0) / _span
    above = np.maximum(vector - _maximum, 0.0) / _span
    excess = float(np.max(below + above))
    return round(max(0.05, min(0.98, 0.92 / (1.0 + excess * 4.0))), 6)


def score_risk(features: dict[str, float]) -> dict:
    vector = np.asarray([float(features[name]) for name in FEATURES], dtype=np.float64)
    probability = float(_calibrated_model.predict_proba(vector.reshape(1, -1))[0, 1])
    shap_values = _explainer.shap_values(vector.reshape(1, -1))
    if isinstance(shap_values, list):
        shap_values = shap_values[-1]
    contributions = np.asarray(shap_values).reshape(-1)
    confidence = _confidence(vector)
    return {
        "failureProbabilityBps": min(9_500, max(100, round(probability * 10_000))),
        "modelVersion": MODEL_VERSION,
        "modelHash": MODEL_HASH,
        "features": [
            {"name": name, "value": round(float(value), 8), "shapValue": round(float(shap_value), 8)}
            for name, value, shap_value in zip(FEATURES, vector, contributions, strict=True)
        ],
        "confidence": confidence,
        "abstain": confidence < 0.5,
    }
