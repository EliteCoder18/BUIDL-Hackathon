"""Advisory SHAP risk service. Signed underwriter quotes still control economics."""
from fastapi import FastAPI
from pydantic import BaseModel, Field

try:
    from .model import MODEL_HASH, MODEL_VERSION, score_risk
except ImportError:
    from model import MODEL_HASH, MODEL_VERSION, score_risk

app = FastAPI(title="TrustFutures risk service")

class Features(BaseModel):
    failure_rate: float = Field(ge=0, le=1)
    mean_slippage_bps: float = Field(ge=0, le=10000)
    mean_lateness_bps: float = Field(ge=0, le=10000)
    amount_vs_p95_bps: float = Field(ge=0, le=100000)
    deadline_tightness_bps: float = Field(ge=0, le=10000)
    volatility_bps: float = Field(ge=0, le=10000)
    agent_id: str = "agent-00"
    mandate_category: str = "swap"
    coverage_size: float = Field(default=100_000, ge=0)
    live_outcome_count: int = Field(default=0, ge=0)
    attested_event_valid: bool = True

@app.post("/v1/risk")
def risk(features: Features):
    return score_risk(features.model_dump())


@app.get("/healthz")
def health():
    return {"ok": True, "service": "trustfutures-risk", "modelVersion": MODEL_VERSION, "modelHash": MODEL_HASH}
