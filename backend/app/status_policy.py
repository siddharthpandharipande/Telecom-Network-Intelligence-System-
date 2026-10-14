"""Status calculation policy with strict precedence and legend definition.

REQUIRED RULES (strict precedence, first match wins):
1. red    = is_at_risk is true (regardless of anomaly)
2. purple = is_anomaly is true AND not at risk
3. yellow = not at risk, not anomaly, but near-threshold: any label-clause metric from backend/ml/config.json at >= 80% of its limit, OR Network_Stress_Index > 45, OR Signal_Quality_Score < 35
4. green  = everything else
"""
from typing import Any, Dict, List, Union
import numpy as np
import pandas as pd

from backend.ml.inference import get_config

STATUS_LEGEND: List[Dict[str, str]] = [
    {
        "status": "red",
        "label": "At risk (SVM)",
        "color_key": "#ef4444",
        "description": "At risk (SVM): elevated risk of service degradation classified by SVM model (regardless of anomaly status).",
    },
    {
        "status": "purple",
        "label": "Anomaly only (DBSCAN)",
        "color_key": "#a855f7",
        "description": "Anomaly only (DBSCAN): statistical telemetry outlier detected by DBSCAN density clustering and not at risk.",
    },
    {
        "status": "yellow",
        "label": "Near threshold",
        "color_key": "#eab308",
        "description": "Near threshold: not at risk, not anomaly, but operating within 20% of SLA thresholds, Network Stress Index > 45, or Signal Quality Score < 35.",
    },
    {
        "status": "green",
        "label": "Normal",
        "color_key": "#22c55e",
        "description": "Normal: operational within standard boundaries.",
    },
]


def is_near_threshold(row_or_df: Union[Dict[str, Any], pd.Series, pd.DataFrame]) -> Union[bool, pd.Series]:
    """Determine whether telemetry values are near operational threshold limits.

    Near-threshold is defined as:
    - Any label clause metric from backend/ml/config.json at >= 80% of limit
      (for '>' clauses: val >= 0.80 * limit; for '<' clauses: val <= 1.20 * limit)
    - OR Network_Stress_Index > 45.0
    - OR Signal_Quality_Score < 35.0
    """
    config = get_config()
    clauses = config.get("label", {}).get("clauses", [])
    if not clauses:
        active = config.get("active_label", "Legacy5")
        clauses = config.get("label_variants", {}).get(active, {}).get("clauses", [])

    if isinstance(row_or_df, pd.DataFrame):
        df = row_or_df
        cond = pd.Series(False, index=df.index)

        for clause in clauses:
            metric = clause["metric"]
            op = clause.get("op", ">")
            limit = float(clause["limit"])

            col = None
            if metric in df.columns:
                col = metric
            elif metric.lower() in df.columns:
                col = metric.lower()

            if col is not None:
                val = df[col].astype(float)
                if op in (">", ">="):
                    cond = cond | (val >= 0.80 * limit)
                elif op in ("<", "<="):
                    cond = cond | (val <= 1.20 * limit)

        nsi_col = "Network_Stress_Index" if "Network_Stress_Index" in df.columns else "network_stress_index" if "network_stress_index" in df.columns else None
        if nsi_col:
            cond = cond | (df[nsi_col].astype(float) > 45.0)

        sqs_col = "Signal_Quality_Score" if "Signal_Quality_Score" in df.columns else "signal_quality_score" if "signal_quality_score" in df.columns else None
        if sqs_col:
            cond = cond | (df[sqs_col].astype(float) < 35.0)

        return cond

    # Single dictionary or pd.Series
    row = dict(row_or_df)
    for clause in clauses:
        metric = clause["metric"]
        op = clause.get("op", ">")
        limit = float(clause["limit"])

        val = row.get(metric)
        if val is None:
            val = row.get(metric.lower())

        if val is not None:
            fval = float(val)
            if op in (">", ">=") and fval >= 0.80 * limit:
                return True
            if op in ("<", "<=") and fval <= 1.20 * limit:
                return True

    nsi = row.get("Network_Stress_Index")
    if nsi is None:
        nsi = row.get("network_stress_index")
    if nsi is not None and float(nsi) > 45.0:
        return True

    sqs = row.get("Signal_Quality_Score")
    if sqs is None:
        sqs = row.get("signal_quality_score")
    if sqs is not None and float(sqs) < 35.0:
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
