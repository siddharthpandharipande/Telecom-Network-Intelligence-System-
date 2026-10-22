"""Overview statistics and executive dashboard metrics."""
from typing import Any, Dict, List
from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.models import Asset, Incident, IngestionLog, Reading
from backend.ml.inference import get_model_card

router = APIRouter(prefix="/stats", tags=["Statistics"])


@router.get("/overview")
def get_stats_overview(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Calculate executive NOC summary metrics computed dynamically from the database."""
    card = get_model_card()
    model_version = card.get("model_version", "2.0.0-2026-10-14")

    total_assets = db.scalar(select(func.count(Asset.asset_id))) or 0
    total_readings = db.scalar(select(func.count(Reading.id))) or 0

    located_assets = (
        db.scalar(
            select(func.count(Asset.asset_id)).where(
                Asset.latitude.is_not(None), Asset.longitude.is_not(None)
            )
        )
        or 0
    )
    unlocated_assets = total_assets - located_assets

    # Compute status and risk counts on latest readings
    latest_readings_subq = (
        select(Reading)
        .join(Asset, Asset.latest_reading_id == Reading.id)
        .subquery()
    )

    status_query = select(
        latest_readings_subq.c.status, func.count()
    ).group_by(latest_readings_subq.c.status)
    status_results = db.execute(status_query).all()
    status_counts = {"green": 0, "yellow": 0, "purple": 0, "red": 0}
    for stat, cnt in status_results:
        if stat in status_counts:
            status_counts[stat] = cnt

    # Risk counts
    at_risk_count = (
        db.scalar(
            select(func.count()).where(latest_readings_subq.c.is_at_risk == True)  # noqa: E712
        )
        or 0
    )
    normal_count = total_assets - at_risk_count
    risk_counts = {"normal": normal_count, "at_risk": at_risk_count}

    anomaly_count = (
        db.scalar(
            select(func.count()).where(latest_readings_subq.c.is_anomaly == True)  # noqa: E712
        )
        or 0
    )
    both_count = (
        db.scalar(
            select(func.count()).where(
                latest_readings_subq.c.is_at_risk == True,  # noqa: E712
                latest_readings_subq.c.is_anomaly == True,  # noqa: E712
            )
        )
        or 0
    )

    # By Asset Type
    asset_type_query = (
        select(
            Asset.asset_type,
            func.count(Asset.asset_id).label("count"),
            func.sum(case((Reading.is_at_risk == True, 1), else_=0)).label("at_risk"),  # noqa: E712
        )
        .join(Reading, Asset.latest_reading_id == Reading.id)
        .group_by(Asset.asset_type)
        .order_by(func.count(Asset.asset_id).desc())
    )
    by_asset_type_res = db.execute(asset_type_query).all()
    by_asset_type = [
        {"asset_type": r[0] or "Unknown", "count": r[1], "at_risk": int(r[2] or 0)}
        for r in by_asset_type_res
    ]

    # Top Countries
    country_query = (
        select(
            Asset.country,
            func.count(Asset.asset_id).label("count"),
            func.sum(case((Reading.is_at_risk == True, 1), else_=0)).label("at_risk"),  # noqa: E712
        )
        .join(Reading, Asset.latest_reading_id == Reading.id)
        .where(Asset.country.is_not(None))
        .group_by(Asset.country)
        .order_by(func.count(Asset.asset_id).desc())
        .limit(10)
    )
    top_countries_res = db.execute(country_query).all()
    top_countries = [
        {"country": r[0], "count": r[1], "at_risk": int(r[2] or 0)}
        for r in top_countries_res
    ]

    # Average metrics
    avg_query = select(
        func.avg(latest_readings_subq.c.signal_strength_dbm),
        func.avg(latest_readings_subq.c.latency_ms),
        func.avg(latest_readings_subq.c.packet_loss_pct),
        func.avg(latest_readings_subq.c.throughput_mbps),
        func.avg(latest_readings_subq.c.connected_users),
        func.avg(latest_readings_subq.c.traffic_load_pct),
        func.avg(latest_readings_subq.c.call_drop_rate_pct),
        func.avg(latest_readings_subq.c.resource_utilization_pct),
        func.avg(latest_readings_subq.c.network_stress_index),
        func.avg(latest_readings_subq.c.signal_quality_score),
    ).select_from(latest_readings_subq)
    avg_res = db.execute(avg_query).one()

    avg_metrics = {
        "signal_strength_dbm": round(float(avg_res[0] or 0.0), 2),
        "latency_ms": round(float(avg_res[1] or 0.0), 2),
        "packet_loss_pct": round(float(avg_res[2] or 0.0), 2),
        "throughput_mbps": round(float(avg_res[3] or 0.0), 2),
        "connected_users": round(float(avg_res[4] or 0.0), 1),
        "traffic_load_pct": round(float(avg_res[5] or 0.0), 2),
        "call_drop_rate_pct": round(float(avg_res[6] or 0.0), 2),
        "resource_utilization_pct": round(float(avg_res[7] or 0.0), 2),
        "network_stress_index": round(float(avg_res[8] or 0.0), 2),
        "signal_quality_score": round(float(avg_res[9] or 0.0), 2),
    }

    # Time range
    min_ts = db.scalar(select(func.min(Reading.timestamp)))
    max_ts = db.scalar(select(func.max(Reading.timestamp)))
    time_range = {
        "min": min_ts.isoformat() if min_ts else None,
        "max": max_ts.isoformat() if max_ts else None,
    }

    # Last Ingestion
    last_log = (
        db.scalars(select(IngestionLog).order_by(IngestionLog.id.desc()).limit(1)).first()
    )
    last_ingestion = None
    if last_log:
        last_ingestion = {
            "id": last_log.id,
            "filename": last_log.filename,
            "source": last_log.source,
            "created_at": last_log.created_at.isoformat(),
            "rows_total": last_log.rows_total,
            "accepted": last_log.accepted,
        }

    # Open incidents
    open_incidents = (
        db.scalar(
            select(func.count(Incident.id)).where(Incident.status != "resolved")
        )
        or 0
    )

    return {
        "total_assets": total_assets,
        "total_readings": total_readings,
        "located_assets": located_assets,
        "unlocated_assets": unlocated_assets,
        "status_counts": status_counts,
        "risk_counts": risk_counts,
        "anomaly_count": anomaly_count,
        "both_count": both_count,
        "by_asset_type": by_asset_type,
        "top_countries": top_countries,
        "avg_metrics": avg_metrics,
        "time_range": time_range,
        "last_ingestion": last_ingestion,
        "open_incidents": open_incidents,
        "model_version": model_version,
    }
