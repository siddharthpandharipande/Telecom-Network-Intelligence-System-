"""
NEXUSNET - AI-Powered Telecom Network Intelligence System
=========================================================
Module: Single Record SVM Risk Prediction
Description:
    Takes ONE raw/company-level telecom network asset telemetry record,
    automatically calculates engineered features (Stress Index, Signal Quality, Throughput/User, Peak Hour),
    applies the pre-trained StandardScaler (without refitting), and predicts whether the asset is
    'Normal' or 'At Risk' using the trained SVM (RBF Kernel) classifier.

College / Academic Project Implementation
Author: Siddharth Pandharipande
"""

import os
import sys

# Ensure UTF-8 output encoding for Windows terminal compatibility
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

import joblib
import pandas as pd
import numpy as np

def load_svm_artifacts():
    """
    Loads pre-trained SVM model and StandardScaler from disk.
    Checks both local directory and models/ subdirectory.
    """
    model_paths = ["nexusnet_svm_model.pkl", os.path.join("models", "nexusnet_svm_model.pkl")]
    scaler_paths = ["nexusnet_scaler.pkl", os.path.join("models", "nexusnet_scaler.pkl")]

    svm_model = None
    scaler = None

    for p in model_paths:
        if os.path.exists(p):
            svm_model = joblib.load(p)
            break

    for p in scaler_paths:
        if os.path.exists(p):
            scaler = joblib.load(p)
            break

    if svm_model is None or scaler is None:
        raise FileNotFoundError(
            "Model artifacts missing! Please run 'python train_svm.py' first to generate model.pkl and scaler.pkl."
        )

    return svm_model, scaler


