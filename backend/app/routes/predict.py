"""Single record prediction and interactive telemetry ingestion route."""
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Query
import pandas as pd
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.ingestion import (
    normalize_header,
    process_ingestion,
    validate_and_prepare_records,
)
from backend.app.models import Asset, Reading
from backend.app.schemas import PredictResponse
from backend.app.status_policy import determine_status_single
from backend.app.utils import reading_to_response
from backend.ml.features import engineer_features
from backend.ml.inference import (
    get_model_card,
    predict_svm,
    score_dbscan,
    threshold_breaches,
)

router = APIRouter(tags=["Predict"])


@router.post("/predict", response_model=PredictResponse)
def predict_record(
    payload: Dict[str, Any],
    persist: bool = Query(False, description="Persist record to database and update asset state"),
    impute: bool = Query(False, description="Impute missing telemetry metrics from training medians"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Score a single telemetry asset record.

    Accepts canonical or snake_case / aliased column names.
    - If persist=False: preview mode. Asset_ID defaults to 'PREVIEW' if omitted.
    - If persist=True: requires Asset_ID and commits reading to the database.
    """
    # 1. Normalize headers through alias table
    normalized_row: Dict[str, Any] = {}
    for k, v in payload.items():
        canonical_key = normalize_header(k)
        normalized_row[canonical_key] = v

    # Auto-use 'PREVIEW' if Asset_ID is missing in preview mode
    if not persist and ("Asset_ID" not in normalized_row or not str(normalized_row["Asset_ID"]).strip()):
        normalized_row["Asset_ID"] = "PREVIEW"

    if persist and ("Asset_ID" not in normalized_row or not str(normalized_row["Asset_ID"]).strip()):
        raise HTTPException(
            status_code=422,
            detail={
                "detail": "Asset_ID is required when persist=True",
                "code": "MISSING_ASSET_ID",
                "errors": ["Asset_ID cannot be empty when persisting a record."],
            },
        )

    # 2. Validate using the unified validator
    input_df = pd.DataFrame([normalized_row])
    valid_df, rejected_rows, warnings, imputed_count, unlocated_count = validate_and_prepare_records(
        input_df, impute=impute
    )

    if rejected_rows or valid_df.empty:
        error_reasons = rejected_rows[0]["reasons"] if rejected_rows else ["Validation failed"]
        raise HTTPException(
            status_code=422,
            detail={
                "detail": "Telemetry record validation failed",
                "code": "VALIDATION_ERROR",
                "errors": error_reasons,
            },
        )

    imputed_fields = []
    if imputed_count > 0:
        card = get_model_card()
        medians = card.get("training_medians", {})
        for col in medians:
            if col not in normalized_row or normalized_row[col] is None:
                imputed_fields.append(col)

    if persist:
        # Use full ingestion pipeline
        report = process_ingestion(
            db=db,
            raw_df=valid_df,
            filename="single_predict_payload",
            source="manual",
            impute=impute,
            dry_run=False,
        )

        aid = valid_df.iloc[0]["Asset_ID"]
        ts = valid_df.iloc[0]["Timestamp"]
        reading_orm = (
            db.query(Reading)
            .filter(Reading.asset_id == aid, Reading.timestamp == ts)
            .first()
        )
        if not reading_orm:
            reading_orm = (
                db.query(Reading).filter(Reading.asset_id == aid).order_by(Reading.id.desc()).first()
            )

        reading_schema = reading_to_response(reading_orm)
        try:
            from backend.app.routes.streaming import broadcast_telemetry_event_sync
            broadcast_telemetry_event_sync({
                "asset_id": reading_schema.asset_id,
                "status": reading_schema.status,
                "risk_score": reading_schema.risk_score,
                "is_at_risk": reading_schema.is_at_risk,
                "is_anomaly": reading_schema.is_anomaly,
                "latency_ms": reading_schema.latency_ms,
                "traffic_load_pct": reading_schema.traffic_load_pct,
                "city": reading_schema.city,
                "timestamp": reading_schema.timestamp.isoformat(),
            })
        except Exception:
            pass

        return {
            "reading": reading_schema,
            "validation": {
                "warnings": warnings,
                "imputed": imputed_fields,
            },
        }

    # Dry-run Preview: vectorized inference in memory without DB persistence
    engineered = engineer_features(valid_df)
    svm_preds = predict_svm(valid_df)
    dbscan_preds = score_dbscan(valid_df)

    row0 = valid_df.iloc[0]
    eng0 = engineered.iloc[0]
    svm0 = svm_preds.iloc[0]
    db0 = dbscan_preds.iloc[0]

    eval_dict = {
        "Signal_Strength_dBm": float(row0["Signal_Strength_dBm"]),
        "Latency_ms": float(row0["Latency_ms"]),
        "Packet_Loss_pct": float(row0["Packet_Loss_pct"]),
        "Throughput_Mbps": float(row0["Throughput_Mbps"]),
        "Connected_Users": int(row0["Connected_Users"]),
        "Traffic_Load_pct": float(row0["Traffic_Load_pct"]),
        "Call_Drop_Rate_pct": float(row0["Call_Drop_Rate_pct"]),
        "Resource_Utilization_pct": float(row0["Resource_Utilization_pct"]),
        "Network_Stress_Index": float(eng0["Network_Stress_Index"]),
        "Signal_Quality_Score": float(eng0["Signal_Quality_Score"]),
        "Throughput_per_User": float(eng0["Throughput_per_User"]),
    }

    status_str = determine_status_single(bool(svm0["is_at_risk"]), bool(db0["is_anomaly"]), eval_dict)
    breaches = threshold_breaches(eval_dict)
    card = get_model_card()

    reading_dict = {
        "asset_id": str(row0["Asset_ID"]),
        "asset_type": str(row0.get("Asset_Type", "Unknown")),
        "continent": str(row0.get("Continent")) if row0.get("Continent") is not None else None,
        "country": str(row0.get("Country")) if row0.get("Country") is not None else None,
        "city": str(row0.get("City")) if row0.get("City") is not None else None,
        "region": str(row0.get("Region")) if row0.get("Region") is not None else None,
        "latitude": float(row0["Latitude"]) if row0.get("Latitude") is not None else None,
        "longitude": float(row0["Longitude"]) if row0.get("Longitude") is not None else None,
        "timestamp": pd.to_datetime(row0["Timestamp"]),
        "signal_strength_dbm": float(row0["Signal_Strength_dBm"]),
        "latency_ms": float(row0["Latency_ms"]),
        "packet_loss_pct": float(row0["Packet_Loss_pct"]),
        "throughput_mbps": float(row0["Throughput_Mbps"]),
        "connected_users": int(row0["Connected_Users"]),
        "traffic_load_pct": float(row0["Traffic_Load_pct"]),
        "call_drop_rate_pct": float(row0["Call_Drop_Rate_pct"]),
        "resource_utilization_pct": float(row0["Resource_Utilization_pct"]),
        "peak_hour": int(eng0["Peak_Hour"]),
        "network_stress_index": float(eng0["Network_Stress_Index"]),
        "signal_quality_score": float(eng0["Signal_Quality_Score"]),
        "throughput_per_user": float(eng0["Throughput_per_User"]),
        "risk_label": str(svm0["risk_label"]),
        "risk_score": float(svm0["risk_score"]),
        "is_at_risk": bool(svm0["is_at_risk"]),
        "dbscan_cluster": int(db0["dbscan_cluster"]),
        "is_anomaly": bool(db0["is_anomaly"]),
        "nearest_core_distance": float(db0["nearest_core_distance"]),
        "status": status_str,
        "threshold_breaches": breaches,
        "model_version": card.get("model_version", "2.0.0-2026-10-14"),
        "source": "manual",
    }

    return {
        "reading": reading_dict,
        "validation": {
            "warnings": warnings,
            "imputed": imputed_fields,
        },
    }
