"""Robust Telemetry Ingestion and Normalization Engine for NEXUSNET.

Provides a unified validator and processing pipeline used by:
- CSV bulk upload endpoint (/api/ingest/csv)
- Single-record prediction & ingestion endpoint (/api/predict)
- Database seeding script (python -m backend.app.seed)
"""
from __future__ import annotations

import io
import json
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple

import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.models import Asset, Incident, IncidentEvent, IngestionLog, Reading
from backend.app.status_policy import compute_status_vectorized, determine_status_single
from backend.ml.features import engineer_features
from backend.ml.inference import (
    get_config,
    get_model_card,
    predict_svm,
    score_dbscan,
    threshold_breaches,
)

# Canonical raw dataset columns
CANONICAL_COLUMNS = [
    "Asset_ID",
    "Asset_Type",
    "Continent",
    "Country",
    "City",
    "Region",
    "Latitude",
    "Longitude",
    "Signal_Strength_dBm",
    "Latency_ms",
    "Packet_Loss_pct",
    "Throughput_Mbps",
    "Connected_Users",
    "Traffic_Load_pct",
    "Call_Drop_Rate_pct",
    "Resource_Utilization_pct",
    "Timestamp",
]

BASE_TELEMETRY_COLUMNS = [
    "Signal_Strength_dBm",
    "Latency_ms",
    "Packet_Loss_pct",
    "Throughput_Mbps",
    "Connected_Users",
    "Traffic_Load_pct",
    "Call_Drop_Rate_pct",
    "Resource_Utilization_pct",
]

PERCENTAGE_COLUMNS = [
    "Packet_Loss_pct",
    "Traffic_Load_pct",
    "Call_Drop_Rate_pct",
    "Resource_Utilization_pct",
]

TELEMETRY_RANGES: Dict[str, Dict[str, Any]] = {
    "Signal_Strength_dBm": {"min": -140.0, "max": -30.0, "type": "float"},
    "Latency_ms": {"min": 0.0, "max": 10000.0, "type": "float"},
    "Packet_Loss_pct": {"min": 0.0, "max": 100.0, "type": "float"},
    "Throughput_Mbps": {"min": 0.0, "max": 100000.0, "type": "float"},
    "Connected_Users": {"min": 0, "max": 1000000, "type": "int"},
    "Traffic_Load_pct": {"min": 0.0, "max": 100.0, "type": "float"},
    "Call_Drop_Rate_pct": {"min": 0.0, "max": 100.0, "type": "float"},
    "Resource_Utilization_pct": {"min": 0.0, "max": 100.0, "type": "float"},
    "Latitude": {"min": -90.0, "max": 90.0, "type": "float"},
    "Longitude": {"min": -180.0, "max": 180.0, "type": "float"},
}

COLUMN_ALIAS_MAP: Dict[str, str] = {
    # Asset identity & metadata
    "asset_id": "Asset_ID",
    "id": "Asset_ID",
    "asset": "Asset_ID",
    "node_id": "Asset_ID",
    "device_id": "Asset_ID",
    "asset_type": "Asset_Type",
    "type": "Asset_Type",
    "node_type": "Asset_Type",
    "device_type": "Asset_Type",
    "continent": "Continent",
    "country": "Country",
    "city": "City",
    "region": "Region",
    "state": "Region",
    "province": "Region",
    "latitude": "Latitude",
    "lat": "Latitude",
    "longitude": "Longitude",
    "lng": "Longitude",
    "lon": "Longitude",
    "long": "Longitude",
    "timestamp": "Timestamp",
    "time": "Timestamp",
    "datetime": "Timestamp",
    "date_time": "Timestamp",
    "date": "Timestamp",
    # Telemetry
    "signal_strength": "Signal_Strength_dBm",
    "signal_strength_dbm": "Signal_Strength_dBm",
    "signal": "Signal_Strength_dBm",
    "rsrp": "Signal_Strength_dBm",
    "rssi": "Signal_Strength_dBm",
    "latency": "Latency_ms",
    "latency_ms": "Latency_ms",
    "rtt": "Latency_ms",
    "ping": "Latency_ms",
    "packet_loss": "Packet_Loss_pct",
    "packet_loss_pct": "Packet_Loss_pct",
    "loss": "Packet_Loss_pct",
    "drop_loss": "Packet_Loss_pct",
    "throughput": "Throughput_Mbps",
    "throughput_mbps": "Throughput_Mbps",
    "bandwidth": "Throughput_Mbps",
    "speed": "Throughput_Mbps",
    "data_rate": "Throughput_Mbps",
    "connected_users": "Connected_Users",
    "users": "Connected_Users",
    "active_users": "Connected_Users",
    "subscribers": "Connected_Users",
    "clients": "Connected_Users",
    "traffic_load": "Traffic_Load_pct",
    "traffic_load_pct": "Traffic_Load_pct",
    "traffic": "Traffic_Load_pct",
    "load": "Traffic_Load_pct",
    "call_drop_rate": "Call_Drop_Rate_pct",
    "call_drop_rate_pct": "Call_Drop_Rate_pct",
    "call_drop": "Call_Drop_Rate_pct",
    "dropped_calls": "Call_Drop_Rate_pct",
    "resource_utilization": "Resource_Utilization_pct",
    "resource_utilization_pct": "Resource_Utilization_pct",
    "resource_util": "Resource_Utilization_pct",
    "utilization": "Resource_Utilization_pct",
    "cpu_memory_util": "Resource_Utilization_pct",
}


