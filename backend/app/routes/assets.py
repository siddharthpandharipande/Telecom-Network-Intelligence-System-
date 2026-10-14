"""Asset queries, detail view, and geospatial map points routes."""
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.models import Asset, Reading
from backend.app.schemas import (
    AssetDetailResponse,
    AssetSummary,
    MapPoint,
    PaginatedAssetsResponse,
    ReadingResponse,
)
from backend.app.utils import reading_to_response

router = APIRouter(tags=["Assets"])


@router.get("/assets", response_model=PaginatedAssetsResponse)
def list_assets(
    country: Optional[str] = Query(None, description="Filter by country"),
    city: Optional[str] = Query(None, description="Filter by city"),
    asset_type: Optional[str] = Query(None, description="Filter by asset type"),
    status: Optional[str] = Query(None, description="Filter by status (green, yellow, purple, red)"),
    is_at_risk: Optional[bool] = Query(None, description="Filter by at-risk boolean flag"),
    is_anomaly: Optional[bool] = Query(None, description="Filter by anomaly boolean flag"),
    source: Optional[str] = Query(None, description="Filter by reading source (seed, csv, manual)"),
    q: Optional[str] = Query(None, description="Substring search on Asset_ID"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(50, ge=1, le=500, description="Items per page (max 500)"),
    sort: Optional[str] = Query("risk_score:desc", description="Sort field and direction (e.g. risk_score:desc, asset_id:asc)"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Retrieve paginated list of assets and their latest telemetry readings."""
    # Base query: Join Asset and its latest Reading
    base_query = (
        select(Reading, Asset)
        .join(Asset, Asset.latest_reading_id == Reading.id)
    )

    # Apply filters
    if country:
        base_query = base_query.where(Asset.country.ilike(f"%{country}%"))
    if city:
        base_query = base_query.where(Asset.city.ilike(f"%{city}%"))
    if asset_type:
        base_query = base_query.where(Asset.asset_type.ilike(f"%{asset_type}%"))
    if status:
        base_query = base_query.where(Reading.status == status.lower())
    if is_at_risk is not None:
        base_query = base_query.where(Reading.is_at_risk == is_at_risk)
    if is_anomaly is not None:
        base_query = base_query.where(Reading.is_anomaly == is_anomaly)
    if source:
        base_query = base_query.where(Reading.source == source)
    if q:
        base_query = base_query.where(Asset.asset_id.ilike(f"%{q}%"))

    # Count total matching
    count_subquery = base_query.subquery()
    total = db.scalar(select(func.count()).select_from(count_subquery)) or 0

    # Apply sort
    if sort:
        parts = sort.split(":")
        sort_col = parts[0].strip().lower()
        descending = len(parts) > 1 and parts[1].strip().lower() == "desc"

        col_attr = None
        if hasattr(Reading, sort_col):
            col_attr = getattr(Reading, sort_col)
        elif hasattr(Asset, sort_col):
            col_attr = getattr(Asset, sort_col)

        if col_attr is not None:
            base_query = base_query.order_by(col_attr.desc() if descending else col_attr.asc())
        else:
            base_query = base_query.order_by(Reading.risk_score.desc())
    else:
        base_query = base_query.order_by(Reading.risk_score.desc())

    # Pagination
    offset = (page - 1) * page_size
    results = db.execute(base_query.offset(offset).limit(page_size)).all()

    items: List[ReadingResponse] = []
    for reading, asset in results:
        items.append(reading_to_response(reading, asset))

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/map/points", response_model=List[MapPoint])
def get_map_points(
    country: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    asset_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    is_at_risk: Optional[bool] = Query(None),
    is_anomaly: Optional[bool] = Query(None),
    source: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Retrieve compact telemetry points for geospatial map visualization.

    Excludes unlocated assets (NULL coordinates). Capped at 20,000 points.
    """
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
        .join(Reading, Asset.latest_reading_id == Reading.id)
        .where(Asset.latitude.is_not(None), Asset.longitude.is_not(None))
    )

    if country:
        query = query.where(Asset.country.ilike(f"%{country}%"))
    if city:
        query = query.where(Asset.city.ilike(f"%{city}%"))
    if asset_type:
        query = query.where(Asset.asset_type.ilike(f"%{asset_type}%"))
    if status:
        query = query.where(Reading.status == status.lower())
    if is_at_risk is not None:
        query = query.where(Reading.is_at_risk == is_at_risk)
    if is_anomaly is not None:
        query = query.where(Reading.is_anomaly == is_anomaly)
    if source:
        query = query.where(Reading.source == source)
    if q:
        query = query.where(Asset.asset_id.ilike(f"%{q}%"))

    results = db.execute(query.limit(20000)).all()

    points = []
    for row in results:
        points.append(
            {
                "asset_id": row.asset_id,
                "latitude": float(row.latitude),
                "longitude": float(row.longitude),
                "status": row.status,
                "is_at_risk": bool(row.is_at_risk),
                "is_anomaly": bool(row.is_anomaly),
                "asset_type": row.asset_type,
                "city": row.city,
            }
        )
    return points


@router.get("/assets/{asset_id}", response_model=AssetDetailResponse)
def get_asset_detail(
    asset_id: str,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Retrieve single asset metadata, latest reading, and historical telemetry readings."""
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(
            status_code=404,
            detail={
                "detail": f"Asset with ID '{asset_id}' not found",
                "code": "ASSET_NOT_FOUND",
                "errors": [f"No asset found matching '{asset_id}'"],
            },
        )

    # Fetch latest reading
    latest_reading = None
    if asset.latest_reading_id:
        latest_reading = db.get(Reading, asset.latest_reading_id)

    # Fetch reading history (max 100, newest first)
    history_query = (
        select(Reading)
        .where(Reading.asset_id == asset_id)
        .order_by(Reading.timestamp.desc(), Reading.id.desc())
        .limit(100)
    )
    history_records = db.scalars(history_query).all()

    latest_schema = reading_to_response(latest_reading, asset) if latest_reading else None
    history_schemas = [reading_to_response(r, asset) for r in history_records]

    asset_summary = AssetSummary.model_validate(asset)

    return {
        "asset": asset_summary,
        "latest": latest_schema,
        "history": history_schemas,
    }
