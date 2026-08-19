"""Advisory risk service. Quote amount is still bounded and signed by underwriters."""
from hashlib import sha256
from fastapi import FastAPI
from pydantic import BaseModel, Field
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import HistGradientBoostingClassifier
import numpy as np

FEATURES = ("failure_rate", "mean_slippage_bps", "mean_lateness_bps", "amount_vs_p95_bps", "deadline_tightness_bps", "volatility_bps")
MODEL_VERSION = "trustfutures-risk-v1-fixed-seed"
rng = np.random.default_rng(8004)
X = np.column_stack((rng.uniform(0, 0.6, 320), rng.uniform(0, 800, 320), rng.uniform(0, 800, 320), rng.uniform(7000, 25000, 320), rng.uniform(0, 1000, 320), rng.uniform(0, 1000, 320)))
y = ((X[:, 0] * 1.4 + X[:, 1] / 3000 + X[:, 2] / 4500 + X[:, 4] / 4000 + X[:, 5] / 3500) > 0.48).astype(int)
model = CalibratedClassifierCV(HistGradientBoostingClassifier(max_depth=3, random_state=8004), method="sigmoid", cv=3).fit(X, y)
MODEL_HASH = "0x" + sha256((MODEL_VERSION + repr(X.tolist())).encode()).hexdigest()
app = FastAPI(title="TrustFutures risk service")

class Features(BaseModel):
    failure_rate: float = Field(ge=0, le=1)
    mean_slippage_bps: float = Field(ge=0, le=10000)
    mean_lateness_bps: float = Field(ge=0, le=10000)
    amount_vs_p95_bps: float = Field(ge=0, le=100000)
    deadline_tightness_bps: float = Field(ge=0, le=10000)
    volatility_bps: float = Field(ge=0, le=10000)

@app.post("/v1/risk")
def risk(features: Features):
    vector = np.array([[getattr(features, key) for key in FEATURES]])
    probability = float(model.predict_proba(vector)[0, 1])
    # Bounded, explainable indication only. Policy pricing remains deterministic TS + EIP-712 signature.
    return {"failureProbabilityBps": min(9500, max(100, round(probability * 10000))), "modelVersion": MODEL_VERSION, "modelHash": MODEL_HASH, "featureOrder": FEATURES}
