"""Agent-disjoint feature derivation and held-out metrics."""
from dataclasses import dataclass
import numpy as np
from sklearn.metrics import brier_score_loss, roc_auc_score
FEATURES=("failure_rate","mean_slippage_bps","mean_lateness_bps","amount_vs_p95_bps","deadline_tightness_bps","volatility_bps")
@dataclass(frozen=True)
class EvaluationBundle: calibration_method:str; warnings:list[str]; metrics:dict
def split_agents(records):
 agents=sorted({r["agentId"] for r in records}); v=tuple(agents[:max(1,len(agents)//5)]); t=tuple(agents[max(1,len(agents)//5):max(2,len(agents)*2//5)]); return {"train":tuple(a for a in agents if a not in set(v)|set(t)),"validation":v,"test":t}
def matrix_and_labels(records):
 histories={}; rows=sorted(records,key=lambda r:r.get("eventId",r["agentId"])); vectors=[]
 for r in rows:
  h=histories.setdefault(r["agentId"],[]); p95=np.percentile([x["coverageSize"] for x in h] or [r["coverageSize"]],95); failures=sum(x["outcome"]!="success" for x in h)
  deadline_tightness_bps=min(10000,1_000_000//max(1,r["deadline"]))
  vectors.append([failures/len(h) if h else 0,r["slippageBps"],max(0,(r["expectedOutput"]-r["actualOutput"])*10000/max(1,r["expectedOutput"])),r["coverageSize"]*10000/max(1,p95),deadline_tightness_bps,r["simulatedVolatilityBps"]]);h.append(r)
 return np.asarray(vectors,float),np.asarray([r["outcome"]!="success" for r in rows],int)
def metrics_from_predictions(y,p):
 buckets=[]
 for i in range(5):
  lo,hi=i/5,(i+1)/5; mask=(p>=lo)&(p<(hi if i<4 else hi+.00001));buckets.append({"lower":lo,"upper":hi,"count":int(mask.sum()),"meanPrediction":float(p[mask].mean()) if mask.any() else None,"observedFailureRate":float(y[mask].mean()) if mask.any() else None})
 return {"brierScore":round(float(brier_score_loss(y,p)),8),"rocAuc":round(float(roc_auc_score(y,p)),8) if len(set(y))==2 else None,"reliability":buckets}
def build_evaluation(records,predicted=None):
 s=split_agents(records);test=[r for r in records if r["agentId"] in s["test"]];_,y=matrix_and_labels(test);valid={r["outcome"]!="success" for r in records if r["agentId"] in s["validation"]};method="isotonic" if len(valid)==2 else "not-applied-insufficient-validation-classes";return EvaluationBundle(method,[] if method=="isotonic" else ["insufficient-validation-classes"],metrics_from_predictions(y,np.full(len(y),.5) if predicted is None else predicted))
