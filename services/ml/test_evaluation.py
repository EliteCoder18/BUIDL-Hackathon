from evaluation import build_evaluation, split_agents


def _row(agent_id, outcome):
    return {"agentId": agent_id, "outcome": outcome, "mandateCategory": "swap", "coverageSize": 100_000,
            "deadline": 600, "expectedOutput": 100_000, "actualOutput": 99_000, "slippageBps": 100,
            "completionLatencySeconds": 30, "simulatedVolatilityBps": 250}


def test_agent_partitions_are_disjoint():
    splits = split_agents([_row(str(index), "success" if index % 2 else "violation") for index in range(18)])
    assert not (set(splits["train"]) & set(splits["validation"]))
    assert not (set(splits["train"]) & set(splits["test"]))
    assert not (set(splits["validation"]) & set(splits["test"]))


def test_one_class_validation_uses_explicit_uncalibrated_fallback():
    records = [_row(str(index), "success" if index < 12 else "violation") for index in range(18)]
    result = build_evaluation(records)
    assert result.calibration_method == "not-applied-insufficient-validation-classes"
    assert "insufficient-validation-classes" in result.warnings