def normalize_header(header: str) -> str:
    """Normalize a column header name to canonical form using alias mapping."""
    clean = header.strip().lower()
    # Replace spaces, hyphens, and parentheses with underscores
    clean = re.sub(r"[\s\-\(\)\[\]/]+", "_", clean).strip("_")
    # Strip unit suffix tokens like _ms, _dbm, _pct, _mbps for initial matching lookup
    if clean in COLUMN_ALIAS_MAP:
        return COLUMN_ALIAS_MAP[clean]

    stripped = re.sub(r"(_ms|_dbm|_pct|_mbps|_kbps|_percent)$", "", clean)
    if stripped in COLUMN_ALIAS_MAP:
        return COLUMN_ALIAS_MAP[stripped]

    return clean


def parse_csv_to_dataframe(csv_bytes: bytes) -> Tuple[pd.DataFrame, List[str]]:
    """Parse CSV bytes into a DataFrame with normalized column headers."""
    warnings: List[str] = []
    # Handle UTF-8 BOM
    decoded = csv_bytes.decode("utf-8-sig", errors="replace")
    df = pd.read_csv(io.StringIO(decoded))

    # Rename headers through alias mapping
    renamed_cols = {}
    unknown_cols = []
    for col in df.columns:
        canonical = normalize_header(str(col))
        if canonical in CANONICAL_COLUMNS:
            renamed_cols[col] = canonical
        else:
            renamed_cols[col] = col
            unknown_cols.append(str(col))

    if unknown_cols:
        warnings.append(f"Ignored unknown columns: {unknown_cols}")

    df = df.rename(columns=renamed_cols)
    return df, warnings


