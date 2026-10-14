"""Status calculation policy with strict precedence and legend definition.

Precedence:
1. 'red' if is_at_risk
2. 'purple' if is_anomaly (and not is_at_risk)
3. 'yellow' if near-threshold (and not at risk and not anomaly)
4. 'green' otherwise
"""
from typing import Any, Dict, List, Union
import numpy as np
import pandas as pd

from backend.ml.inference import get_config

STATUS_LEGEND: List[Dict[str, str]] = [
    {
        "status": "red",
        "label": "At Risk",
        "color_key": "#ef4444",
        "description": "High operational risk: breach of composite SLA threshold policy.",
    },
    {
        "status": "purple",
        "label": "Multivariate Anomaly",
        "color_key": "#a855f7",
        "description": "Statistical telemetry outlier detected by DBSCAN density clustering.",
    },
    {
        "status": "yellow",
        "label": "Near-Threshold Warning",
        "color_key": "#eab308",
        "description": "Telemetry operates within 20% of SLA thresholds or elevated stress index.",
    },
    {
        "status": "green",
        "label": "Healthy / Optimal",
        "color_key": "#22c55e",
        "description": "Normal network performance operating comfortably within SLA limits.",
    },
]


def is_near_threshold(row_or_df: Union[Dict[str, Any], pd.Series, pd.DataFrame]) -> Union[bool, pd.Series]:
    """Determine whether telemetry values are near operational threshold limits.

    Near-threshold is defined as:
    - Any label clause metric >= 80% of limit (for '>' clauses) or <= 120% of limit (for '<' clauses)
    - OR Network_Stress_Index > 45.0
    - OR Signal_Quality_Score < 35.0
    """
    config = get_config()
    clauses = config.get("label", {}).get("clauses", [])

    if isinstance(row_or_df, pd.DataFrame):
        df = row_or_df
        cond = pd.Series(False, index=df.index)

        for clause in clauses:
            metric = clause["metric"]
            op = clause["op"]
            limit = float(clause["limit"])

            if metric in df.columns:
                val = df[metric].astype(float)
                if op in (">", ">="):
                    cond = cond | (val >= 0.80 * limit)
                elif op in ("<", "<="):
                    cond = cond | (val <= 1.20 * limit)

        if "Network_Stress_Index" in df.columns:
            cond = cond | (df["Network_Stress_Index"].astype(float) > 45.0)

        if "Signal_Quality_Score" in df.columns:
            cond = cond | (df["Signal_Quality_Score"].astype(float) < 35.0)

        return cond

    # Single dictionary or pd.Series
    row = dict(row_or_df)
    for clause in clauses:
        metric = clause["metric"]
        op = clause["op"]
        limit = float(clause["limit"])

        if metric in row and row[metric] is not None:
            val = float(row[metric])
            if op in (">", ">=") and val >= 0.80 * limit:
                return True
            if op in ("<", "<=") and val <= 1.20 * limit:
                return True

    nsi = float(row.get("Network_Stress_Index", 0.0) or 0.0)
    if nsi > 45.0:
        return True

    sqs = float(row.get("Signal_Quality_Score", 100.0) or 100.0)
    if sqs < 35.0:
        return True

    return False


def determine_status_single(is_at_risk: bool, is_anomaly: bool, row: Dict[str, Any]) -> str:
    """Determine status string for a single reading following strict precedence."""
    if is_at_risk:
        return "red"
    if is_anomaly:
        return "purple"
    if is_near_threshold(row):
        return "yellow"
    return "green"


def compute_status_vectorized(df: pd.DataFrame) -> pd.Series:
    """Compute status series for a DataFrame with strict precedence.

    Precedence:
    1. 'red' if is_at_risk
    2. 'purple' if is_anomaly
    3. 'yellow' if near_threshold
    4. 'green' otherwise
    """
    near_thresh = is_near_threshold(df)
    status = pd.Series("green", index=df.index, dtype=str)
    status[near_thresh] = "yellow"
    status[df["is_anomaly"].astype(bool)] = "purple"
    status[df["is_at_risk"].astype(bool)] = "red"
    return status
