"""Network Links Topology API routes for geospatial map visualization."""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.auth import get_current_user_optional, require_roles
from backend.app.db import get_db
from backend.app.models import Asset, NetworkLink, User
from backend.app.schemas import CreateLinkRequest, NetworkLinkResponse

router = APIRouter(prefix="/topology", tags=["Topology Links"])


@router.get("/links", response_model=List[NetworkLinkResponse])
def get_topology_links(
    link_type: Optional[str] = Query(None, description="Filter by link type: fiber, microwave, satellite"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status: up, degraded, down"),
    db: Session = Depends(get_db),
):
    """Retrieve network links with coordinates for map polyline rendering."""
    query = select(NetworkLink)
    if link_type:
        query = query.where(NetworkLink.link_type == link_type.lower())
    if status_filter:
        query = query.where(NetworkLink.status == status_filter.lower())

    links = db.scalars(query.order_by(NetworkLink.id.asc())).all()

    # Pre-fetch asset coordinates in a batch
    asset_ids = set()
    for l in links:
        asset_ids.add(l.source_asset_id)
        asset_ids.add(l.destination_asset_id)

    assets_map = {}
    if asset_ids:
        assets_res = db.scalars(select(Asset).where(Asset.asset_id.in_(asset_ids))).all()
        assets_map = {a.asset_id: a for a in assets_res}

    response_items = []
    for l in links:
        src = assets_map.get(l.source_asset_id)
        dst = assets_map.get(l.destination_asset_id)

        response_items.append(
            NetworkLinkResponse(
                id=l.id,
                link_id=l.link_id,
                source_asset_id=l.source_asset_id,
                destination_asset_id=l.destination_asset_id,
                source_lat=src.latitude if src else None,
                source_lng=src.longitude if src else None,
                dest_lat=dst.latitude if dst else None,
                dest_lng=dst.longitude if dst else None,
                source_city=src.city if src else None,
                dest_city=dst.city if dst else None,
                link_type=l.link_type,
                capacity_gbps=l.capacity_gbps,
                utilization_pct=l.utilization_pct,
                status=l.status,
                is_synthetic=l.is_synthetic,
                created_at=l.created_at,
            )
        )

    return response_items


@router.post("/links", response_model=NetworkLinkResponse)
def create_topology_link(
    req: CreateLinkRequest,
    _user: User = Depends(require_roles(["admin", "network_engineer"])),
    db: Session = Depends(get_db),
):
    """Add a new physical/logical link between network assets (Engineer or Admin required)."""
    if req.source_asset_id == req.destination_asset_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "detail": "Invalid topology link: source and destination assets cannot be identical.",
                "code": "INVALID_SELF_LINK",
                "errors": ["Specify two distinct network assets."],
            },
        )

    src = db.get(Asset, req.source_asset_id)
    if not src:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "detail": f"Source asset '{req.source_asset_id}' not found in database.",
                "code": "ASSET_NOT_FOUND",
                "errors": ["Verify source asset ID."],
            },
        )

    dst = db.get(Asset, req.destination_asset_id)
    if not dst:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "detail": f"Destination asset '{req.destination_asset_id}' not found in database.",
                "code": "ASSET_NOT_FOUND",
                "errors": ["Verify destination asset ID."],
            },
        )

    existing = db.scalar(select(NetworkLink).where(NetworkLink.link_id == req.link_id.strip()))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "detail": f"Link with ID '{req.link_id}' already exists.",
                "code": "LINK_EXISTS",
                "errors": ["Use a unique link ID."],
            },
        )

    link = NetworkLink(
        link_id=req.link_id.strip(),
        source_asset_id=src.asset_id,
        destination_asset_id=dst.asset_id,
        link_type=req.link_type.lower(),
        capacity_gbps=req.capacity_gbps,
        utilization_pct=req.utilization_pct,
        status=req.status.lower(),
        is_synthetic=True,  # Explicit demonstration topology flag
    )
    db.add(link)
    db.commit()
    db.refresh(link)

    return NetworkLinkResponse(
        id=link.id,
        link_id=link.link_id,
        source_asset_id=link.source_asset_id,
        destination_asset_id=link.destination_asset_id,
        source_lat=src.latitude,
        source_lng=src.longitude,
        dest_lat=dst.latitude,
        dest_lng=dst.longitude,
        source_city=src.city,
        dest_city=dst.city,
        link_type=link.link_type,
        capacity_gbps=link.capacity_gbps,
        utilization_pct=link.utilization_pct,
        status=link.status,
        is_synthetic=link.is_synthetic,
        created_at=link.created_at,
    )


@router.delete("/links/{link_id}")
def delete_topology_link(
    link_id: str,
    _user: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db),
):
    """Delete a network topology link (Administrator role required)."""
    link = db.scalar(select(NetworkLink).where(NetworkLink.link_id == link_id))
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "detail": f"Link '{link_id}' not found.",
                "code": "LINK_NOT_FOUND",
                "errors": ["Check link ID."],
            },
        )
    db.delete(link)
    db.commit()
    return {"message": f"Link '{link_id}' deleted successfully.", "status": "ok"}