def validate_and_prepare_records(
    df: pd.DataFrame,
    impute: bool = False,
    existing_asset_ids: Optional[Set[str]] = None,
) -> Tuple[pd.DataFrame, List[Dict[str, Any]], List[str], int, int]:
    """Validate DataFrame rows against telemetry schema and range constraints.

    Returns:
    --------
    Tuple of:
    - valid_df: DataFrame of accepted rows ready for ML inference
    - rejected_rows: list of {"row": int, "reasons": list[str]}
    - warnings: list of warning strings
    - imputed_count: number of rows where telemetry values were imputed
    - unlocated_count: number of accepted rows missing geolocation
    """
    warnings: List[str] = []
    rejected_rows: List[Dict[str, Any]] = []
    card = get_model_card()
    medians = card.get("training_medians", {})
    existing_assets = existing_asset_ids or set()

    # Check for fraction warning (e.g., values <= 1.0 in percentage columns)
    for col in PERCENTAGE_COLUMNS:
        if col in df.columns:
            series = pd.to_numeric(df[col], errors="coerce").dropna()
            if len(series) > 0 and (series <= 1.0).all() and (series.max() > 0.0):
                warnings.append(
                    f"Column '{col}' has all values <= 1.0 (looks like fractions, not percentages)."
                )

    accepted_records: List[Dict[str, Any]] = []
    imputed_count = 0
    unlocated_count = 0

    for idx, row in df.iterrows():
        row_num = idx + 1
        reasons = []
        record: Dict[str, Any] = {}

        # 1. Asset ID
        raw_asset_id = row.get("Asset_ID")
        if pd.isna(raw_asset_id) or str(raw_asset_id).strip() == "":
            reasons.append(f"Missing required 'Asset_ID' at row {row_num}")
            rejected_rows.append({"row": row_num, "reasons": reasons})
            continue
        record["Asset_ID"] = str(raw_asset_id).strip()

        # 2. Timestamp
        raw_ts = row.get("Timestamp")
        if pd.isna(raw_ts) or str(raw_ts).strip() == "":
            record["Timestamp"] = pd.Timestamp.now()
        else:
            try:
                parsed_ts = pd.to_datetime(raw_ts)
                if pd.isna(parsed_ts):
                    reasons.append(f"Invalid timestamp '{raw_ts}' at row {row_num}")
                else:
                    record["Timestamp"] = parsed_ts
            except Exception:
                reasons.append(f"Unparseable timestamp '{raw_ts}' at row {row_num}")

        # 3. Telemetry columns & Imputation
        row_imputed = False
        for col in BASE_TELEMETRY_COLUMNS:
            val = row.get(col)
            spec = TELEMETRY_RANGES[col]

            if pd.isna(val) or val is None or str(val).strip() == "":
                if impute and col in medians:
                    record[col] = float(medians[col]) if spec["type"] == "float" else int(round(medians[col]))
                    row_imputed = True
                else:
                    reasons.append(f"Missing telemetry column '{col}' at row {row_num}")
                continue

            try:
                if spec["type"] == "int":
                    num_val = int(round(float(val)))
                else:
                    num_val = float(val)

                if num_val < spec["min"] or num_val > spec["max"]:
                    reasons.append(
                        f"Out-of-range value {num_val} for '{col}' (expected [{spec['min']}, {spec['max']}]) at row {row_num}"
                    )
                else:
                    record[col] = num_val
            except Exception:
                reasons.append(f"Non-numeric value '{val}' for '{col}' at row {row_num}")

        # 4. Geolocation coordinates
        raw_lat = row.get("Latitude")
        raw_lng = row.get("Longitude")
        lat_val = None
        lng_val = None

        if not pd.isna(raw_lat) and str(raw_lat).strip() != "":
            try:
                lat_float = float(raw_lat)
                if -90.0 <= lat_float <= 90.0:
                    lat_val = lat_float
                else:
                    reasons.append(f"Latitude {lat_float} outside [-90, 90] at row {row_num}")
            except Exception:
                reasons.append(f"Non-numeric Latitude '{raw_lat}' at row {row_num}")

        if not pd.isna(raw_lng) and str(raw_lng).strip() != "":
            try:
                lng_float = float(raw_lng)
                if -180.0 <= lng_float <= 180.0:
                    lng_val = lng_float
                else:
                    reasons.append(f"Longitude {lng_float} outside [-180, 180] at row {row_num}")
            except Exception:
                reasons.append(f"Non-numeric Longitude '{raw_lng}' at row {row_num}")

        record["Latitude"] = lat_val
        record["Longitude"] = lng_val

        # Count unlocated assets
        if lat_val is None or lng_val is None:
            if record["Asset_ID"] not in existing_assets:
                unlocated_count += 1

        # 5. Metadata fields
        record["Asset_Type"] = (
            str(row.get("Asset_Type")).strip()
            if not pd.isna(row.get("Asset_Type")) and str(row.get("Asset_Type")).strip() != ""
            else "Unknown"
        )
        record["Continent"] = (
            str(row.get("Continent")).strip() if not pd.isna(row.get("Continent")) else None
        )
        record["Country"] = (
            str(row.get("Country")).strip() if not pd.isna(row.get("Country")) else None
        )
        record["City"] = str(row.get("City")).strip() if not pd.isna(row.get("City")) else None
        record["Region"] = str(row.get("Region")).strip() if not pd.isna(row.get("Region")) else None

        if reasons:
            rejected_rows.append({"row": row_num, "reasons": reasons})
        else:
            accepted_records.append(record)
            if row_imputed:
                imputed_count += 1

    valid_df = pd.DataFrame(accepted_records)
    return valid_df, rejected_rows, warnings, imputed_count, unlocated_count


