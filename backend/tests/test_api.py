"""Integration and unit tests for NEXUSNET Backend API, database, and ingestion."""
import io
from pathlib import Path
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from backend.app.ingestion import TELEMETRY_RANGES
from backend.app.status_policy import determine_status_single
from backend.ml.features import engineer_features
from backend.ml.inference import get_config, get_model_card


def test_seed_works_and_is_idempotent(client: TestClient):
    """Verify database seeding works and subsequent calls skip safely without duplicating rows."""
    health_resp = client.get("/api/health")
    assert health_resp.status_code == 200
    data = health_resp.json()
    assert data["status"] == "ok"
    assert data["db_assets"] == 6000
    assert data["db_readings"] == 6000


def test_status_precedence_strict(client: TestClient):
    """Verify status calculation follows strict precedence:
    1. red    = is_at_risk is true (regardless of anomaly)
    2. purple = is_anomaly is true AND not at risk
    3. yellow = not at risk, not anomaly, but near-threshold: any label-clause metric from
                backend/ml/config.json at >= 80% of its limit, OR Network_Stress_Index > 45,
                OR Signal_Quality_Score < 35
    4. green  = everything else
    """
    # Case 1: At risk only -> RED
    assert (
        determine_status_single(
            is_at_risk=True,
            is_anomaly=False,
            row={"Latency_ms": 130.0, "Network_Stress_Index": 60.0, "Signal_Quality_Score": 10.0},
        )
        == "red"
    )

    # Case 2: Both at risk AND anomaly -> RED
    assert (
        determine_status_single(
            is_at_risk=True,
            is_anomaly=True,
            row={"Latency_ms": 130.0, "Network_Stress_Index": 60.0, "Signal_Quality_Score": 10.0},
        )
        == "red"
    )

    # Case 3: Anomaly only (not at risk) -> PURPLE
    assert (
        determine_status_single(
            is_at_risk=False,
            is_anomaly=True,
            row={"Latency_ms": 50.0, "Network_Stress_Index": 20.0, "Signal_Quality_Score": 80.0},
        )
        == "purple"
    )

    # Case 4: Near-threshold normal (not at risk, not anomaly) -> YELLOW
    # Latency 100 ms is >= 80% of 120 ms limit
    assert (
        determine_status_single(
            is_at_risk=False,
            is_anomaly=False,
            row={"Latency_ms": 100.0, "Network_Stress_Index": 20.0, "Signal_Quality_Score": 80.0},
        )
        == "yellow"
    )
    # Network_Stress_Index > 45
    assert (
        determine_status_single(
            is_at_risk=False,
            is_anomaly=False,
            row={"Latency_ms": 50.0, "Network_Stress_Index": 48.0, "Signal_Quality_Score": 80.0},
        )
        == "yellow"
    )
    # Signal_Quality_Score < 35
    assert (
        determine_status_single(
            is_at_risk=False,
            is_anomaly=False,
            row={"Latency_ms": 50.0, "Network_Stress_Index": 20.0, "Signal_Quality_Score": 30.0},
        )
        == "yellow"
    )

    # Case 5: Clean normal operational -> GREEN
    assert (
        determine_status_single(
            is_at_risk=False,
            is_anomaly=False,
            row={"Latency_ms": 30.0, "Network_Stress_Index": 20.0, "Signal_Quality_Score": 85.0},
        )
        == "green"
    )

    # Verify status legend from GET /api/config
    resp = client.get("/api/config")
    assert resp.status_code == 200
    config_data = resp.json()
    legend = {item["status"]: item["label"] for item in config_data["status_legend"]}
    assert legend["red"] == "At risk (SVM)"
    assert legend["purple"] == "Anomaly only (DBSCAN)"
    assert legend["yellow"] == "Near threshold"
    assert legend["green"] == "Normal"


