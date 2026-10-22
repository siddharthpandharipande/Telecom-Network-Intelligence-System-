"""Pydantic V2 schemas for NEXUSNET FastAPI application."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ErrorResponse(BaseModel):
    detail: str
    code: str
    errors: List[Any] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: str
    model_version: str
    db_readings: int
    db_assets: int
    models_loaded: bool


class ReadingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    asset_id: str
    asset_type: Optional[str] = "Unknown"
    continent: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timestamp: datetime

    # Telemetry
    signal_strength_dbm: float
    latency_ms: float
    packet_loss_pct: float
    throughput_mbps: float
    connected_users: int
    traffic_load_pct: float
    call_drop_rate_pct: float
    resource_utilization_pct: float

    # Engineered
    peak_hour: int
    network_stress_index: float
    signal_quality_score: float
    throughput_per_user: float

    # Model predictions
    risk_label: str
    risk_score: float
    is_at_risk: bool
    dbscan_cluster: int
    is_anomaly: bool
    nearest_core_distance: float

    # Status & Policy
    status: str
    threshold_breaches: List[Dict[str, Any]] = Field(default_factory=list)
    model_version: str
    source: str


class PredictResponse(BaseModel):
    reading: ReadingResponse
    validation: Dict[str, Any]


class AssetSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    asset_id: str
    asset_type: str
    continent: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: datetime
    updated_at: datetime


class AssetDetailResponse(BaseModel):
    asset: AssetSummary
    latest: Optional[ReadingResponse] = None
    history: List[ReadingResponse] = Field(default_factory=list)


class PaginatedAssetsResponse(BaseModel):
    items: List[ReadingResponse]
    total: int
    page: int
    page_size: int


class MapPoint(BaseModel):
    asset_id: str
    latitude: float
    longitude: float
    status: str
    is_at_risk: bool
    is_anomaly: bool
    asset_type: str
    city: Optional[str] = None
    country: Optional[str] = None
    continent: Optional[str] = None



class IncidentEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    incident_id: int
    ts: datetime
    actor: str
    action: str
    note: Optional[str] = None
    from_status: Optional[str] = None
    to_status: Optional[str] = None


class IncidentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    asset_id: str
    reading_id: Optional[int] = None
    severity: str
    title: str
    status: str
    assignee: Optional[str] = None
    source: str
    created_at: datetime
    updated_at: datetime
    events: List[IncidentEventResponse] = Field(default_factory=list)


class PaginatedIncidentsResponse(BaseModel):
    items: List[IncidentResponse]
    total: int
    page: int
    page_size: int


class IncidentActionRequest(BaseModel):
    action: str = Field(..., description="Action: acknowledge, assign, investigate, resolve, escalate")
    assignee: Optional[str] = None
    note: Optional[str] = None
    actor: Optional[str] = "operator"


class ReplayResponse(BaseModel):
    items: List[ReadingResponse]
    next_cursor: int
    has_more: bool


class ReplayMetaResponse(BaseModel):
    start_time: str
    end_time: str
    distinct_hours: List[int]
    total_readings: int
    is_snapshot: bool
    snapshot_date: str


class ReplayHourResponse(BaseModel):
    hour: int
    timestamp_sample: str
    count: int
    readings: List[MapPoint]


# Authentication & RBAC Schemas
class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    user_id: int
    username: str
    full_name: str
    role: str
    expires_at: datetime


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime


class CreateUserRequest(BaseModel):
    username: str
    password: str
    full_name: str
    role: str = "noc_analyst"


# Network Topology Links Schemas
class NetworkLinkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    link_id: str
    source_asset_id: str
    destination_asset_id: str
    source_lat: Optional[float] = None
    source_lng: Optional[float] = None
    dest_lat: Optional[float] = None
    dest_lng: Optional[float] = None
    source_city: Optional[str] = None
    dest_city: Optional[str] = None
    link_type: str  # fiber, microwave, satellite
    capacity_gbps: float
    utilization_pct: float
    status: str  # up, degraded, down
    is_synthetic: bool
    created_at: datetime


class CreateLinkRequest(BaseModel):
    link_id: str
    source_asset_id: str
    destination_asset_id: str
    link_type: str = "fiber"
    capacity_gbps: float = 10.0
    utilization_pct: float = 50.0
    status: str = "up"
