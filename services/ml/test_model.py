from model import FEATURES, MODEL_HASH, MODEL_VERSION, score_risk


STRONG_FEATURES = {
    "failure_rate": 0.02,
    "mean_slippage_bps": 18.0,
    "mean_lateness_bps": 35.0,
    "amount_vs_p95_bps": 9_200.0,
    "deadline_tightness_bps": 20.0,
    "volatility_bps": 280.0,
}

OUT_OF_DISTRIBUTION_FEATURES = {
    "failure_rate": 1.0,
    "mean_slippage_bps": 10_000.0,
    "mean_lateness_bps": 10_000.0,
    "amount_vs_p95_bps": 100_000.0,
    "deadline_tightness_bps": 10_000.0,
    "volatility_bps": 10_000.0,
}


def test_score_is_deterministic_and_exposes_named_nonzero_shap_values():
    first = score_risk(STRONG_FEATURES)
    second = score_risk(STRONG_FEATURES)

    assert first == second
    assert first["modelVersion"] == MODEL_VERSION
    assert first["modelHash"] == MODEL_HASH
    assert [item["name"] for item in first["features"]] == list(FEATURES)
    assert any(abs(item["shapValue"]) > 0 for item in first["features"])
    assert 100 <= first["failureProbabilityBps"] <= 9500
    assert first["abstain"] is False


def test_out_of_distribution_features_force_underwriter_abstention():
    result = score_risk(OUT_OF_DISTRIBUTION_FEATURES)

    assert result["abstain"] is True
    assert result["confidence"] < 0.5


def test_strong_attested_history_is_not_near_certain_failure():
    result = score_risk({
        "failure_rate": 0.1,
        "mean_slippage_bps": 24,
        "mean_lateness_bps": 42,
        "amount_vs_p95_bps": 9_400,
        "deadline_tightness_bps": 280,
        "volatility_bps": 300,
    })
    assert result["failureProbabilityBps"] < 3_000


def test_score_discloses_data_lineage_and_abstains_for_unseen_category():
    result = score_risk({
        **STRONG_FEATURES,
        "agent_id": "agent-00",
        "mandate_category": "unseen-category",
        "coverage_size": 100_000,
        "live_outcome_count": 4,
    })

    assert result["trainingData"] == "fixed-seed synthetic"
    assert result["calibrationMethod"]
    assert result["dataLineage"]["datasetHash"].startswith("sha256:")
    assert result["abstain"] is True
    assert "unseen-mandate-category" in result["diagnostics"]["abstentionReasons"]