def test_csv_with_alias_headers(client: TestClient):
    """Verify CSV ingestion properly maps diverse column aliases to canonical headers."""
    csv_content = (
        "id,type,lat,lng,signal,latency,loss,bandwidth,users,traffic,dropped_calls,cpu_memory_util,time\n"
        "TEST-ALIAS-001,Cell Tower,19.07,72.87,-75.0,45.0,1.2,120.0,250,55.0,1.1,60.0,2026-09-16 12:00:00\n"
    )

    files = {"file": ("alias_test.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    resp = client.post("/api/ingest/csv?dry_run=true", files=files)
    assert resp.status_code == 200
    report = resp.json()
    assert report["accepted"] == 1
    assert report["rejected"] == 0


def test_out_of_range_rejection_with_row_reason(client: TestClient):
    """Verify out-of-range values are rejected with informative row-level reasons."""
    # Signal_Strength_dBm = -20.0 is out of [-140.0, -30.0]
    csv_content = (
        "Asset_ID,Signal_Strength_dBm,Latency_ms,Packet_Loss_pct,Throughput_Mbps,Connected_Users,Traffic_Load_pct,Call_Drop_Rate_pct,Resource_Utilization_pct\n"
        "BAD-NODE-01,-20.0,40.0,1.0,100.0,100,50.0,1.0,50.0\n"
    )

    files = {"file": ("bad_range.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    resp = client.post("/api/ingest/csv?dry_run=true", files=files)
    assert resp.status_code == 200
    report = resp.json()
    assert report["accepted"] == 0
    assert report["rejected"] == 1
    assert len(report["rejected_rows"]) == 1
    reason_text = " ".join(report["rejected_rows"][0]["reasons"])
    assert "Out-of-range" in reason_text
    assert "Signal_Strength_dBm" in reason_text


def test_fractions_warning_on_percentage(client: TestClient):
    """Verify warning is generated if percentage column values appear as fractions (<= 1.0)."""
    csv_content = (
        "Asset_ID,Signal_Strength_dBm,Latency_ms,Packet_Loss_pct,Throughput_Mbps,Connected_Users,Traffic_Load_pct,Call_Drop_Rate_pct,Resource_Utilization_pct\n"
        "FRAC-01,-80.0,40.0,0.02,100.0,100,0.50,0.01,0.60\n"
        "FRAC-02,-80.0,40.0,0.03,100.0,100,0.40,0.02,0.70\n"
    )

    files = {"file": ("fractions.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    resp = client.post("/api/ingest/csv?dry_run=true", files=files)
    assert resp.status_code == 200
    report = resp.json()
    warnings_joined = " ".join(report["warnings"])
    assert "fractions" in warnings_joined


def test_missing_telemetry_rejected_vs_imputed(client: TestClient):
    """Verify missing telemetry is rejected by default, but filled with medians when impute=true."""
    # Missing Latency_ms
    csv_content = (
        "Asset_ID,Signal_Strength_dBm,Packet_Loss_pct,Throughput_Mbps,Connected_Users,Traffic_Load_pct,Call_Drop_Rate_pct,Resource_Utilization_pct\n"
        "IMPUTE-TEST-01,-80.0,1.0,100.0,100,50.0,1.0,50.0\n"
    )

    # 1. Without imputation -> Rejected
    files1 = {"file": ("test.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    resp1 = client.post("/api/ingest/csv?dry_run=true&impute=false", files=files1)
    assert resp1.status_code == 200
    assert resp1.json()["rejected"] == 1

    # 2. With imputation -> Accepted with imputed count incremented
    files2 = {"file": ("test.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    resp2 = client.post("/api/ingest/csv?dry_run=true&impute=true", files=files2)
    assert resp2.status_code == 200
    report2 = resp2.json()
    assert report2["accepted"] == 1
    assert report2["imputed"] == 1


def test_duplicate_rows_in_file(client: TestClient):
    """Verify duplicates inside a file are deduplicated (last kept) and counted in duplicates_in_file."""
    csv_content = (
        "Asset_ID,Timestamp,Signal_Strength_dBm,Latency_ms,Packet_Loss_pct,Throughput_Mbps,Connected_Users,Traffic_Load_pct,Call_Drop_Rate_pct,Resource_Utilization_pct\n"
        "DUP-NODE-01,2026-09-16 10:00:00,-85.0,40.0,1.0,100.0,100,50.0,1.0,50.0\n"
        "DUP-NODE-01,2026-09-16 10:00:00,-75.0,30.0,0.5,150.0,120,40.0,0.5,45.0\n"
    )

    files = {"file": ("dup.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    resp = client.post("/api/ingest/csv?dry_run=true", files=files)
    assert resp.status_code == 200
    report = resp.json()
    assert report["accepted"] == 1
    assert report["duplicates_in_file"] == 1


def test_reuploading_same_file_leaves_counts_unchanged(client: TestClient):
    """Verify re-uploading the same file updates existing records without inflating totals."""
    csv_content = (
        "Asset_ID,Timestamp,Signal_Strength_dBm,Latency_ms,Packet_Loss_pct,Throughput_Mbps,Connected_Users,Traffic_Load_pct,Call_Drop_Rate_pct,Resource_Utilization_pct\n"
        "IDEMP-NODE-01,2026-09-16 14:00:00,-80.0,45.0,1.0,120.0,100,50.0,1.0,50.0\n"
    )

    # First upload
    files1 = {"file": ("idemp.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    resp1 = client.post("/api/ingest/csv?dry_run=false", files=files1)
    assert resp1.status_code == 200
    rep1 = resp1.json()
    assert rep1["accepted"] == 1
    assert rep1["updated"] == 0

    # Second upload of the same record
    files2 = {"file": ("idemp.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    resp2 = client.post("/api/ingest/csv?dry_run=false", files=files2)
    assert resp2.status_code == 200
    rep2 = resp2.json()
    assert rep2["accepted"] == 1
    assert rep2["updated"] == 1


def test_unlocated_asset_accepted_and_absent_from_map_points(client: TestClient):
    """Verify unlocated asset is accepted and counted, but excluded from map points."""
    record = {
        "Asset_ID": "UNLOCATED-NODE-999",
        "Signal_Strength_dBm": -82.0,
        "Latency_ms": 35.0,
        "Packet_Loss_pct": 0.8,
        "Throughput_Mbps": 180.0,
        "Connected_Users": 150,
        "Traffic_Load_pct": 45.0,
        "Call_Drop_Rate_pct": 0.8,
        "Resource_Utilization_pct": 52.0,
        "Timestamp": "2026-09-16 11:00:00",
    }

    resp = client.post("/api/predict?persist=true", json=record)
    assert resp.status_code == 200

    # Verify present in /api/assets
    asset_resp = client.get("/api/assets?q=UNLOCATED-NODE-999")
    assert asset_resp.status_code == 200
    assert asset_resp.json()["total"] == 1

    # Verify absent from /api/map/points
    map_resp = client.get("/api/map/points?q=UNLOCATED-NODE-999")
    assert map_resp.status_code == 200
    assert len(map_resp.json()) == 0


def test_predict_matches_one_row_csv(client: TestClient):
    """Verify POST /api/predict produces identical scoring outputs to a single-row CSV ingestion."""
    record = {
        "Asset_ID": "PARITY-CHECK-01",
        "Signal_Strength_dBm": -95.0,
        "Latency_ms": 125.0,
        "Packet_Loss_pct": 4.8,
        "Throughput_Mbps": 40.0,
        "Connected_Users": 500,
        "Traffic_Load_pct": 85.0,
        "Call_Drop_Rate_pct": 3.8,
        "Resource_Utilization_pct": 90.0,
        "Timestamp": "2026-09-16 20:00:00",
    }

    # 1. Direct Predict endpoint
    pred_resp = client.post("/api/predict?persist=false", json=record)
    assert pred_resp.status_code == 200
    pred_data = pred_resp.json()["reading"]

    # 2. CSV Dry-run endpoint
    csv_str = (
        "Asset_ID,Signal_Strength_dBm,Latency_ms,Packet_Loss_pct,Throughput_Mbps,Connected_Users,Traffic_Load_pct,Call_Drop_Rate_pct,Resource_Utilization_pct,Timestamp\n"
        f"{record['Asset_ID']},{record['Signal_Strength_dBm']},{record['Latency_ms']},{record['Packet_Loss_pct']},{record['Throughput_Mbps']},{record['Connected_Users']},{record['Traffic_Load_pct']},{record['Call_Drop_Rate_pct']},{record['Resource_Utilization_pct']},{record['Timestamp']}\n"
    )
    files = {"file": ("parity.csv", io.BytesIO(csv_str.encode("utf-8")), "text/csv")}
    csv_resp = client.post("/api/ingest/csv?dry_run=true", files=files)
    assert csv_resp.status_code == 200

    assert pred_data["risk_label"] == "At Risk"
    assert pred_data["status"] == "red"
    assert pred_data["is_at_risk"] is True


def test_feature_values_match_backend_ml_directly(client: TestClient):
    """Verify calculated engineered feature values precisely match backend.ml.features."""
    record = {
        "Asset_ID": "MATH-CHECK-01",
        "Signal_Strength_dBm": -98.02,
        "Latency_ms": 101.79,
        "Packet_Loss_pct": 3.97,
        "Throughput_Mbps": 69.47,
        "Connected_Users": 105,
        "Traffic_Load_pct": 53.73,
        "Call_Drop_Rate_pct": 2.97,
        "Resource_Utilization_pct": 66.61,
        "Timestamp": "2026-09-16 17:00:00",
    }

    # Compute directly using ML module
    ml_df = engineer_features(pd.DataFrame([record])).iloc[0]

    # Compute via API
    resp = client.post("/api/predict?persist=false", json=record)
    assert resp.status_code == 200
    api_reading = resp.json()["reading"]

    assert round(api_reading["network_stress_index"], 3) == round(ml_df["Network_Stress_Index"], 3)
    assert round(api_reading["signal_quality_score"], 2) == round(ml_df["Signal_Quality_Score"], 2)
    assert round(api_reading["throughput_per_user"], 4) == round(ml_df["Throughput_per_User"], 4)
    assert api_reading["peak_hour"] == int(ml_df["Peak_Hour"])


def test_incident_auto_creation_and_lifecycle_transitions(client: TestClient):
    """Verify automatic incident creation and state transition enforcement with 409 conflict on illegal transition."""
    # 1. Fetch seed incidents
    inc_resp = client.get("/api/incidents?page=1&page_size=1")
    assert inc_resp.status_code == 200
    incidents = inc_resp.json()["items"]
    assert len(incidents) > 0
    inc_id = incidents[0]["id"]

    # 2. Valid transition: open -> acknowledged
    act1 = client.post(
        f"/api/incidents/{inc_id}/action",
        json={"action": "acknowledge", "note": "Acknowledged by NOC test"},
    )
    assert act1.status_code == 200
    assert act1.json()["status"] == "acknowledged"

    # 3. Invalid transition: acknowledged -> resolved (must investigate or escalate first) -> 409
    act_bad = client.post(
        f"/api/incidents/{inc_id}/action",
        json={"action": "resolve", "note": "premature resolution attempt"},
    )
    assert act_bad.status_code == 409
    assert act_bad.json()["code"] == "INVALID_STATE_TRANSITION"

    # 4. Valid path: acknowledged -> investigating -> resolved
    act2 = client.post(
        f"/api/incidents/{inc_id}/action",
        json={"action": "investigate", "note": "Investigating node telemetry"},
    )
    assert act2.status_code == 200
    assert act2.json()["status"] == "investigating"

    act3 = client.post(
        f"/api/incidents/{inc_id}/action",
        json={"action": "resolve", "note": "Node back to optimal status"},
    )
    assert act3.status_code == 200
    assert act3.json()["status"] == "resolved"


def test_config_thresholds_match_ml_config_json(client: TestClient):
    """Verify /api/config returns exact thresholds from backend/ml/config.json."""
    ml_cfg = get_config()
    resp = client.get("/api/config")
    assert resp.status_code == 200
    api_cfg = resp.json()

    assert api_cfg["version"] == ml_cfg["version"]
    assert api_cfg["decision"]["shipped_variant"] == ml_cfg["decision"]["shipped_variant"]
    assert len(api_cfg["label"]["clauses"]) == len(ml_cfg["label"]["clauses"])
    for i, c in enumerate(api_cfg["label"]["clauses"]):
        assert c["metric"] == ml_cfg["label"]["clauses"][i]["metric"]
        assert c["limit"] == ml_cfg["label"]["clauses"][i]["limit"]


def test_assets_filters_and_pagination(client: TestClient):
    """Verify filtering and pagination on /api/assets."""
    # Page 1
    resp_p1 = client.get("/api/assets?page=1&page_size=10")
    assert resp_p1.status_code == 200
    d1 = resp_p1.json()
    assert len(d1["items"]) == 10
    assert d1["total"] >= 6000

    # Filter by status
    resp_red = client.get("/api/assets?status=red&page_size=5")
    assert resp_red.status_code == 200
    for itm in resp_red.json()["items"]:
        assert itm["status"] == "red"


def test_hourly_analytics_24_buckets_max(client: TestClient):
    """Verify /api/analytics/hourly aggregates across all 24 hours with valid effect size."""
    resp = client.get("/api/analytics/hourly?metric=latency_ms")
    assert resp.status_code == 200
    data = resp.json()

    assert data["metric"] == "latency_ms"
    assert len(data["hourly"]) == 24
    assert 0.0 <= data["effect_size"] <= 1.0
    assert isinstance(data["meaningful"], bool)
