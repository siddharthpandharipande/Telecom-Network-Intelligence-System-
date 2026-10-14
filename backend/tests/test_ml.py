"""Comprehensive pytest suite for NEXUSNET ML offline layer.

Tests:
1. Feature engineering on known notebook values (row 0, row 1)
2. Peak hour boundary conditions (17, 18, 21, 22, 23)
3. Zero-user floor (prevent zero division)
4. Determinism of feature engineering
5. Config and model card integrity
6. Inference output schema (single-row and multi-row)
7. SLA threshold breach rule evaluation
8. Input validation (missing columns, non-numeric values)
9. Unseen / optional Asset_Type resilience
10. DBSCAN nearest-core scoring 100% agreement on training data
"""
from pathlib import Path
import numpy as np
import pandas as pd
import pytest
import joblib

from backend.ml.config import load_config
from backend.ml.features import engineer_features
from backend.ml.inference import (
    get_config,
    get_model_card,
    predict_svm,
    score_dbscan,
    threshold_breaches,
)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


@pytest.fixture
def sample_row0():
    return pd.DataFrame(
        [
            {
                "Asset_ID": "TEST-000",
                "Asset_Type": "Cell Tower",
                "Latency_ms": 101.79,
                "Packet_Loss_pct": 3.97,
                "Traffic_Load_pct": 53.73,
                "Resource_Utilization_pct": 66.61,
                "Call_Drop_Rate_pct": 2.97,
                "Signal_Strength_dBm": -98.02,
                "Throughput_Mbps": 69.47,
                "Connected_Users": 105,
                "Timestamp": "2026-09-16 17:00:00",
            }
        ]
    )


@pytest.fixture
def sample_row1():
    return pd.DataFrame(
        [
            {
                "Asset_ID": "TEST-001",
                "Asset_Type": "Base Station",
                "Latency_ms": 50.0,
                "Packet_Loss_pct": 2.36,
                "Traffic_Load_pct": 34.84,
                "Resource_Utilization_pct": 46.72,
                "Call_Drop_Rate_pct": 1.30,
                "Signal_Strength_dBm": -84.02,
                "Throughput_Mbps": 203.20,
                "Connected_Users": 366,
                "Timestamp": "2026-09-16 05:00:00",
            }
        ]
    )


def test_feature_engineering_known_row0(sample_row0):
    """Test feature calculations against known notebook row 0 ground truth."""
    out = engineer_features(sample_row0).iloc[0]

    # Network_Stress_Index: (53.73 + 66.61 + 3.97 + 2.97) / 4 = 31.820
    assert np.isclose(out["Network_Stress_Index"], 31.820, atol=1e-3)

    # Signal_Quality_Score: (-98.02 + 105) / 50 * 100 = 13.96
    assert np.isclose(out["Signal_Quality_Score"], 13.96, atol=1e-2)

    # Throughput_per_User: 69.47 / 105 = 0.661619...
    assert np.isclose(out["Throughput_per_User"], 0.661619, atol=1e-5)

    # Hour 17 is outside [18, 22]
    assert out["Hour"] == 17
    assert out["Peak_Hour"] == 0


def test_feature_engineering_known_row1(sample_row1):
    """Test feature calculations against known notebook row 1 ground truth."""
    out = engineer_features(sample_row1).iloc[0]

    # Network_Stress_Index: (34.84 + 46.72 + 2.36 + 1.30) / 4 = 21.305
    assert np.isclose(out["Network_Stress_Index"], 21.305, atol=1e-3)

    # Signal_Quality_Score: (-84.02 + 105) / 50 * 100 = 41.96
    assert np.isclose(out["Signal_Quality_Score"], 41.96, atol=1e-2)

    # Throughput_per_User: 203.20 / 366 = 0.555191...
    assert np.isclose(out["Throughput_per_User"], 0.555191, atol=1e-5)

    # Hour 5 is outside [18, 22]
    assert out["Hour"] == 5
    assert out["Peak_Hour"] == 0


