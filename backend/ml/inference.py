"""Inference module for NEXUSNET.

This module is the canonical offline ML inference contract.
It provides functions to:
- Retrieve cached configuration and model card
- Predict SVM risk labels and calibrated probabilities
- Score DBSCAN anomaly status via nearest-core sample distance
- Check rule-defined SLA threshold breaches
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import joblib
import numpy as np
import pandas as pd

from backend.ml.config import load_config
from backend.ml.features import engineer_features

# Global lazy singletons
_CONFIG: Optional[Dict[str, Any]] = None
_MODEL_CARD: Optional[Dict[str, Any]] = None
_SVM_PIPELINE: Any = None
_DBSCAN_ARTIFACT: Optional[Dict[str, Any]] = None

BASE_DIR = Path(__file__).resolve().parent.parent


def get_config() -> Dict[str, Any]:
    """Return the cached system configuration dictionary."""
    global _CONFIG
    if _CONFIG is None:
        _CONFIG = load_config()
    return _CONFIG


def get_model_card() -> Dict[str, Any]:
    """Return the cached model card metadata dictionary."""
    global _MODEL_CARD
    if _MODEL_CARD is None:
        card_path = BASE_DIR / "models" / "model_card.json"
        if card_path.exists():
            with open(card_path, "r", encoding="utf-8") as f:
                _MODEL_CARD = json.load(f)
        else:
            _MODEL_CARD = {}
    return _MODEL_CARD


def _get_svm_pipeline() -> Any:
    """Lazily load and cache the trained SVM pipeline."""
    global _SVM_PIPELINE
    if _SVM_PIPELINE is None:
        pipeline_path = BASE_DIR / "models" / "svm_pipeline.joblib"
        if not pipeline_path.exists():
            raise FileNotFoundError(f"SVM pipeline artifact not found at: {pipeline_path}")
        _SVM_PIPELINE = joblib.load(pipeline_path)
    return _SVM_PIPELINE


def _get_dbscan_artifact() -> Dict[str, Any]:
    """Lazily load and cache the scorable DBSCAN artifact."""
    global _DBSCAN_ARTIFACT
    if _DBSCAN_ARTIFACT is None:
        artifact_path = BASE_DIR / "models" / "dbscan_artifact.joblib"
        if not artifact_path.exists():
            raise FileNotFoundError(f"DBSCAN artifact not found at: {artifact_path}")
        _DBSCAN_ARTIFACT = joblib.load(artifact_path)
    return _DBSCAN_ARTIFACT


def _validate_raw_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Validate canonical raw columns, timestamps, and numeric types.

    Parameters
    ----------
    df : pd.DataFrame
        Input telemetry dataframe.

    Returns
    -------
    pd.DataFrame
        A validated copy with defaults filled where permitted (e.g. Asset_Type).
    """
    if not isinstance(df, pd.DataFrame):
        raise ValueError(f"Input must be a pandas DataFrame, got {type(df).__name__}")

    if "Timestamp" not in df.columns:
        raise ValueError("Missing required column: 'Timestamp'")

    # Validate timestamp parseability
    ts_parsed = pd.to_datetime(df["Timestamp"], errors="coerce")
    if ts_parsed.isna().any():
        bad_idx = df.index[ts_parsed.isna()].tolist()
        raise ValueError(f"Timestamp contains unparseable datetime values at indices: {bad_idx}")

    config = get_config()
    telemetry_cols = config.get("telemetry_columns", [
        "Signal_Strength_dBm",
        "Latency_ms",
        "Packet_Loss_pct",
        "Throughput_Mbps",
        "Connected_Users",
        "Traffic_Load_pct",
        "Call_Drop_Rate_pct",
        "Resource_Utilization_pct"
    ])

    missing_cols = [c for c in telemetry_cols if c not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing required telemetry columns: {missing_cols}")

    # Check that all telemetry columns can be converted to float without NaNs
    for col in telemetry_cols:
        converted = pd.to_numeric(df[col], errors="coerce")
        if converted.isna().any():
            bad_indices = df.index[converted.isna()].tolist()
            raise ValueError(f"Column '{col}' contains non-numeric or NaN values at indices: {bad_indices}")

    df_clean = df.copy()
    if "Asset_Type" not in df_clean.columns:
        df_clean["Asset_Type"] = "Unknown"

    return df_clean


def predict_svm(df: pd.DataFrame) -> pd.DataFrame:
    """Predict network risk status using the shipped SVM pipeline.

    Parameters
    ----------
    df : pd.DataFrame
        Input dataframe with canonical telemetry columns and Timestamp.

    Returns
    -------
    pd.DataFrame
        DataFrame with same index containing:
        - risk_label: str ('Normal' or 'At Risk')
        - risk_score: float (probability of positive class [0, 1])
        - is_at_risk: bool (True if positive class)
    """
    df_clean = _validate_raw_dataframe(df)
    config = get_config()
    pipeline = _get_svm_pipeline()

    # Apply deterministic feature engineering
    engineered_df = engineer_features(df_clean)

    num_cols = config["svm_features"]["numeric"]
    cat_cols = config["svm_features"]["categorical"]
    feature_cols = num_cols + cat_cols

    missing_features = [c for c in feature_cols if c not in engineered_df.columns]
    if missing_features:
        raise ValueError(f"Engineered dataframe missing required model features: {missing_features}")

    X = engineered_df[feature_cols]

    preds = pipeline.predict(X)
    probs = pipeline.predict_proba(X)

    # Class 1 is 'At Risk'
    positive_prob = probs[:, 1]
    is_at_risk = preds == 1
    risk_labels = np.where(is_at_risk, config["label"]["positive_class"], config["label"]["negative_class"])

    return pd.DataFrame(
        {
            "risk_label": risk_labels,
            "risk_score": positive_prob,
            "is_at_risk": is_at_risk,
        },
        index=df.index,
    )


def score_dbscan(df: pd.DataFrame) -> pd.DataFrame:
    """Score assets for multivariate telemetry anomalies using scorable DBSCAN.

    Parameters
    ----------
    df : pd.DataFrame
        Input dataframe with canonical telemetry columns and Timestamp.

    Returns
    -------
    pd.DataFrame
        DataFrame with same index containing:
        - dbscan_cluster: int (-1 for anomaly, >= 0 for dense cluster id)
        - is_anomaly: bool (True if distance to nearest core sample > eps)
        - nearest_core_distance: float (Euclidean distance in scaled telemetry space)
    """
    df_clean = _validate_raw_dataframe(df)
    artifact = _get_dbscan_artifact()

    features = artifact["features"]
    scaler = artifact["scaler"]
    nn = artifact.get("core_nn") if "core_nn" in artifact else artifact.get("nn")
    core_labels = artifact["core_labels"]
    eps = artifact["eps"]

    missing = [c for c in features if c not in df_clean.columns]
    if missing:
        raise ValueError(f"Missing required telemetry columns for DBSCAN: {missing}")

    X_base = df_clean[features].astype(float).values
    X_scaled = scaler.transform(X_base)

    distances, indices = nn.kneighbors(X_scaled)
    nearest_dist = distances.flatten()
    nearest_idx = indices.flatten()
    nearest_cluster = core_labels[nearest_idx]

    is_anomaly = nearest_dist > eps
    dbscan_cluster = np.where(is_anomaly, -1, nearest_cluster).astype(int)

    return pd.DataFrame(
        {
            "dbscan_cluster": dbscan_cluster,
            "is_anomaly": is_anomaly,
            "nearest_core_distance": nearest_dist.astype(float),
        },
        index=df.index,
    )


def threshold_breaches(row: Union[pd.Series, Dict[str, Any], pd.DataFrame]) -> List[Dict[str, Any]]:
    """Evaluate SLA threshold breaches for an asset record.

    Rule-based text evaluation against config.label.clauses.
    This is rule-based policy auditing and is NEVER presented as a model explanation.

    Parameters
    ----------
    row : pd.Series, dict, or single-row pd.DataFrame
        Telemetry values for an asset.

    Returns
    -------
    list of dict
        Each dict contains: {metric, value, limit, operator, message}
    """
    if isinstance(row, pd.DataFrame):
        if len(row) != 1:
            raise ValueError(f"threshold_breaches expects a single record, got {len(row)} rows")
        row_dict = row.iloc[0].to_dict()
    elif isinstance(row, pd.Series):
        row_dict = row.to_dict()
    elif isinstance(row, dict):
        row_dict = dict(row)
    else:
        raise ValueError(f"Unsupported row type: {type(row).__name__}")

    config = get_config()

    # Ensure required engineered metrics are available if not pre-computed
    if "Network_Stress_Index" not in row_dict or pd.isna(row_dict.get("Network_Stress_Index")):
        load = float(row_dict.get("Traffic_Load_pct", 0.0))
        util = float(row_dict.get("Resource_Utilization_pct", 0.0))
        pl = float(row_dict.get("Packet_Loss_pct", 0.0))
        cd = float(row_dict.get("Call_Drop_Rate_pct", 0.0))
        row_dict["Network_Stress_Index"] = (load + util + pl + cd) / 4.0

    if "Signal_Quality_Score" not in row_dict or pd.isna(row_dict.get("Signal_Quality_Score")):
        sig = float(row_dict.get("Signal_Strength_dBm", -105.0))
        scaled_sig = ((sig + 105.0) / 50.0) * 100.0
        row_dict["Signal_Quality_Score"] = float(np.clip(scaled_sig, 0.0, 100.0))

    breaches: List[Dict[str, Any]] = []
    clauses = config.get("label", {}).get("clauses", [])

    for clause in clauses:
        metric = clause["metric"]
        op = clause["op"]
        limit = float(clause["limit"])
        message = clause["message"]

        if metric not in row_dict:
            continue

        val = float(row_dict[metric])
        is_breach = False

        if op == ">" and val > limit:
            is_breach = True
        elif op == "<" and val < limit:
            is_breach = True
        elif op == ">=" and val >= limit:
            is_breach = True
        elif op == "<=" and val <= limit:
            is_breach = True
        elif op == "==" and val == limit:
            is_breach = True

        if is_breach:
            breaches.append(
                {
                    "metric": metric,
                    "value": round(val, 4),
                    "limit": limit,
                    "operator": op,
                    "message": message,
                }
            )

    return breaches
