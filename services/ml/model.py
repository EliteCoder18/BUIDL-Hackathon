"""Dataset-trained, agent-disjoint risk model."""
import json,pickle
from hashlib import sha256
from pathlib import Path
import numpy as np,shap
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import GradientBoostingClassifier
from data.generate_dataset import DATASET_NAME
from evaluation import FEATURES,split_agents,matrix_and_labels,metrics_from_predictions,EvaluationBundle
from lineage import model_hash
MODEL_VERSION,SEED="trustfutures-gbm-v1",8004;HYPERPARAMETERS={"max_depth":3,"random_state":SEED};DATA_FILE=Path(__file__).parent/"data"/DATASET_NAME
def build_model(records,payload=None):
 s=split_agents(records);rows=sorted(records,key=lambda r:r["eventId"]);X,y=matrix_and_labels(rows);agents=np.array([r["agentId"] for r in rows]);tr,va,te=(np.isin(agents,s[k]) for k in ("train","validation","test"));base=GradientBoostingClassifier(**HYPERPARAMETERS).fit(X[tr],y[tr]);classes=set(y[va]);method="isotonic" if len(classes)==2 else "not-applied-insufficient-validation-classes";model=CalibratedClassifierCV(base,method="isotonic",cv="prefit").fit(X[va],y[va]) if method=="isotonic" else base;p=np.clip(model.predict_proba(X[te])[:,1],.01,.95);raw=DATA_FILE.read_bytes() if payload is None else payload;return {"model":model,"base":base,"splits":s,"X":X,"agents":agents,"minimum":X[tr].min(0),"maximum":X[tr].max(0),"hash":model_hash(model_bytes=pickle.dumps(model),manifest_hash=sha256(raw).hexdigest(),splits=s,features=FEATURES,seed=SEED,hyperparameters=HYPERPARAMETERS),"datasetHash":sha256(raw).hexdigest(),"evaluation":EvaluationBundle(method,[] if method=="isotonic" else ["insufficient-validation-classes"],metrics_from_predictions(y[te],p)),"categories":{r["mandateCategory"] for r in rows},"knownAgents":set(agents)}
RECORDS=[json.loads(x) for x in DATA_FILE.read_text().splitlines()];BUNDLE=build_model(RECORDS);MODEL_HASH=BUNDLE["hash"];EVALUATION=BUNDLE["evaluation"];SPLITS=BUNDLE["splits"];KNOWN_AGENTS=BUNDLE["knownAgents"];KNOWN_CATEGORIES=BUNDLE["categories"];_explainer=shap.TreeExplainer(BUNDLE["base"])
def score_risk(f):
 v=np.asarray([float(f[n]) for n in FEATURES]);span=np.maximum(BUNDLE["maximum"]-BUNDLE["minimum"],1e-9);drift=float(np.max(np.maximum(BUNDLE["minimum"]-v,0)/span+np.maximum(v-BUNDLE["maximum"],0)/span));reasons=[]
 if f.get("agent_id","agent-00") not in KNOWN_AGENTS: reasons.append("unknown-agent")
 if f.get("mandate_category","swap") not in KNOWN_CATEGORIES: reasons.append("unseen-mandate-category")
 if f.get("attested_event_valid") is False: reasons.append("invalid-or-stale-attested-event")
 if float(f.get("coverage_size",0))>max(r["coverageSize"] for r in RECORDS)*1.25: reasons.append("coverage-above-training-range")
 if drift>.5: reasons.append("numeric-feature-drift")
 confidence=round(max(.05,min(.98,.92/(1+drift*4))),6)
 if confidence<.5: reasons.append("insufficient-confidence")
 p=float(np.clip(BUNDLE["model"].predict_proba(v.reshape(1,-1))[0,1],.01,.95));live=int(f.get("live_outcome_count",0)) if f.get("attested_event_valid",False) else 0;sh=np.asarray(_explainer.shap_values(v.reshape(1,-1))).reshape(-1)
 return {"failureProbabilityBps":round(p*10000),"modelVersion":MODEL_VERSION,"modelHash":MODEL_HASH,"trainingData":"fixed-seed synthetic","liveFeatures":"attested on-chain outcomes" if live else "no attested outcomes available","calibrationMethod":EVALUATION.calibration_method,"probabilityBoundsBps":{"min":100,"max":9500},"dataLineage":{"datasetVersion":"synthetic-mandates-v1","datasetHash":f"sha256:{BUNDLE['datasetHash']}","liveOutcomeCount":live},"diagnostics":{"confidence":confidence,"featureDrift":round(drift,8),"outOfDistribution":bool(reasons),"abstentionReasons":reasons,"warnings":EVALUATION.warnings,"evaluation":EVALUATION.metrics},"features":[{"name":n,"value":float(x),"shapValue":float(z)} for n,x,z in zip(FEATURES,v,sh)],"confidence":confidence,"abstain":bool(reasons)}
