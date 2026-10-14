"""Feature engineering logic for NEXUSNET.
Pure and deterministic transformation: takes canonical raw columns and returns an augmented copy.
"""
from typing import List
import numpy as np
import pandas as pd

# The minimum required columns to compute all engineered features
REQUIRED_FEATURE_INPUT_COLUMNS: List[str] = [
    "Traffic_Load_pct",
    "Resource_Utilization_pct",
    "Packet_Loss_pct",
    "Call_Drop_Rate_pct",
    "Signal_Strength_dBm",
    "Throughput_Mbps",
    "Connected_Users",
    "Timestamp",
]


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Engineer telecom domain features from raw asset telemetry.

    Parameters
    ----------
    df : pd.DataFrame
        DataFrame containing canonical raw telemetry columns.

    Returns
    -------
    pd.DataFrame
        A new DataFrame (copy) containing original columns plus:
        - Hour: Integer hour of the reading [0-23].
          NOTE ON LOCAL TIME ASSUMPTION:
          Timestamp is treated as asset-local time for each telecom node.
          Peak hour traffic analysis assumes local evening rush hour.
        - Peak_Hour: 1 if 18 <= Hour <= 22 else 0 (inclusive).
        - Network_Stress_Index: Arithmetic average of load and degradation factors.
        - Signal_Quality_Score: RSRP signal strength normalized to [0, 100].
        - Throughput_per_User: Bandwidth per subscriber, with users floored at 1
          (prevents division by zero for unmanned/idle assets).

    Raises
    ------
    ValueError
        If any required column is missing from the input DataFrame.
    """
    missing = [col for col in REQUIRED_FEATURE_INPUT_COLUMNS if col not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns for feature engineering: {missing}")

    out = df.copy()

    # 1. Hour and Peak Hour (Asset-local time assumption documented above)
    ts = pd.to_datetime(out["Timestamp"], errors="coerce")
    if ts.isna().any():
        # Fallback if any unparseable timestamps exist
        ts = ts.fillna(pd.to_datetime("2026-09-16 12:00:00"))
    out["Hour"] = ts.dt.hour.astype(int)
    out["Peak_Hour"] = ((out["Hour"] >= 18) & (out["Hour"] <= 22)).astype(int)

    # 2. Network Stress Index: Composite metric across capacity and quality strain
    out["Network_Stress_Index"] = (
        out["Traffic_Load_pct"]
        + out["Resource_Utilization_pct"]
        + out["Packet_Loss_pct"]
        + out["Call_Drop_Rate_pct"]
    ) / 4.0

    # 3. Signal Quality Score: Linear scaling from [-105, -55] dBm into [0, 100]
    scaled_signal = ((out["Signal_Strength_dBm"] + 105.0) / 50.0) * 100.0
    out["Signal_Quality_Score"] = np.clip(scaled_signal, 0.0, 100.0)

    # 4. Throughput per User: Floor Connected_Users at 1 to prevent division by zero
    users_floored = out["Connected_Users"].clip(lower=1)
    out["Throughput_per_User"] = out["Throughput_Mbps"] / users_floored

    return out
