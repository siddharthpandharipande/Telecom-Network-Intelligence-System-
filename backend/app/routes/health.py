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


@router.get("/health/locations")
def get_health_locations(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Return dynamic location hierarchy (continents, countries, cities) combining DB records and global coverage."""
    from backend.app.geo import get_dynamic_location_hierarchy
    return get_dynamic_location_hierarchy(db)


@router.get("/health/dashboard")
def get_health_dashboard(
    country: str = None,
    continent: str = None,
    city: str = None,
    asset_type: str = None,
    status: str = None,
    is_at_risk: bool = None,
    is_anomaly: bool = None,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Calculate transparent, documented network health KPIs, score, and chart distributions with active filters."""
    from datetime import datetime, timezone
    from sqlalchemy import case, func, select
    from backend.app.geo import get_dynamic_location_hierarchy

    # Fetch dynamic locations and asset types across database + global coverage
    loc_data = get_dynamic_location_hierarchy(db)
    db_types = sorted(
        list(
            {
                c[0]
                for c in db.execute(
                    select(Asset.asset_type)
                    .distinct()
                    .where(
                        Asset.asset_type.is_not(None),
                        Asset.asset_type != "",
                        Asset.asset_type != "None",
                    )
                ).all()
                if c[0]
            }
        )
    )

    # Subquery of latest readings with asset join
    base_q = (
        select(Reading, Asset)
        .join(Asset, Asset.latest_reading_id == Reading.id)
    )

    if country and country != "All":
        clean_country = country.strip()
        if clean_country.lower() == "england":
            from backend.app.geo import CONTINENT_HIERARCHY
            england_cities = [c.lower() for c in CONTINENT_HIERARCHY["Europe"]["England"]]
            base_q = base_q.where(
                (func.lower(Asset.country) == "england")
                | (
                    func.lower(Asset.country).in_(["uk", "united kingdom"])
                    & func.lower(Asset.city).in_(england_cities)
                )
            )
        elif clean_country.lower() in ("uk", "united kingdom"):
            base_q = base_q.where(
                (func.lower(Asset.country).in_(["uk", "united kingdom", "england"]))
                | (Asset.country.ilike(f"%{clean_country}%"))
            )
        else:
            base_q = base_q.where(
                (func.lower(Asset.country) == clean_country.lower())
                | (Asset.country.ilike(f"%{clean_country}%"))
            )
    if continent and continent != "All":
        clean_continent = continent.strip()
        base_q = base_q.where(
            (func.lower(Asset.continent) == clean_continent.lower())
            | (Asset.continent.ilike(f"%{clean_continent}%"))
        )
    if city and city != "All":
        clean_city = city.strip()
        base_q = base_q.where(
            (func.lower(Asset.city) == clean_city.lower())
            | (Asset.city.ilike(f"%{clean_city}%"))
        )
    if asset_type and asset_type != "All":
        base_q = base_q.where(Asset.asset_type.ilike(f"%{asset_type.strip()}%"))
    if status and status != "All":
        status_val = status.lower().strip()
        if status_val in ["healthy", "normal", "green"]:
            base_q = base_q.where(Reading.status == "green")
        elif status_val in ["warning", "yellow"]:
            base_q = base_q.where(Reading.status == "yellow")
        elif status_val in ["purple", "anomaly"]:
            base_q = base_q.where(Reading.status == "purple")
        elif status_val in ["critical", "red", "at risk", "at-risk"]:
            base_q = base_q.where(Reading.status == "red")
        else:
            base_q = base_q.where(Reading.status == status_val)
    if is_at_risk is not None:
        base_q = base_q.where(Reading.is_at_risk == is_at_risk)
    if is_anomaly is not None:
        base_q = base_q.where(Reading.is_anomaly == is_anomaly)

    subq = base_q.subquery()

    # Aggregate KPIs
    kpi_query = select(
        func.count().label("total"),
        func.sum(case((subq.c.is_at_risk == False, 1), else_=0)).label("normal_count"),
        func.sum(case((subq.c.is_at_risk == True, 1), else_=0)).label("at_risk_count"),
        func.sum(case((subq.c.is_anomaly == True, 1), else_=0)).label("anomaly_count"),
        func.avg(subq.c.signal_strength_dbm).label("avg_signal"),
        func.avg(subq.c.latency_ms).label("avg_latency"),
        func.avg(subq.c.packet_loss_pct).label("avg_packet_loss"),
        func.avg(subq.c.traffic_load_pct).label("avg_traffic"),
        func.avg(subq.c.resource_utilization_pct).label("avg_resource"),
        func.avg(subq.c.network_stress_index).label("avg_nsi"),
        func.avg(subq.c.signal_quality_score).label("avg_signal_quality"),
        func.avg(subq.c.risk_score).label("avg_risk_score"),
        func.sum(case((subq.c.status != "red", 1), else_=0)).label("available_count"),
    ).select_from(subq)

    res = db.execute(kpi_query).one()
    total = int(res.total or 0)

    if total == 0:
        return {
            "kpis": {
                "total_assets": 0,
                "normal_assets": 0,
                "at_risk_assets": 0,
                "at_risk_pct": 0.0,
                "anomaly_count": 0,
                "anomaly_pct": 0.0,
                "availability_pct": 0.0,
                "avg_signal_strength_dbm": 0.0,
                "avg_latency_ms": 0.0,
                "avg_packet_loss_pct": 0.0,
                "avg_traffic_load_pct": 0.0,
                "avg_resource_utilization_pct": 0.0,
                "avg_nsi": 0.0,
                "aggregate_health_score": 0.0,
                "health_category": "No Data",
            },
            "charts": {
                "svm_distribution": [
                    {"name": "Normal (Optimal)", "value": 0, "color": "#10b981"},
                    {"name": "At Risk (Degraded)", "value": 0, "color": "#ef4444"},
                ],
                "dbscan_distribution": [
                    {"name": "Dense Cluster Inliers", "value": 0, "color": "#3b82f6"},
                    {"name": "Multivariate Outliers (Noise)", "value": 0, "color": "#a855f7"},
                ],
                "nsi_distribution": [],
                "latency_packet_loss": [],
                "signal_distribution": [],
                "risk_by_region": [],
            },
            "documentation": {
                "nsi_formula": "NSI = (Traffic Load + Resource Utilization + Packet Loss + Call Drop Rate) / 4",
                "health_score_formula": "Health Score = 100 - (0.40 * NSI + 0.30 * (100 - SignalQuality) + 0.30 * RiskScorePct)",
                "availability_note": "Derived operational SLA availability based on non-critical asset ratio across active telemetry snapshot.",
                "data_scope": "Active SQLite Telemetry Snapshot",
            },
            "filter_options": {
                "countries": loc_data["countries"],
                "continents": loc_data["continents"],
                "cities": loc_data["cities"],
                "asset_types": db_types,
                "hierarchy": loc_data["hierarchy"],
                "country_to_continent": loc_data.get("country_to_continent", {}),
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    normal = int(res.normal_count or 0)
    at_risk = int(res.at_risk_count or 0)
    anomaly = int(res.anomaly_count or 0)
    available = int(res.available_count or 0)

    at_risk_pct = round((at_risk / total) * 100.0, 2)
    anomaly_pct = round((anomaly / total) * 100.0, 2)
    availability_pct = round((available / total) * 100.0, 2)

    avg_signal = round(float(res.avg_signal or 0.0), 2)
    avg_latency = round(float(res.avg_latency or 0.0), 2)
    avg_packet_loss = round(float(res.avg_packet_loss or 0.0), 2)
    avg_traffic = round(float(res.avg_traffic or 0.0), 2)
    avg_resource = round(float(res.avg_resource or 0.0), 2)
    avg_nsi = round(float(res.avg_nsi or 0.0), 2)
    avg_signal_quality = float(res.avg_signal_quality or 50.0)
    avg_risk_score = float(res.avg_risk_score or 0.0)

    # Documented Aggregate Health Score formula:
    # Health Score = 100 - (0.40 * NSI + 0.30 * (100 - SignalQuality) + 0.30 * (RiskScore * 100))
    health_score = max(
        0.0,
        min(
            100.0,
            100.0
            - (
                0.40 * avg_nsi
                + 0.30 * (100.0 - avg_signal_quality)
                + 0.30 * (avg_risk_score * 100.0)
            ),
        ),
    )
    health_score = round(health_score, 1)

    health_category = (
        "Healthy" if health_score >= 70.0 else "Warning" if health_score >= 45.0 else "Critical"
    )

    # Chart Distributions
    # 1. Normal vs At Risk
    svm_dist = [
        {"name": "Normal (Optimal)", "value": normal, "color": "#10b981"},
        {"name": "At Risk (Degraded)", "value": at_risk, "color": "#ef4444"},
    ]

    # 2. DBSCAN Anomaly distribution (separate from SVM)
    dense_inliers = total - anomaly
    dbscan_dist = [
        {"name": "Dense Cluster Inliers", "value": dense_inliers, "color": "#3b82f6"},
        {"name": "Multivariate Outliers (Noise)", "value": anomaly, "color": "#a855f7"},
    ]

    # 3. NSI Distribution histogram bins
    nsi_bins_q = select(
        func.sum(case((subq.c.network_stress_index < 25, 1), else_=0)).label("b0_25"),
        func.sum(
            case(
                (
                    (subq.c.network_stress_index >= 25) & (subq.c.network_stress_index < 50),
                    1,
                ),
                else_=0,
            )
        ).label("b25_50"),
        func.sum(
            case(
                (
                    (subq.c.network_stress_index >= 50) & (subq.c.network_stress_index < 75),
                    1,
                ),
                else_=0,
            )
        ).label("b50_75"),
        func.sum(case((subq.c.network_stress_index >= 75, 1), else_=0)).label("b75_100"),
    ).select_from(subq)
    nsi_res = db.execute(nsi_bins_q).one()
    nsi_dist = [
        {"bin": "0-25 (Low)", "count": int(nsi_res.b0_25 or 0)},
        {"bin": "25-50 (Moderate)", "count": int(nsi_res.b25_50 or 0)},
        {"bin": "50-75 (Elevated)", "count": int(nsi_res.b50_75 or 0)},
        {"bin": "75-100 (Severe)", "count": int(nsi_res.b75_100 or 0)},
    ]

    # 4. Latency and Packet Loss comparison by asset type
    type_latency_q = (
        select(
            subq.c.asset_type,
            func.avg(subq.c.latency_ms).label("latency"),
            func.avg(subq.c.packet_loss_pct).label("loss"),
            func.avg(subq.c.traffic_load_pct).label("traffic"),
            func.avg(subq.c.resource_utilization_pct).label("resource"),
            func.count().label("cnt"),
            func.sum(case((subq.c.is_at_risk == True, 1), else_=0)).label("risk_cnt"),
        )
        .select_from(subq)
        .group_by(subq.c.asset_type)
    )
    type_latency_res = db.execute(type_latency_q).all()
    latency_packet_loss = [
        {
            "asset_type": r.asset_type or "Unknown",
            "latency_ms": round(float(r.latency or 0.0), 1),
            "packet_loss_pct": round(float(r.loss or 0.0), 2),
            "traffic_load_pct": round(float(r.traffic or 0.0), 1),
            "resource_util_pct": round(float(r.resource or 0.0), 1),
            "total": int(r.cnt),
            "at_risk": int(r.risk_cnt or 0),
        }
        for r in type_latency_res
    ]

    # 5. Signal Strength Distribution
    signal_bins_q = select(
        func.sum(case((subq.c.signal_strength_dbm < -100, 1), else_=0)).label("poor"),
        func.sum(
            case(
                ((subq.c.signal_strength_dbm >= -100) & (subq.c.signal_strength_dbm < -85), 1),
                else_=0,
            )
        ).label("fair"),
        func.sum(
            case(
                ((subq.c.signal_strength_dbm >= -85) & (subq.c.signal_strength_dbm < -70), 1),
                else_=0,
            )
        ).label("good"),
        func.sum(case((subq.c.signal_strength_dbm >= -70, 1), else_=0)).label("excellent"),
    ).select_from(subq)
    sig_res = db.execute(signal_bins_q).one()
    signal_dist = [
        {"tier": "Poor (< -100 dBm)", "count": int(sig_res.poor or 0)},
        {"tier": "Fair (-100 to -85 dBm)", "count": int(sig_res.fair or 0)},
        {"tier": "Good (-85 to -70 dBm)", "count": int(sig_res.good or 0)},
        {"tier": "Excellent (>= -70 dBm)", "count": int(sig_res.excellent or 0)},
    ]

    # 6. Risk by Region/Continent
    region_q = (
        select(
            subq.c.continent,
            func.count().label("total"),
            func.sum(case((subq.c.is_at_risk == True, 1), else_=0)).label("at_risk"),
        )
        .select_from(subq)
        .where(subq.c.continent.is_not(None))
        .group_by(subq.c.continent)
        .order_by(func.count().desc())
        .limit(6)
    )
    region_res = db.execute(region_q).all()
    risk_by_region = [
        {
            "region": r.continent,
            "total": int(r.total),
            "at_risk": int(r.at_risk or 0),
            "optimal": int(r.total) - int(r.at_risk or 0),
        }
        for r in region_res
    ]

    return {
        "kpis": {
            "total_assets": total,
            "normal_assets": normal,
            "at_risk_assets": at_risk,
            "at_risk_pct": at_risk_pct,
            "anomaly_count": anomaly,
            "anomaly_pct": anomaly_pct,
            "availability_pct": availability_pct,
            "avg_signal_strength_dbm": avg_signal,
            "avg_latency_ms": avg_latency,
            "avg_packet_loss_pct": avg_packet_loss,
            "avg_traffic_load_pct": avg_traffic,
            "avg_resource_utilization_pct": avg_resource,
            "avg_nsi": avg_nsi,
            "aggregate_health_score": health_score,
            "health_category": health_category,
        },
        "charts": {
            "svm_distribution": svm_dist,
            "dbscan_distribution": dbscan_dist,
            "nsi_distribution": nsi_dist,
            "latency_packet_loss": latency_packet_loss,
            "signal_distribution": signal_dist,
            "risk_by_region": risk_by_region,
        },
        "documentation": {
            "nsi_formula": "NSI = (Traffic Load + Resource Utilization + Packet Loss + Call Drop Rate) / 4",
            "health_score_formula": "Health Score = 100 - (0.40 * NSI + 0.30 * (100 - SignalQuality) + 0.30 * RiskScorePct)",
            "availability_note": "Derived operational SLA availability based on non-critical asset ratio across active telemetry snapshot.",
            "data_scope": "Active SQLite Telemetry Snapshot (2026-09-16 00:00:00 to 2026-09-16 23:00:00)",
        },
        "filter_options": {
            "countries": loc_data["countries"],
            "continents": loc_data["continents"],
            "cities": loc_data["cities"],
            "asset_types": db_types,
            "hierarchy": loc_data["hierarchy"],
            "country_to_continent": loc_data.get("country_to_continent", {}),
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
