"""Health, configuration, and model card routes."""
from typing import Any, Dict
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.ingestion import (
    BASE_TELEMETRY_COLUMNS,
    CANONICAL_COLUMNS,
    TELEMETRY_RANGES,
)
from backend.app.models import Asset, Reading
from backend.app.schemas import HealthResponse
from backend.app.status_policy import STATUS_LEGEND
from backend.ml.inference import get_config, get_model_card

router = APIRouter(tags=["Health & Config"])


@router.get("/health", response_model=HealthResponse)
def get_health(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """System health check and database statistics."""
    card = get_model_card()
    model_version = card.get("model_version", "2.0.0-2026-10-14")

    readings_count = db.scalar(select(func.count(Reading.id))) or 0
    assets_count = db.scalar(select(func.count(Asset.asset_id))) or 0

    return {
        "status": "ok",
        "model_version": model_version,
        "db_readings": readings_count,
        "db_assets": assets_count,
        "models_loaded": True,
    }


@router.get("/config")
def get_system_config() -> Dict[str, Any]:
    """Canonical system configuration, thresholds, feature sets, ranges, and status legend."""
    cfg = get_config()

    return {
        "version": cfg.get("version", "2.0.0"),
        "decision": cfg.get("decision", {}),
        "label": cfg.get("label", {}),
        "svm_features": cfg.get("svm_features", {}),
        "dbscan": cfg.get("dbscan", {}),
        "ranges": TELEMETRY_RANGES,
        "status_legend": STATUS_LEGEND,
        "required_columns": ["Asset_ID"] + BASE_TELEMETRY_COLUMNS,
        "optional_columns": [
            "Asset_Type",
            "Continent",
            "Country",
            "City",
            "Region",
            "Latitude",
            "Longitude",
            "Timestamp",
        ],
        "dataset_note": "synthetic, single day (2026-09-16), generator unavailable",
    }


@router.get("/model/card")
def get_model_card_route() -> Dict[str, Any]:
    """Return the trained model card metadata and performance limitations."""
    return get_model_card()
