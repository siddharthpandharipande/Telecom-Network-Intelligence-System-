"""
NEXUSNET - AI-Powered Telecom Network Intelligence System
=========================================================
Module: Single Record Telecom Asset Risk & Anomaly Prediction (CLI)
Description:
    Takes ONE raw/company-level telecom network asset telemetry record,
    applies the hardened offline ML inference pipeline:
    - Feature engineering (local hour, stress index, signal quality score, throughput per user)
    - Shipped RBF SVM Pipeline (probability calibration, risk classification)
    - Real DBSCAN Nearest-Core Sample Anomaly Scoring
    - SLA Rule-Based Policy Audit (Threshold Breaches)

College / Academic Project Implementation
Author: Siddharth Pandharipande
"""

import sys
from pathlib import Path

# Ensure UTF-8 output encoding for Windows terminal compatibility
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Add backend directory to sys.path to support execution from any working directory
BACKEND_DIR = Path(__file__).resolve().parent
REPO_ROOT = BACKEND_DIR.parent
for p in [str(REPO_ROOT), str(BACKEND_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

import numpy as np
import pandas as pd

from backend.ml.inference import (
    get_config,
    predict_svm,
    score_dbscan,
    threshold_breaches,
)
from backend.ml.features import engineer_features


def predict_single_record(raw_record: dict) -> dict:
    """Predict Network Status, Anomaly Status, and SLA Breaches for ONE asset record.

    Parameters
    ----------
    raw_record : dict
        Dictionary containing raw telemetry fields.

    Returns
    -------
    dict
        Dictionary containing predictions, anomaly scoring, and SLA breaches.
    """
    # 1. Convert to single-row DataFrame
    input_df = pd.DataFrame([raw_record])

    # 2. Compute engineered features for inspection
    engineered = engineer_features(input_df).iloc[0]

    # 3. Call canonical ML inference functions
    svm_res = predict_svm(input_df).iloc[0]
    dbscan_res = score_dbscan(input_df).iloc[0]
    breaches = threshold_breaches(raw_record)

    asset_id = raw_record.get("Asset_ID", "NEXUS-NODE-001")
    asset_type = raw_record.get("Asset_Type", "Unknown")
    lat = float(raw_record.get("Latitude", 0.0))
    lng = float(raw_record.get("Longitude", 0.0))
    ts_str = str(raw_record.get("Timestamp", "2026-09-16 12:00:00"))

    status_label = svm_res["risk_label"]
    confidence_pct = (svm_res["risk_score"] if svm_res["is_at_risk"] else (1.0 - svm_res["risk_score"])) * 100.0

    # 4. Display clean NOC terminal report
    print("\n" + "=" * 78)
    print("      NEXUSNET TELECOM NOC - AI NETWORK RISK & ANOMALY SYSTEM")
    print("=" * 78)

    print("\n📍 ASSET METADATA:")
    print(f"   • Asset ID          : {asset_id}")
    print(f"   • Asset Type        : {asset_type}")
    print(f"   • Geolocation       : Lat {lat:.4f}, Lng {lng:.4f}")
    print(f"   • Telemetry Time    : {ts_str} (Peak Hour: {'YES' if engineered['Peak_Hour'] == 1 else 'NO'})")

    print("\n⚙️ AUTOMATICALLY ENGINEERED METRICS:")
    print(f"   • Network Stress Index  : {engineered['Network_Stress_Index']:.2f} %")
    print(f"   • Signal Quality Score  : {engineered['Signal_Quality_Score']:.2f} / 100")
    print(f"   • Throughput / User     : {engineered['Throughput_per_User']:.4f} Mbps/user")

    print("\n📡 KEY INPUT TELEMETRY METRICS:")
    print(f"   • Signal Strength (RSRP): {float(raw_record.get('Signal_Strength_dBm', 0.0)):.2f} dBm")
    print(f"   • Latency               : {float(raw_record.get('Latency_ms', 0.0)):.2f} ms")
    print(f"   • Packet Loss           : {float(raw_record.get('Packet_Loss_pct', 0.0)):.2f} %")
    print(f"   • Traffic Load          : {float(raw_record.get('Traffic_Load_pct', 0.0)):.2f} %")
    print(f"   • Call Drop Rate        : {float(raw_record.get('Call_Drop_Rate_pct', 0.0)):.2f} %")
    print(f"   • Resource Utilization  : {float(raw_record.get('Resource_Utilization_pct', 0.0)):.2f} %")
    print(f"   • Throughput            : {float(raw_record.get('Throughput_Mbps', 0.0)):.2f} Mbps")
    print(f"   • Connected Users       : {int(raw_record.get('Connected_Users', 0))} users")

    print("\n" + "-" * 78)
    if svm_res["is_at_risk"]:
        print(f" 🚨 SVM PREDICTION STATUS : [{status_label.upper()}] (OPERATIONAL RISK DETECTED)")
    else:
        print(f" 🟢 SVM PREDICTION STATUS : [{status_label.upper()}] (HEALTHY / OPERATIONAL)")
    print(f" 🎯 MODEL CONFIDENCE      : {confidence_pct:.2f}% (Risk Probability: {svm_res['risk_score'] * 100.0:.2f}%)")

    # DBSCAN Anomaly Status
    if dbscan_res["is_anomaly"]:
        print(f" ⚠️ DBSCAN ANOMALY STATUS : [OUTLIER / NOISE (Cluster {dbscan_res['dbscan_cluster']})]")
    else:
        print(f" 🔹 DBSCAN ANOMALY STATUS : [INLIER (Cluster {dbscan_res['dbscan_cluster']})]")
    print(f" 📏 NEAREST CORE DISTANCE : {dbscan_res['nearest_core_distance']:.4f}")
    print("-" * 78)

    print("\n📋 RULE-BASED SLA THRESHOLD AUDIT (Policy Check - Not Model Explanation):")
    if breaches:
        print(f"   ⚠️ Detected {len(breaches)} SLA policy breach(es):")
        for b in breaches:
            print(f"      - {b['metric']}: {b['value']} {b['operator']} {b['limit']} ({b['message']})")
    else:
        print("   ✅ Asset satisfies all standard operational SLA thresholds.")

    print("=" * 78 + "\n")

    return {
        "Asset_ID": asset_id,
        "Status": status_label,
        "Risk_Score": float(svm_res["risk_score"]),
        "Confidence_pct": float(confidence_pct),
        "is_at_risk": bool(svm_res["is_at_risk"]),
        "dbscan_cluster": int(dbscan_res["dbscan_cluster"]),
        "is_anomaly": bool(dbscan_res["is_anomaly"]),
        "nearest_core_distance": float(dbscan_res["nearest_core_distance"]),
        "threshold_breaches": breaches,
    }


if __name__ == "__main__":
    print("\n--- RUNNING DEMO SINGLE RECORD PREDICTIONS (HARDENED ML INFERENCE) ---")

    # Sample 1: AT RISK Asset Input Record
    at_risk_record = {
        "Asset_ID": "AS-IND-MUM-MH-BS-09999",
        "Asset_Type": "Cell Tower",
        "Latitude": 19.0760,
        "Longitude": 72.8777,
        "Signal_Strength_dBm": -98.5,
        "Latency_ms": 135.0,
        "Packet_Loss_pct": 5.2,
        "Throughput_Mbps": 35.0,
        "Connected_Users": 650,
        "Traffic_Load_pct": 88.0,
        "Call_Drop_Rate_pct": 4.1,
        "Resource_Utilization_pct": 92.0,
        "Timestamp": "2026-09-16 19:30:00",
    }

    print("\n>>> PREDICTING RECORD 1 (HIGH STRESS / AT RISK CANDIDATE):")
    predict_single_record(at_risk_record)

    # Sample 2: NORMAL Operational Asset Input Record
    normal_record = {
        "Asset_ID": "AS-IND-DEL-DL-GW-00102",
        "Asset_Type": "Base Station",
        "Latitude": 28.6139,
        "Longitude": 77.2090,
        "Signal_Strength_dBm": -68.0,
        "Latency_ms": 28.0,
        "Packet_Loss_pct": 0.4,
        "Throughput_Mbps": 240.0,
        "Connected_Users": 180,
        "Traffic_Load_pct": 32.0,
        "Call_Drop_Rate_pct": 0.3,
        "Resource_Utilization_pct": 40.0,
        "Timestamp": "2026-09-16 10:15:00",
    }

    print("\n>>> PREDICTING RECORD 2 (OPTIMAL HEALTH / NORMAL CANDIDATE):")
    predict_single_record(normal_record)
