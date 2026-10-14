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
from backend.app.schemas import ReadingResponse, ReplayResponse
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
