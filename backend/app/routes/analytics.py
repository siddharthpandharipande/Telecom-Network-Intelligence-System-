"""Analytics, multivariate clustering exploration, correlation, and replay routes."""
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.models import Asset, Reading
from backend.app.schemas import (
    ReadingResponse,
    ReplayHourResponse,
    ReplayMetaResponse,
    ReplayResponse,
)
from backend.app.utils import reading_to_response

router = APIRouter(tags=["Analytics"])

ANALYTICS_METRICS = [
    "signal_strength_dbm",
    "latency_ms",
    "packet_loss_pct",
    "throughput_mbps",
    "connected_users",
    "traffic_load_pct",
    "call_drop_rate_pct",
    "resource_utilization_pct",
    "peak_hour",
    "network_stress_index",
    "signal_quality_score",
    "throughput_per_user",
]


@router.get("/analytics/correlation")
def get_correlation_matrix(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Calculate Pearson correlation matrix over the 8 base telemetry metrics and 4 engineered features."""
    # Query latest reading per asset
    subq = (
        select(Reading)
        .join(Asset, Asset.latest_reading_id == Reading.id)
        .subquery()
    )

    query = select(*[getattr(subq.c, col) for col in ANALYTICS_METRICS])
    records = db.execute(query).all()

    if not records:
        return {"labels": ANALYTICS_METRICS, "values": []}

    df = pd.DataFrame(records, columns=ANALYTICS_METRICS).astype(float)
    corr_matrix = df.corr(method="pearson").round(4).fillna(0.0)

    return {
        "labels": ANALYTICS_METRICS,
        "values": corr_matrix.values.tolist(),
    }


@router.get("/analytics/hourly")
def get_hourly_analytics(
    metric: str = Query("traffic_load_pct", description="Metric to aggregate by hour of day"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Calculate hourly means, counts, effect size (eta-squared), and chart meaningfulness."""
    metric_clean = metric.strip().lower()
    if metric_clean not in ANALYTICS_METRICS:
        raise HTTPException(
            status_code=400,
            detail={
                "detail": f"Invalid metric '{metric}'",
                "code": "INVALID_METRIC",
                "errors": [f"Allowed metrics: {ANALYTICS_METRICS}"],
            },
        )

    # Query hour (via peak_hour / timestamp) and metric value
    col_attr = getattr(Reading, metric_clean)
    records = db.execute(select(Reading.timestamp, col_attr)).all()

    if not records:
        return {
            "metric": metric_clean,
            "hourly": [{"hour": h, "mean": 0.0, "count": 0} for h in range(24)],
            "effect_size": 0.0,
            "meaningful": False,
        }

    df = pd.DataFrame(records, columns=["timestamp", "val"])
    df["val"] = pd.to_numeric(df["val"], errors="coerce")
    df = df.dropna(subset=["val"])

    df["hour"] = pd.to_datetime(df["timestamp"]).dt.hour

    grand_mean = float(df["val"].mean())
    ss_total = float(((df["val"] - grand_mean) ** 2).sum())

    hourly_list = []
    ss_between = 0.0

    for h in range(24):
        hour_df = df[df["hour"] == h]
        cnt = len(hour_df)
        h_mean = float(hour_df["val"].mean()) if cnt > 0 else 0.0
        if cnt > 0:
            ss_between += cnt * ((h_mean - grand_mean) ** 2)

        hourly_list.append({
            "hour": h,
            "mean": round(h_mean, 2),
            "count": cnt,
        })

    effect_size = (ss_between / ss_total) if ss_total > 0 else 0.0
    meaningful = bool(effect_size >= 0.01)

    return {
        "metric": metric_clean,
        "hourly": hourly_list,
        "effect_size": round(effect_size, 4),
        "meaningful": meaningful,
    }


@router.get("/analytics/distributions")
def get_distributions(
    metric: str = Query("latency_ms", description="Metric to compute distribution for"),
    by: str = Query("asset_type", description="Group by 'asset_type' or 'country'"),
    bins: int = Query(20, ge=5, le=50, description="Number of histogram bins"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Calculate metric distribution histograms partitioned by asset_type or country."""
    metric_clean = metric.strip().lower()
    if metric_clean not in ANALYTICS_METRICS:
        raise HTTPException(
            status_code=400,
            detail={
                "detail": f"Invalid metric '{metric}'",
                "code": "INVALID_METRIC",
                "errors": [f"Allowed metrics: {ANALYTICS_METRICS}"],
            },
        )

    by_col = Asset.country if by.strip().lower() == "country" else Asset.asset_type
    metric_attr = getattr(Reading, metric_clean)

    records = db.execute(
        select(by_col, metric_attr)
        .join(Asset, Asset.latest_reading_id == Reading.id)
        .where(metric_attr.is_not(None))
    ).all()

    if not records:
        return {"metric": metric_clean, "bins": [], "groups": {}}

    df = pd.DataFrame(records, columns=["group", "val"])
    df["group"] = df["group"].fillna("Unknown")
    df["val"] = pd.to_numeric(df["val"], errors="coerce").dropna()

    min_val = float(df["val"].min())
    max_val = float(df["val"].max())

    if min_val == max_val:
        bin_edges = np.linspace(min_val - 1.0, max_val + 1.0, bins + 1)
    else:
        bin_edges = np.linspace(min_val, max_val, bins + 1)

    bin_labels = [f"{round(bin_edges[i], 1)}-{round(bin_edges[i+1], 1)}" for i in range(len(bin_edges) - 1)]

    groups_hist: Dict[str, List[int]] = {}
    top_groups = df["group"].value_counts().head(8).index.tolist()

    for grp in top_groups:
        grp_vals = df[df["group"] == grp]["val"].values
        counts, _ = np.histogram(grp_vals, bins=bin_edges)
        groups_hist[grp] = [int(c) for c in counts]

    return {
        "metric": metric_clean,
        "bins": bin_labels,
        "groups": groups_hist,
    }


@router.get("/analytics/cities")
def get_cities_analytics(
    top: int = Query(10, ge=1, le=50, description="Top N cities to return"),
    min_n: int = Query(10, ge=1, description="Minimum assets required in city"),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Retrieve operational risk share by city (minimum N asset threshold)."""
    query = (
        select(
            Asset.city,
            func.count(Asset.asset_id).label("total_assets"),
            func.sum(case((Reading.is_at_risk == True, 1), else_=0)).label("at_risk_count"),  # noqa: E712
        )
        .join(Reading, Asset.latest_reading_id == Reading.id)
        .where(Asset.city.is_not(None))
        .group_by(Asset.city)
        .having(func.count(Asset.asset_id) >= min_n)
        .order_by(
            (func.sum(case((Reading.is_at_risk == True, 1.0), else_=0.0)) / func.count(Asset.asset_id)).desc()  # noqa: E712
        )
        .limit(top)
    )

    results = db.execute(query).all()
    out = []
    for row in results:
        tot = int(row.total_assets)
        risk = int(row.at_risk_count or 0)
        out.append(
            {
                "city": row.city,
                "total_assets": tot,
                "at_risk_count": risk,
                "at_risk_pct": round((risk / tot) * 100.0, 2) if tot > 0 else 0.0,
            }
        )
    return out


@router.get("/analytics/risk_anomaly_matrix")
def get_risk_anomaly_matrix(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Retrieve 2x2 matrix of SVM At Risk vs DBSCAN Anomaly across latest asset readings."""
    subq = (
        select(Reading)
        .join(Asset, Asset.latest_reading_id == Reading.id)
        .subquery()
    )

    normal_inlier = (
        db.scalar(
            select(func.count()).where(
                subq.c.is_at_risk == False, subq.c.is_anomaly == False  # noqa: E712
            )
        )
        or 0
    )
    normal_anomaly = (
        db.scalar(
            select(func.count()).where(
                subq.c.is_at_risk == False, subq.c.is_anomaly == True  # noqa: E712
            )
        )
        or 0
    )
    at_risk_inlier = (
        db.scalar(
            select(func.count()).where(
                subq.c.is_at_risk == True, subq.c.is_anomaly == False  # noqa: E712
            )
        )
        or 0
    )
    at_risk_anomaly = (
        db.scalar(
            select(func.count()).where(
                subq.c.is_at_risk == True, subq.c.is_anomaly == True  # noqa: E712
            )
        )
        or 0
    )

    total = normal_inlier + normal_anomaly + at_risk_inlier + at_risk_anomaly

    return {
        "normal_inlier": normal_inlier,
        "normal_anomaly": normal_anomaly,
        "at_risk_inlier": at_risk_inlier,
        "at_risk_anomaly": at_risk_anomaly,
        "total": total,
    }


@router.get("/analytics/scatter")
def get_scatter_data(
    x: str = Query("latency_ms", description="X-axis metric name"),
    y: str = Query("packet_loss_pct", description="Y-axis metric name"),
    n: int = Query(1500, ge=100, le=5000, description="Max sampled points to return"),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Sample telemetry points for 2D scatter plots.

    Always includes all multivariate anomalies up to cap n, filling remainder with a seeded sample.
    """
    x_clean = x.strip().lower()
    y_clean = y.strip().lower()

    if x_clean not in ANALYTICS_METRICS or y_clean not in ANALYTICS_METRICS:
        raise HTTPException(
            status_code=400,
            detail={
                "detail": "Invalid scatter metric name",
                "code": "INVALID_METRIC",
                "errors": [f"Allowed metrics: {ANALYTICS_METRICS}"],
            },
        )

    col_x = getattr(Reading, x_clean)
    col_y = getattr(Reading, y_clean)

    query = (
        select(
            Reading.asset_id,
            col_x,
            col_y,
            Reading.dbscan_cluster,
            Reading.is_anomaly,
            Reading.is_at_risk,
        )
        .join(Asset, Asset.latest_reading_id == Reading.id)
        .where(col_x.is_not(None), col_y.is_not(None))
    )

    rows = db.execute(query).all()
    if not rows:
        return []

    # Separate anomalies and inliers
    anomalies = [r for r in rows if r.is_anomaly]
    inliers = [r for r in rows if not r.is_anomaly]

    selected: List[Any] = []
    if len(anomalies) >= n:
        selected = anomalies[:n]
    else:
        selected.extend(anomalies)
        remaining = n - len(selected)
        if inliers:
            # Seeded deterministic sampling
            rng = np.random.RandomState(42)
            indices = rng.choice(len(inliers), size=min(remaining, len(inliers)), replace=False)
            for idx in indices:
                selected.append(inliers[idx])

    points = []
    for r in selected:
        points.append(
            {
                "asset_id": r.asset_id,
                "x": float(r[1]),
                "y": float(r[2]),
                "dbscan_cluster": int(r.dbscan_cluster),
                "is_anomaly": bool(r.is_anomaly),
                "is_at_risk": bool(r.is_at_risk),
            }
        )
    return points


@router.get("/dbscan/explore")
def explore_dbscan(
    eps: float = Query(1.6, ge=0.1, le=5.0, description="DBSCAN neighborhood radius (eps)"),
    min_samples: int = Query(16, ge=2, le=100, description="DBSCAN min_samples parameter"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """In-memory DBSCAN clustering parameter explorer on latest telemetry data.

    Never persists or alters the trained production model.
    """
    base_cols = [
        Reading.signal_strength_dbm,
        Reading.latency_ms,
        Reading.packet_loss_pct,
        Reading.throughput_mbps,
        Reading.connected_users,
        Reading.traffic_load_pct,
        Reading.call_drop_rate_pct,
        Reading.resource_utilization_pct,
    ]

    records = db.execute(
        select(*base_cols).join(Asset, Asset.latest_reading_id == Reading.id)
    ).all()

    if not records:
        return {
            "eps": eps,
            "min_samples": min_samples,
            "n_clusters": 0,
            "noise_count": 0,
            "noise_pct": 0.0,
        }

    X = np.array(records, dtype=float)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    dbscan = DBSCAN(eps=eps, min_samples=min_samples).fit(X_scaled)
    labels = dbscan.labels_

    n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
    noise_count = int(np.sum(labels == -1))
    noise_pct = round(float(noise_count / len(labels) * 100.0), 2)

    return {
        "eps": eps,
        "min_samples": min_samples,
        "n_clusters": n_clusters,
        "noise_count": noise_count,
        "noise_pct": noise_pct,
    }


@router.get("/replay", response_model=ReplayResponse)
def get_replay_readings(
    cursor: int = Query(0, ge=0, description="Offset cursor position"),
    n: int = Query(5, ge=1, le=50, description="Number of readings to fetch"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Sequential read-only replay of telemetry readings ordered by timestamp and ID."""
    query = (
        select(Reading)
        .order_by(Reading.timestamp.asc(), Reading.id.asc())
        .offset(cursor)
        .limit(n + 1)
    )

    records = db.scalars(query).all()
    has_more = len(records) > n
    batch = records[:n]

    items: List[ReadingResponse] = [reading_to_response(r) for r in batch]
    next_cursor = cursor + len(items)

    return {
        "items": items,
        "next_cursor": next_cursor,
        "has_more": has_more,
    }


@router.get("/replay/meta", response_model=ReplayMetaResponse)
def get_replay_meta(db: Session = Depends(get_db)):
    """Retrieve metadata about available timestamps for historical simulated replay."""
    min_ts = db.scalar(select(func.min(Reading.timestamp)))
    max_ts = db.scalar(select(func.max(Reading.timestamp)))
    total = db.scalar(select(func.count(Reading.id))) or 0

    hours = [
        int(h[0])
        for h in db.execute(
            select(func.strftime("%H", Reading.timestamp))
            .where(func.date(Reading.timestamp) == "2026-09-16")
            .distinct()
            .order_by(func.strftime("%H", Reading.timestamp).asc())
        ).all()
    ]

    return ReplayMetaResponse(
        start_time=min_ts.isoformat() if min_ts else "2026-09-16T00:00:00",
        end_time=max_ts.isoformat() if max_ts else "2026-09-16T23:00:00",
        distinct_hours=hours if hours else list(range(24)),
        total_readings=total,
        is_snapshot=True,
        snapshot_date="2026-09-16",
    )


@router.get("/replay/slice", response_model=ReplayHourResponse)
def get_replay_slice(
    hour: int = Query(0, ge=0, le=23, description="Hour of the day to replay (0-23)"),
    db: Session = Depends(get_db),
):
    """Retrieve simulated telemetry slice for a specific hour of historical replay.

    Includes all global network assets modulated by realistic diurnal telecom traffic curves:
    - Low nighttime load (00-06h): predominantly healthy (green)
    - Morning and evening peak loads (08-11h, 18-21h): elevated stress, warnings (yellow), and at-risk incidents (red/purple).
    """
    from backend.app.schemas import MapPoint

    query = (
        select(
            Asset.asset_id,
            Asset.latitude,
            Asset.longitude,
            Reading.status,
            Reading.is_at_risk,
            Reading.is_anomaly,
            Asset.asset_type,
            Asset.city,
        )
        .select_from(Asset)
        .join(Reading, Asset.latest_reading_id == Reading.id)
        .where(
            Asset.latitude.is_not(None),
            Asset.longitude.is_not(None),
        )
    )
    records = db.execute(query).all()
    points = []
    ts_sample = f"2026-09-16T{hour:02d}:00:00"

    # Diurnal peak factor: 0.1 (night) to 1.0 (peak hours)
    if 8 <= hour <= 11:
        peak_factor = 0.65 + (hour - 8) * 0.08
    elif 18 <= hour <= 21:
        peak_factor = 0.75 + (hour - 18) * 0.08
    elif 12 <= hour <= 17:
        peak_factor = 0.45
    elif 22 <= hour or hour <= 6:
        peak_factor = 0.10
    else:
        peak_factor = 0.35

    for r in records:
        # Deterministic integer hash per asset and hour for stable, smooth temporal variation
        h_val = (abs(hash(r.asset_id)) ^ (hour * 7919)) % 1000 / 1000.0

        status = r.status
        is_at_risk = bool(r.is_at_risk)
        is_anomaly = bool(r.is_anomaly)

        # Modulate status according to diurnal traffic wave
        if peak_factor >= 0.6:
            # High peak hours: elevated latency, packet drop and congestion
            if h_val < (0.14 * peak_factor):
                status = "red"
                is_at_risk = True
                is_anomaly = False
            elif h_val < (0.32 * peak_factor):
                status = "yellow"
                is_at_risk = False
                is_anomaly = False
            elif h_val < (0.38 * peak_factor):
                status = "purple"
                is_anomaly = True
                is_at_risk = False
            else:
                status = "green"
                is_at_risk = False
                is_anomaly = False
        elif peak_factor <= 0.15:
            # Nighttime low load: 96%+ green optimal baseline
            if h_val < 0.02:
                status = "yellow"
                is_at_risk = False
                is_anomaly = False
            elif h_val < 0.03:
                status = "purple"
                is_anomaly = True
                is_at_risk = False
            elif h_val < 0.04:
                status = "red"
                is_at_risk = True
                is_anomaly = False
            else:
                status = "green"
                is_at_risk = False
                is_anomaly = False
        else:
            # Mid-day nominal load
            if h_val < 0.07:
                status = "red"
                is_at_risk = True
                is_anomaly = False
            elif h_val < 0.20:
                status = "yellow"
                is_at_risk = False
                is_anomaly = False
            elif h_val < 0.25:
                status = "purple"
                is_anomaly = True
                is_at_risk = False
            else:
                status = "green"
                is_at_risk = False
                is_anomaly = False

        points.append(
            MapPoint(
                asset_id=r.asset_id,
                latitude=float(r.latitude),
                longitude=float(r.longitude),
                status=status,
                is_at_risk=is_at_risk,
                is_anomaly=is_anomaly,
                asset_type=r.asset_type,
                city=r.city,
            )
        )

    return ReplayHourResponse(
        hour=hour,
        timestamp_sample=ts_sample,
        count=len(points),
        readings=points,
    )



@router.get("/analytics/history")
def get_historical_trends(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    asset_id: Optional[str] = Query(None, description="Specific asset ID filter"),
    db: Session = Depends(get_db),
):
    """Retrieve chronological multi-day / hourly historical telemetry trends and prediction history."""
    query = select(
        func.date(Reading.timestamp).label("date"),
        func.strftime("%H", Reading.timestamp).label("hour"),
        func.avg(Reading.latency_ms).label("avg_latency"),
        func.avg(Reading.packet_loss_pct).label("avg_packet_loss"),
        func.avg(Reading.traffic_load_pct).label("avg_traffic"),
        func.avg(Reading.resource_utilization_pct).label("avg_resource"),
        func.avg(Reading.network_stress_index).label("avg_nsi"),
        func.avg(Reading.signal_strength_dbm).label("avg_signal"),
        func.sum(case((Reading.is_at_risk == True, 1), else_=0)).label("at_risk_count"),
        func.sum(case((Reading.is_anomaly == True, 1), else_=0)).label("anomaly_count"),
        func.count().label("reading_count"),
    )
    if start_date:
        query = query.where(func.date(Reading.timestamp) >= start_date)
    if end_date:
        query = query.where(func.date(Reading.timestamp) <= end_date)
    if asset_id:
        query = query.where(Reading.asset_id == asset_id.strip())

    query = query.group_by(
        func.date(Reading.timestamp), func.strftime("%H", Reading.timestamp)
    ).order_by(
        func.date(Reading.timestamp).asc(), func.strftime("%H", Reading.timestamp).asc()
    )

    records = db.execute(query).all()
    timeline = []
    for r in records:
        d_str = r.date
        h_str = r.hour or "00"
        timeline.append(
            {
                "timestamp": f"{d_str}T{h_str}:00:00",
                "date": d_str,
                "hour": int(h_str),
                "avg_latency": round(float(r.avg_latency or 0.0), 1),
                "avg_packet_loss": round(float(r.avg_packet_loss or 0.0), 2),
                "avg_traffic": round(float(r.avg_traffic or 0.0), 1),
                "avg_resource": round(float(r.avg_resource or 0.0), 1),
                "avg_nsi": round(float(r.avg_nsi or 0.0), 1),
                "avg_signal": round(float(r.avg_signal or 0.0), 1),
                "at_risk_count": int(r.at_risk_count or 0),
                "anomaly_count": int(r.anomaly_count or 0),
                "reading_count": int(r.reading_count or 0),
            }
        )

    min_date = db.scalar(select(func.min(func.date(Reading.timestamp))))
    max_date = db.scalar(select(func.max(func.date(Reading.timestamp))))

    return {
        "timeline": timeline,
        "available_range": {
            "min_date": min_date,
            "max_date": max_date,
        },
        "coverage_note": "Chronological telemetry history across SQLite database readings.",
    }
