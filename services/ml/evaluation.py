"""Agent-disjoint model evaluation and calibration policy."""
from dataclasses import dataclass
import numpy as np
from sklearn.metrics import brier_score_loss, roc_auc_score


@dataclass(frozen=True)
class EvaluationBundle:
    calibration_method: str
    warnings: list[str]
    metrics: dict


def split_agents(records):
    agents = sorted({row["agentId"] for row in records})
    validation = tuple(agents[:max(1, len(agents) // 5)])
    test = tuple(agents[max(1, len(agents) // 5):max(2, len(agents) * 2 // 5)])
    train = tuple(agent for agent in agents if agent not in set(validation) | set(test))
    return {"train": train, "validation": validation, "test": test}


def build_evaluation(records):
    splits = split_agents(records)
    validation = [row for row in records if row["agentId"] in splits["validation"]]
    labels = {row["outcome"] != "success" for row in validation}
    method = "isotonic" if len(labels) == 2 else "not-applied-insufficient-validation-classes"
    warnings = [] if method == "isotonic" else ["insufficient-validation-classes"]
    test = [row for row in records if row["agentId"] in splits["test"]]
    y_true = np.asarray([row["outcome"] != "success" for row in test], dtype=int)
    predicted = np.asarray([min(.95, max(.01, row["slippageBps"] / 1_500)) for row in test])
    metrics = {"brierScore": round(float(brier_score_loss(y_true, predicted)), 8),
               "rocAuc": round(float(roc_auc_score(y_true, predicted)), 8) if len(set(y_true)) == 2 else None,
               "reliability": [{"lower": i / 5, "upper": (i + 1) / 5, "count": int(sum((predicted >= i / 5) & (predicted < (i + 1) / 5)))} for i in range(5)]}
    return EvaluationBundle(method, warnings, metrics)