def test_peak_hour_boundary_conditions():
    """Verify Peak_Hour is 1 for hours 18, 21, 22 and 0 for hours 17 and 23."""
    hours = [17, 18, 21, 22, 23]
    expected_peak = [0, 1, 1, 1, 0]

    records = []
    for h in hours:
        records.append(
            {
                "Latency_ms": 50.0,
                "Packet_Loss_pct": 1.0,
                "Traffic_Load_pct": 50.0,
                "Resource_Utilization_pct": 50.0,
                "Call_Drop_Rate_pct": 1.0,
                "Signal_Strength_dBm": -80.0,
                "Throughput_Mbps": 100.0,
                "Connected_Users": 100,
                "Timestamp": f"2026-09-16 {h:02d}:30:00",
            }
        )

    df = pd.DataFrame(records)
    out = engineer_features(df)
    assert list(out["Peak_Hour"]) == expected_peak


def test_zero_users_floor():
    """Verify zero connected users is floored at 1 without division by zero."""
    df = pd.DataFrame(
        [
            {
                "Latency_ms": 50.0,
                "Packet_Loss_pct": 1.0,
                "Traffic_Load_pct": 50.0,
                "Resource_Utilization_pct": 50.0,
                "Call_Drop_Rate_pct": 1.0,
                "Signal_Strength_dBm": -80.0,
                "Throughput_Mbps": 150.0,
                "Connected_Users": 0,
                "Timestamp": "2026-09-16 12:00:00",
            }
        ]
    )
    out = engineer_features(df).iloc[0]
    assert not np.isnan(out["Throughput_per_User"])
    assert not np.isinf(out["Throughput_per_User"])
    assert out["Throughput_per_User"] == 150.0


def test_feature_engineering_determinism(sample_row0):
    """Verify that calling engineer_features multiple times is purely deterministic."""
    run1 = engineer_features(sample_row0)
    run2 = engineer_features(sample_row0)
    pd.testing.assert_frame_equal(run1, run2)


def test_config_and_model_card_integrity():
    """Verify config.json and model_card.json load properly and match decisions."""
    config = get_config()
    assert config["version"] == "2.0.0"
    assert config["decision"]["shipped_variant"] == "legacy_policy"
    assert len(config["telemetry_columns"]) == 8
    assert len(config["svm_features"]["numeric"]) == 9

    card = get_model_card()
    assert "model_version" in card
    assert card["decision"]["shipped_variant"] == "legacy_policy"
    assert card["svm"]["test_metrics"]["f1"] > 0.95
    assert "limitations" in card
    assert len(card["limitations"]) == 5


def test_inference_single_and_multi_row(sample_row0):
    """Verify SVM and DBSCAN inference on single-row and multi-row DataFrames."""
    # Single row
    svm_res1 = predict_svm(sample_row0)
    assert isinstance(svm_res1, pd.DataFrame)
    assert len(svm_res1) == 1
    assert list(svm_res1.columns) == ["risk_label", "risk_score", "is_at_risk"]
    assert svm_res1["risk_label"].iloc[0] in ["Normal", "At Risk"]

    db_res1 = score_dbscan(sample_row0)
    assert isinstance(db_res1, pd.DataFrame)
    assert len(db_res1) == 1
    assert list(db_res1.columns) == ["dbscan_cluster", "is_anomaly", "nearest_core_distance"]

    # Multi row (e.g. 5 duplicate rows)
    multi_df = pd.concat([sample_row0] * 5, ignore_index=True)
    svm_res_multi = predict_svm(multi_df)
    assert len(svm_res_multi) == 5
    assert list(svm_res_multi.index) == list(multi_df.index)

    db_res_multi = score_dbscan(multi_df)
    assert len(db_res_multi) == 5
    assert list(db_res_multi.index) == list(multi_df.index)


def test_threshold_breaches_rules():
    """Verify rule-based threshold auditing on breached and healthy records."""
    breached_record = {
        "Latency_ms": 135.0,  # Breaches > 120
        "Packet_Loss_pct": 5.2,  # Breaches > 4.5
        "Call_Drop_Rate_pct": 4.1,  # Breaches > 3.5
        "Traffic_Load_pct": 88.0,
        "Resource_Utilization_pct": 92.0,
        "Signal_Strength_dBm": -98.5,  # Leads to low signal score < 20
        "Throughput_Mbps": 35.0,
        "Connected_Users": 650,
        "Timestamp": "2026-09-16 19:30:00",
    }
    breaches = threshold_breaches(breached_record)
    assert len(breaches) >= 3
    for b in breaches:
        assert all(k in b for k in ["metric", "value", "limit", "operator", "message"])

    healthy_record = {
        "Latency_ms": 25.0,
        "Packet_Loss_pct": 0.5,
        "Call_Drop_Rate_pct": 0.2,
        "Traffic_Load_pct": 30.0,
        "Resource_Utilization_pct": 40.0,
        "Signal_Strength_dBm": -65.0,
        "Throughput_Mbps": 200.0,
        "Connected_Users": 150,
        "Timestamp": "2026-09-16 10:00:00",
    }
    assert len(threshold_breaches(healthy_record)) == 0


