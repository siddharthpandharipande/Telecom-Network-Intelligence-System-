"""Incident management, status lifecycle transition, and auditing routes."""
from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from backend.app.db import get_db
from backend.app.models import Incident, IncidentEvent
from backend.app.schemas import (
    IncidentActionRequest,
    IncidentResponse,
    PaginatedIncidentsResponse,
)

router = APIRouter(prefix="/incidents", tags=["Incidents"])

# Strict incident lifecycle transition table
VALID_TRANSITIONS: Dict[str, set[str]] = {
    "open": {"acknowledged", "escalated"},
    "acknowledged": {"assigned", "investigating", "escalated"},
    "assigned": {"investigating", "escalated"},
    "investigating": {"resolved", "escalated"},
    "escalated": {"assigned", "investigating", "resolved"},
    "resolved": set(),  # terminal state
}

ACTION_TO_TARGET_STATUS: Dict[str, str] = {
    "acknowledge": "acknowledged",
    "assign": "assigned",
    "investigate": "investigating",
    "resolve": "resolved",
    "escalate": "escalated",
}


@router.get("", response_model=PaginatedIncidentsResponse)
def list_incidents(
    status: Optional[str] = Query(None, description="Filter by status"),
    severity: Optional[str] = Query(None, description="Filter by severity (critical, high, medium)"),
    asset_id: Optional[str] = Query(None, description="Filter by asset ID"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """List operational incidents with optional filtering and pagination."""
    query = select(Incident).options(selectinload(Incident.events))

    if status:
        query = query.where(Incident.status == status.lower())
    if severity:
        query = query.where(Incident.severity == severity.lower())
    if asset_id:
        query = query.where(Incident.asset_id == asset_id)

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0

    offset = (page - 1) * page_size
    query = query.order_by(Incident.created_at.desc()).offset(offset).limit(page_size)
    incidents = db.scalars(query).all()

    return {
        "items": [IncidentResponse.model_validate(inc) for inc in incidents],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(
    incident_id: int,
    db: Session = Depends(get_db),
) -> IncidentResponse:
    """Retrieve detailed incident record and complete event audit timeline."""
    query = (
        select(Incident)
        .options(selectinload(Incident.events))
        .where(Incident.id == incident_id)
    )
    incident = db.scalars(query).first()

    if not incident:
        raise HTTPException(
            status_code=404,
            detail={
                "detail": f"Incident with ID {incident_id} not found",
                "code": "INCIDENT_NOT_FOUND",
                "errors": [f"No incident exists with ID {incident_id}"],
            },
        )

    return IncidentResponse.model_validate(incident)


@router.post("/{incident_id}/action", response_model=IncidentResponse)
def apply_incident_action(
    incident_id: int,
    payload: IncidentActionRequest,
    db: Session = Depends(get_db),
) -> IncidentResponse:
    """Execute a lifecycle transition on an incident enforcing state transition rules."""
    query = (
        select(Incident)
        .options(selectinload(Incident.events))
        .where(Incident.id == incident_id)
    )
    incident = db.scalars(query).first()

    if not incident:
        raise HTTPException(
            status_code=404,
            detail={
                "detail": f"Incident with ID {incident_id} not found",
                "code": "INCIDENT_NOT_FOUND",
                "errors": [f"No incident exists with ID {incident_id}"],
            },
        )

    action = payload.action.strip().lower()
    if action not in ACTION_TO_TARGET_STATUS:
        raise HTTPException(
            status_code=400,
            detail={
                "detail": f"Unknown incident action: '{action}'",
                "code": "INVALID_ACTION",
                "errors": [f"Allowed actions: {list(ACTION_TO_TARGET_STATUS.keys())}"],
            },
        )

    target_status = ACTION_TO_TARGET_STATUS[action]
    current_status = incident.status

    allowed_targets = VALID_TRANSITIONS.get(current_status, set())
    if target_status not in allowed_targets:
        raise HTTPException(
            status_code=409,
            detail={
                "detail": f"Invalid state transition from '{current_status}' to '{target_status}'",
                "code": "INVALID_STATE_TRANSITION",
                "errors": [
                    f"Allowed transitions from '{current_status}': {sorted(list(allowed_targets)) or ['None (terminal state)']}"
                ],
            },
        )

    now = datetime.utcnow()
    incident.status = target_status
    if payload.assignee:
        incident.assignee = payload.assignee
    incident.updated_at = now

    event = IncidentEvent(
        incident_id=incident.id,
        ts=now,
        actor=payload.actor or "operator",
        action=action,
        note=payload.note,
        from_status=current_status,
        to_status=target_status,
    )
    db.add(event)
    db.commit()
    db.refresh(incident)

    return IncidentResponse.model_validate(incident)