def process_ingestion(
    db: Session,
    raw_df: pd.DataFrame,
    filename: str,
    source: str = "csv",
    impute: bool = False,
    dry_run: bool = False,
) -> Dict[str, Any]:
    """Execute complete ingestion pipeline: validation, inference, persistence, and auto-incidents.

    Returns full ingestion report dictionary.
    """
    rows_total = len(raw_df)
    existing_asset_ids = set(db.scalars(select(Asset.asset_id)).all())

    # 1. Validation
    valid_df, rejected_rows, warnings, imputed_count, unlocated_count = validate_and_prepare_records(
        raw_df, impute=impute, existing_asset_ids=existing_asset_ids
    )

    if valid_df.empty:
        return {
            "ingestion_id": None,
            "filename": filename,
            "rows_total": rows_total,
            "accepted": 0,
            "rejected": len(rejected_rows),
            "imputed": 0,
            "updated": 0,
            "duplicates_in_file": 0,
            "unlocated": 0,
            "warnings": warnings,
            "rejected_rows": rejected_rows[:500],
            "risk_summary": {
                "at_risk": 0,
                "anomalies": 0,
                "status_counts": {"green": 0, "yellow": 0, "purple": 0, "red": 0},
            },
        }

    # 2. In-file Deduplication: keep last reading for (Asset_ID, Timestamp)
    initial_valid_count = len(valid_df)
    valid_df = valid_df.drop_duplicates(subset=["Asset_ID", "Timestamp"], keep="last").reset_index(
        drop=True
    )
    duplicates_in_file = initial_valid_count - len(valid_df)

    # 3. Vectorized ML Feature Engineering and Model Inference
    # Model contract: canonical raw columns passed into engineer_features, predict_svm, score_dbscan
    engineered = engineer_features(valid_df)
    svm_preds = predict_svm(valid_df)
    dbscan_preds = score_dbscan(valid_df)

    # Attach model inference outputs
    valid_df["Hour"] = engineered["Hour"]
    valid_df["Peak_Hour"] = engineered["Peak_Hour"]
    valid_df["Network_Stress_Index"] = engineered["Network_Stress_Index"]
    valid_df["Signal_Quality_Score"] = engineered["Signal_Quality_Score"]
    valid_df["Throughput_per_User"] = engineered["Throughput_per_User"]

    valid_df["risk_label"] = svm_preds["risk_label"]
    valid_df["risk_score"] = svm_preds["risk_score"]
    valid_df["is_at_risk"] = svm_preds["is_at_risk"]

    valid_df["dbscan_cluster"] = dbscan_preds["dbscan_cluster"]
    valid_df["is_anomaly"] = dbscan_preds["is_anomaly"]
    valid_df["nearest_core_distance"] = dbscan_preds["nearest_core_distance"]

    # Compute Status with strict precedence
    valid_df["status"] = compute_status_vectorized(valid_df)

    card = get_model_card()
    model_version = card.get("model_version", "2.0.0-2026-10-14")

    # Risk Summary Calculation
    status_counts_map = valid_df["status"].value_counts().to_dict()
    status_counts = {
        "green": int(status_counts_map.get("green", 0)),
        "yellow": int(status_counts_map.get("yellow", 0)),
        "purple": int(status_counts_map.get("purple", 0)),
        "red": int(status_counts_map.get("red", 0)),
    }
    at_risk_count = int(valid_df["is_at_risk"].sum())
    anomalies_count = int(valid_df["is_anomaly"].sum())

    if dry_run:
        return {
            "ingestion_id": None,
            "filename": filename,
            "rows_total": rows_total,
            "accepted": len(valid_df),
            "rejected": len(rejected_rows),
            "imputed": imputed_count,
            "updated": 0,
            "duplicates_in_file": duplicates_in_file,
            "unlocated": unlocated_count,
            "warnings": warnings,
            "rejected_rows": rejected_rows[:500],
            "risk_summary": {
                "at_risk": at_risk_count,
                "anomalies": anomalies_count,
                "status_counts": status_counts,
            },
        }

    # 4. Persistence in Single DB Transaction
    ingestion_log = IngestionLog(
        filename=filename,
        source=source,
        rows_total=rows_total,
        accepted=len(valid_df),
        rejected=len(rejected_rows),
        imputed=imputed_count,
        updated=0,  # Will increment as we find existing readings
        duplicates_in_file=duplicates_in_file,
    )
    db.add(ingestion_log)
    db.flush()

    updated_count = 0
    now = datetime.utcnow()

    # Pre-fetch existing assets and existing readings in batch
    asset_ids_in_batch = list(valid_df["Asset_ID"].unique())
    existing_assets_query = db.scalars(
        select(Asset).where(Asset.asset_id.in_(asset_ids_in_batch))
    ).all()
    assets_map = {a.asset_id: a for a in existing_assets_query}

    # Find existing readings in batch
    existing_readings_query = db.scalars(
        select(Reading).where(Reading.asset_id.in_(asset_ids_in_batch))
    ).all()
    existing_readings_map = {
        (r.asset_id, r.timestamp): r for r in existing_readings_query
    }

    # Pre-fetch active incidents
    active_incidents_query = db.scalars(
        select(Incident).where(
            Incident.asset_id.in_(asset_ids_in_batch),
            Incident.status.in_(["open", "acknowledged", "assigned", "investigating"]),
        )
    ).all()
    active_incidents_map = {inc.asset_id: inc for inc in active_incidents_query}

    readings_to_add: List[Reading] = []
    asset_latest_readings: Dict[str, Tuple[datetime, Reading]] = {}

    for _, row in valid_df.iterrows():
        aid = row["Asset_ID"]
        ts = row["Timestamp"]

        # Ensure asset exists
        if aid in assets_map:
            asset = assets_map[aid]
            # Update location if provided non-null values
            if row["Latitude"] is not None and row["Longitude"] is not None:
                asset.latitude = float(row["Latitude"])
                asset.longitude = float(row["Longitude"])
            if row["Asset_Type"] != "Unknown" and asset.asset_type == "Unknown":
                asset.asset_type = row["Asset_Type"]
            if row["Continent"] and not asset.continent:
                asset.continent = row["Continent"]
            if row["Country"] and not asset.country:
                asset.country = row["Country"]
            if row["City"] and not asset.city:
                asset.city = row["City"]
            if row["Region"] and not asset.region:
                asset.region = row["Region"]
            asset.updated_at = now
        else:
            asset = Asset(
                asset_id=aid,
                asset_type=row["Asset_Type"],
                continent=row["Continent"],
                country=row["Country"],
                city=row["City"],
                region=row["Region"],
                latitude=float(row["Latitude"]) if row["Latitude"] is not None else None,
                longitude=float(row["Longitude"]) if row["Longitude"] is not None else None,
                created_at=now,
                updated_at=now,
            )
            db.add(asset)
            assets_map[aid] = asset

        reading_key = (aid, ts)
        if reading_key in existing_readings_map:
            # Upsert on (asset_id, timestamp)
            reading = existing_readings_map[reading_key]
            reading.signal_strength_dbm = float(row["Signal_Strength_dBm"])
            reading.latency_ms = float(row["Latency_ms"])
            reading.packet_loss_pct = float(row["Packet_Loss_pct"])
            reading.throughput_mbps = float(row["Throughput_Mbps"])
            reading.connected_users = int(row["Connected_Users"])
            reading.traffic_load_pct = float(row["Traffic_Load_pct"])
            reading.call_drop_rate_pct = float(row["Call_Drop_Rate_pct"])
            reading.resource_utilization_pct = float(row["Resource_Utilization_pct"])
            reading.peak_hour = int(row["Peak_Hour"])
            reading.network_stress_index = float(row["Network_Stress_Index"])
            reading.signal_quality_score = float(row["Signal_Quality_Score"])
            reading.throughput_per_user = float(row["Throughput_per_User"])
            reading.risk_label = str(row["risk_label"])
            reading.risk_score = float(row["risk_score"])
            reading.is_at_risk = bool(row["is_at_risk"])
            reading.dbscan_cluster = int(row["dbscan_cluster"])
            reading.is_anomaly = bool(row["is_anomaly"])
            reading.nearest_core_distance = float(row["nearest_core_distance"])
            reading.status = str(row["status"])
            reading.model_version = model_version
            reading.source = source
            reading.ingestion_id = ingestion_log.id
            updated_count += 1
        else:
            reading = Reading(
                asset_id=aid,
                timestamp=ts,
                signal_strength_dbm=float(row["Signal_Strength_dBm"]),
                latency_ms=float(row["Latency_ms"]),
                packet_loss_pct=float(row["Packet_Loss_pct"]),
                throughput_mbps=float(row["Throughput_Mbps"]),
                connected_users=int(row["Connected_Users"]),
                traffic_load_pct=float(row["Traffic_Load_pct"]),
                call_drop_rate_pct=float(row["Call_Drop_Rate_pct"]),
                resource_utilization_pct=float(row["Resource_Utilization_pct"]),
                peak_hour=int(row["Peak_Hour"]),
                network_stress_index=float(row["Network_Stress_Index"]),
                signal_quality_score=float(row["Signal_Quality_Score"]),
                throughput_per_user=float(row["Throughput_per_User"]),
                risk_label=str(row["risk_label"]),
                risk_score=float(row["risk_score"]),
                is_at_risk=bool(row["is_at_risk"]),
                dbscan_cluster=int(row["dbscan_cluster"]),
                is_anomaly=bool(row["is_anomaly"]),
                nearest_core_distance=float(row["nearest_core_distance"]),
                status=str(row["status"]),
                model_version=model_version,
                source=source,
                ingestion_id=ingestion_log.id,
                created_at=now,
            )
            readings_to_add.append(reading)
            existing_readings_map[reading_key] = reading

        # Track latest reading per asset
        if aid not in asset_latest_readings or ts >= asset_latest_readings[aid][0]:
            asset_latest_readings[aid] = (ts, reading)

    if readings_to_add:
        db.add_all(readings_to_add)
    db.flush()

    # Update asset latest_reading_id
    for aid, (_, reading) in asset_latest_readings.items():
        asset = assets_map[aid]
        asset.latest_reading_id = reading.id

    # 5. Auto-Incident Management (Skip during seed if source == 'seed')
    if source != "seed":
        for aid, (_, reading) in asset_latest_readings.items():
            if reading.is_at_risk or reading.is_anomaly:
                if aid not in active_incidents_map:
                    # Determine severity
                    if (reading.is_at_risk and reading.is_anomaly) or reading.risk_score >= 0.9:
                        severity = "critical"
                    elif reading.is_at_risk:
                        severity = "high"
                    else:
                        severity = "medium"

                    title = f"Operational Risk/Anomaly Incident for {aid}"
                    new_incident = Incident(
                        asset_id=aid,
                        reading_id=reading.id,
                        severity=severity,
                        title=title,
                        status="open",
                        source="auto",
                        created_at=now,
                        updated_at=now,
                    )
                    db.add(new_incident)
                    db.flush()

                    event = IncidentEvent(
                        incident_id=new_incident.id,
                        ts=now,
                        actor="system",
                        action="opened",
                        note="Incident opened automatically by telemetry ingestion",
                        to_status="open",
                    )
                    db.add(event)
                    active_incidents_map[aid] = new_incident
            else:
                # If latest reading is back to green and active incident exists, log event
                if reading.status == "green" and aid in active_incidents_map:
                    inc = active_incidents_map[aid]
                    event = IncidentEvent(
                        incident_id=inc.id,
                        ts=now,
                        actor="system",
                        action="status_check",
                        note="Latest reading back to normal",
                        from_status=inc.status,
                        to_status=inc.status,
                    )
                    db.add(event)

    ingestion_log.updated = updated_count
    report_dict = {
        "ingestion_id": ingestion_log.id,
        "filename": filename,
        "rows_total": rows_total,
        "accepted": len(valid_df),
        "rejected": len(rejected_rows),
        "imputed": imputed_count,
        "updated": updated_count,
        "duplicates_in_file": duplicates_in_file,
        "unlocated": unlocated_count,
        "warnings": warnings,
        "rejected_rows": rejected_rows[:500],
        "risk_summary": {
            "at_risk": at_risk_count,
            "anomalies": anomalies_count,
            "status_counts": status_counts,
        },
    }
    ingestion_log.report_json = json.dumps(report_dict)

    db.commit()
    return report_dict