def predict_single_record(raw_record: dict):
    """
    Predicts Network Status (Normal vs At Risk) for ONE telecom network asset record.
    
    Parameters:
    -----------
    raw_record : dict containing the 13 raw company-level fields:
        - Asset_ID
        - Asset_Type
        - Latitude
        - Longitude
        - Signal_Strength_dBm
        - Latency_ms
        - Packet_Loss_pct
        - Throughput_Mbps
        - Connected_Users
        - Traffic_Load_pct
        - Call_Drop_Rate_pct
        - Resource_Utilization_pct
        - Timestamp
    """
    # 1. Load trained SVM model and pre-fitted Scaler
    svm_model, scaler = load_svm_artifacts()

    # 2. Extract raw input values
    asset_id = raw_record.get('Asset_ID', 'NEXUS-NODE-001')
    asset_type = raw_record.get('Asset_Type', 'Cell Tower')
    lat = raw_record.get('Latitude', 0.0)
    lng = raw_record.get('Longitude', 0.0)

    sig_strength = float(raw_record.get('Signal_Strength_dBm', -80.0))
    latency = float(raw_record.get('Latency_ms', 50.0))
    packet_loss = float(raw_record.get('Packet_Loss_pct', 1.0))
    throughput = float(raw_record.get('Throughput_Mbps', 100.0))
    users = int(raw_record.get('Connected_Users', 200))
    traffic_load = float(raw_record.get('Traffic_Load_pct', 50.0))
    call_drop = float(raw_record.get('Call_Drop_Rate_pct', 1.0))
    res_util = float(raw_record.get('Resource_Utilization_pct', 60.0))
    timestamp_str = str(raw_record.get('Timestamp', '2026-10-01 18:00:00'))

    # -------------------------------------------------------------------------
    # AUTOMATIC FEATURE ENGINEERING (EXACT FORMULAS AS TRAINING)
    # -------------------------------------------------------------------------
    # A. Network Stress Index (%)
    network_stress_index = (traffic_load + res_util + packet_loss + call_drop) / 4.0

    # B. Signal Quality Score (Scale -105 to -55 dBm to 0-100%)
    signal_quality_score = float(np.clip(((sig_strength + 105.0) / 50.0) * 100.0, 0.0, 100.0))

    # C. Throughput per Connected User (Mbps/user)
    throughput_per_user = (throughput / users) if users > 0 else 0.0

    # D. Timestamp Decomposition & Peak Hour Flag
    try:
        ts = pd.to_datetime(timestamp_str)
        year = ts.year
        month = ts.month
        day = ts.day
        hour = ts.hour
        day_of_week = ts.dayofweek
        peak_hour = 1 if (18 <= hour <= 22) else 0
    except Exception:
        year, month, day, hour, day_of_week, peak_hour = 2026, 10, 1, 18, 3, 1

    # -------------------------------------------------------------------------
    # FEATURE SELECTION & SCALING
    # -------------------------------------------------------------------------
    # Select ONLY the 9 predictive health features (excluding Asset_ID, Lat, Lng, etc.)
    features_dict = {
        'Signal_Strength_dBm': sig_strength,
        'Latency_ms': latency,
        'Packet_Loss_pct': packet_loss,
        'Traffic_Load_pct': traffic_load,
        'Call_Drop_Rate_pct': call_drop,
        'Resource_Utilization_pct': res_util,
        'Network_Stress_Index': network_stress_index,
        'Signal_Quality_Score': signal_quality_score,
        'Throughput_per_User': throughput_per_user
    }

    input_df = pd.DataFrame([features_dict])

    # Apply the PRE-FITTED StandardScaler (DO NOT fit a new scaler!)
    scaled_features = scaler.transform(input_df)

    # -------------------------------------------------------------------------
    # SVM PREDICTION & CONFIDENCE
    # -------------------------------------------------------------------------
    prediction_class = svm_model.predict(scaled_features)[0]  # 0 = Normal, 1 = At Risk
    prediction_probs = svm_model.predict_proba(scaled_features)[0]

    status_label = "AT RISK" if prediction_class == 1 else "NORMAL"
    confidence_pct = prediction_probs[prediction_class] * 100.0

    # -------------------------------------------------------------------------
    # DISPLAY CLEAN CONSOLE OUTPUT
    # -------------------------------------------------------------------------
    print("\n" + "=" * 75)
    print("      NEXUSNET TELECOM NOC - AI NETWORK RISK PREDICTION SYSTEM")
    print("=" * 75)
    
    print("\n📍 ASSET METADATA:")
    print(f"   • Asset ID          : {asset_id}")
    print(f"   • Asset Type        : {asset_type}")
    print(f"   • Geolocation       : Lat {lat:.4f}, Lng {lng:.4f}")
    print(f"   • Telemetry Time    : {timestamp_str} (Peak Hour: {'YES' if peak_hour == 1 else 'NO'})")

    print("\n⚙️ AUTOMATICALLY ENGINEERED METRICS:")
    print(f"   • Network Stress Index  : {network_stress_index:.2f} %")
    print(f"   • Signal Quality Score  : {signal_quality_score:.2f} / 100")
    print(f"   • Throughput / User     : {throughput_per_user:.4f} Mbps/user")

    print("\n📡 KEY INPUT TELEMETRY METRICS:")
    print(f"   • Signal Strength (RSRP): {sig_strength:.2f} dBm")
    print(f"   • Latency               : {latency:.2f} ms")
    print(f"   • Packet Loss           : {packet_loss:.2f} %")
    print(f"   • Traffic Load          : {traffic_load:.2f} %")
    print(f"   • Call Drop Rate        : {call_drop:.2f} %")
    print(f"   • Resource Utilization  : {res_util:.2f} %")
    print(f"   • Throughput            : {throughput:.2f} Mbps")
    print(f"   • Connected Users       : {users} users")

    print("\n" + "-" * 75)
    if prediction_class == 1:
        print(f" 🚨 SVM PREDICTION STATUS : [{status_label}] (AT RISK)")
    else:
        print(f" 🟢 SVM PREDICTION STATUS : [{status_label}] (OPERATIONAL)")
    print(f" 🎯 PREDICTION CONFIDENCE: {confidence_pct:.2f}%")
    print("-" * 75)

    print("\n📋 NETWORK HEALTH SUMMARY & DIAGNOSIS:")
    if prediction_class == 1:
        print("   ⚠️ CRITICAL WARNING: Asset is exhibiting operational stress and risk of service degradation.")
        reasons = []
        if network_stress_index > 50:
            reasons.append(f"High Network Stress Index ({network_stress_index:.1f}%)")
        if latency > 100:
            reasons.append(f"High Latency ({latency:.1f} ms)")
        if packet_loss > 3.0:
            reasons.append(f"Elevated Packet Loss ({packet_loss:.1f}%)")
        if call_drop > 2.5:
            reasons.append(f"High Call Drop Rate ({call_drop:.1f}%)")
        if signal_quality_score < 30:
            reasons.append(f"Poor Signal Quality Score ({signal_quality_score:.1f}/100)")
        
        if reasons:
            print("   Primary Contributing Degradation Drivers:")
            for r in reasons:
                print(f"    - {r}")
        print("   Recommended Action: Dispatch NOC Field Technicians / Trigger Dynamic Bandwidth Allocation.")
    else:
        print("   ✅ ALL SYSTEMS NORMAL: Asset operates well within optimal health boundaries.")
        print("   Key Indicators: Low packet loss, manageable traffic load, and stable latency.")
        print("   Recommended Action: Maintain routine monitoring.")

    print("=" * 75 + "\n")

    return {
        "Asset_ID": asset_id,
        "Status": status_label,
        "Confidence_pct": confidence_pct,
        "Network_Stress_Index": network_stress_index,
        "Signal_Quality_Score": signal_quality_score,
        "Throughput_per_User": throughput_per_user
    }


if __name__ == "__main__":
    print("\n--- RUNNING DEMO SINGLE RECORD PREDICTIONS ---")

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
        "Timestamp": "2026-10-01 19:30:00"
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
        "Timestamp": "2026-10-01 10:15:00"
    }

    print("\n>>> PREDICTING RECORD 2 (OPTIMAL HEALTH / NORMAL CANDIDATE):")
    predict_single_record(normal_record)