def test_missing_column_errors():
    """Verify ValueError is raised if a required telemetry column is omitted."""
    incomplete_df = pd.DataFrame(
        [
            {
                "Latency_ms": 50.0,
                # Missing Packet_Loss_pct
                "Traffic_Load_pct": 50.0,
                "Resource_Utilization_pct": 50.0,
                "Call_Drop_Rate_pct": 1.0,
                "Signal_Strength_dBm": -80.0,
                "Throughput_Mbps": 100.0,
                "Connected_Users": 100,
                "Timestamp": "2026-09-16 12:00:00",
            }
        ]
    )
    with pytest.raises(ValueError, match="Packet_Loss_pct"):
        predict_svm(incomplete_df)

    with pytest.raises(ValueError, match="Packet_Loss_pct"):
        score_dbscan(incomplete_df)


def test_non_numeric_validation_error():
    """Verify ValueError is raised when non-numeric values are passed for numeric metrics."""
    bad_type_df = pd.DataFrame(
        [
            {
                "Latency_ms": "CORRUPTED_VALUE",
                "Packet_Loss_pct": 1.0,
                "Traffic_Load_pct": 50.0,
                "Resource_Utilization_pct": 50.0,
                "Call_Drop_Rate_pct": 1.0,
                "Signal_Strength_dBm": -80.0,
                "Throughput_Mbps": 100.0,
                "Connected_Users": 100,
                "Timestamp": "2026-09-16 12:00:00",
            }
        ]
    )
    with pytest.raises(ValueError, match="Latency_ms"):
        predict_svm(bad_type_df)


def test_unseen_asset_type_resilience():
    """Verify inference pipeline handles arbitrary unseen Asset_Type values gracefully."""
    novel_asset_df = pd.DataFrame(
        [
            {
                "Asset_ID": "SAT-TEST-99",
                "Asset_Type": "Orbital_Laser_Satellite",  # Completely novel category
                "Latency_ms": 30.0,
                "Packet_Loss_pct": 0.5,
                "Traffic_Load_pct": 40.0,
                "Resource_Utilization_pct": 45.0,
                "Call_Drop_Rate_pct": 0.4,
                "Signal_Strength_dBm": -72.0,
                "Throughput_Mbps": 350.0,
                "Connected_Users": 250,
                "Timestamp": "2026-09-16 14:00:00",
            }
        ]
    )
    res = predict_svm(novel_asset_df)
    assert res["risk_label"].iloc[0] == "Normal"


def test_dbscan_training_data_reproduction_100_percent():
    """Verify that score_dbscan reproduces DBSCAN anomaly assignment for 100% of 6,000 training rows."""
    dataset_path = REPO_ROOT / "dataset" / "nexusnet_features_labeled.csv"
    assert dataset_path.exists(), f"Labeled dataset missing at {dataset_path}"

    df_full = pd.read_csv(dataset_path)
    db_res = score_dbscan(df_full)

    artifact_path = REPO_ROOT / "backend" / "models" / "dbscan_artifact.joblib"
    artifact = joblib.load(artifact_path)

    # Re-evaluate with exact DBSCAN model to check 100% reproduction
    from sklearn.cluster import DBSCAN
    X_scaled = artifact["scaler"].transform(df_full[artifact["features"]].values)
    fitted_dbscan = DBSCAN(eps=artifact["eps"], min_samples=artifact["min_samples"]).fit(X_scaled)
    true_anomaly = (fitted_dbscan.labels_ == -1)

    predicted_anomaly = db_res["is_anomaly"].values

    matches = np.sum(predicted_anomaly == true_anomaly)
    total = len(df_full)
    assert matches == total, f"DBSCAN reproduction failed: {matches} / {total} matched ({matches/total*100:.2f}%)"
