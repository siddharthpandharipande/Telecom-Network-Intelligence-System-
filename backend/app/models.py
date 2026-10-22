"""SQLAlchemy 2.x database models for NEXUSNET."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utc_now() -> datetime:
    """Return current naive UTC datetime."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


class Asset(Base):
    __tablename__ = "assets"

    asset_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    asset_type: Mapped[str] = mapped_column(String(64), nullable=False, default="Unknown")
    continent: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    region: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    latest_reading_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    readings: Mapped[List["Reading"]] = relationship(
        "Reading",
        back_populates="asset",
        cascade="all, delete-orphan",
        foreign_keys="Reading.asset_id",
    )
    incidents: Mapped[List["Incident"]] = relationship(
        "Incident",
        back_populates="asset",
        cascade="all, delete-orphan",
    )
    outgoing_links: Mapped[List["NetworkLink"]] = relationship(
        "NetworkLink",
        foreign_keys="NetworkLink.source_asset_id",
        back_populates="source_asset",
        cascade="all, delete-orphan",
    )
    incoming_links: Mapped[List["NetworkLink"]] = relationship(
        "NetworkLink",
        foreign_keys="NetworkLink.destination_asset_id",
        back_populates="destination_asset",
        cascade="all, delete-orphan",
    )


class Reading(Base):
    __tablename__ = "readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    asset_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("assets.asset_id", ondelete="CASCADE"), nullable=False, index=True
    )
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)

    # 8 raw base telemetry metrics
    signal_strength_dbm: Mapped[float] = mapped_column(Float, nullable=False)
    latency_ms: Mapped[float] = mapped_column(Float, nullable=False)
    packet_loss_pct: Mapped[float] = mapped_column(Float, nullable=False)
    throughput_mbps: Mapped[float] = mapped_column(Float, nullable=False)
    connected_users: Mapped[int] = mapped_column(Integer, nullable=False)
    traffic_load_pct: Mapped[float] = mapped_column(Float, nullable=False)
    call_drop_rate_pct: Mapped[float] = mapped_column(Float, nullable=False)
    resource_utilization_pct: Mapped[float] = mapped_column(Float, nullable=False)

    # 4 engineered features
    peak_hour: Mapped[int] = mapped_column(Integer, nullable=False)
    network_stress_index: Mapped[float] = mapped_column(Float, nullable=False)
    signal_quality_score: Mapped[float] = mapped_column(Float, nullable=False)
    throughput_per_user: Mapped[float] = mapped_column(Float, nullable=False)

    # Model inference results
    risk_label: Mapped[str] = mapped_column(String(32), nullable=False)
    risk_score: Mapped[float] = mapped_column(Float, nullable=False)
    is_at_risk: Mapped[bool] = mapped_column(Boolean, nullable=False)
    dbscan_cluster: Mapped[int] = mapped_column(Integer, nullable=False)
    is_anomaly: Mapped[bool] = mapped_column(Boolean, nullable=False)
    nearest_core_distance: Mapped[float] = mapped_column(Float, nullable=False)

    # Status policy & provenance
    status: Mapped[str] = mapped_column(String(16), nullable=False, index=True)  # green, yellow, purple, red
    model_version: Mapped[str] = mapped_column(String(32), nullable=False)
    source: Mapped[str] = mapped_column(String(16), nullable=False)  # 'seed' | 'manual' | 'csv'
    ingestion_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("ingestion_log.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    # Constraints & Relationships
    __table_args__ = (
        UniqueConstraint("asset_id", "timestamp", name="uq_asset_timestamp"),
        Index("ix_readings_asset_time", "asset_id", "timestamp"),
    )

    asset: Mapped["Asset"] = relationship("Asset", back_populates="readings", foreign_keys=[asset_id])
    ingestion: Mapped[Optional["IngestionLog"]] = relationship("IngestionLog", back_populates="readings")


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    asset_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("assets.asset_id", ondelete="CASCADE"), nullable=False, index=True
    )
    reading_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("readings.id", ondelete="SET NULL"), nullable=True
    )
    severity: Mapped[str] = mapped_column(String(16), nullable=False, index=True)  # 'critical' | 'high' | 'medium'
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="open", index=True
    )  # 'open'|'acknowledged'|'assigned'|'investigating'|'resolved'|'escalated'
    assignee: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    source: Mapped[str] = mapped_column(String(16), nullable=False, default="auto")  # 'auto' | 'manual'
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    asset: Mapped["Asset"] = relationship("Asset", back_populates="incidents")
    reading: Mapped[Optional["Reading"]] = relationship("Reading")
    events: Mapped[List["IncidentEvent"]] = relationship(
        "IncidentEvent",
        back_populates="incident",
        cascade="all, delete-orphan",
        order_by="IncidentEvent.ts.asc()",
    )


class IncidentEvent(Base):
    __tablename__ = "incident_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    incident_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ts: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    actor: Mapped[str] = mapped_column(String(128), nullable=False, default="system")
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    from_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    to_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    incident: Mapped["Incident"] = relationship("Incident", back_populates="events")


class IngestionLog(Base):
    __tablename__ = "ingestion_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    source: Mapped[str] = mapped_column(String(32), nullable=False)  # 'seed' | 'csv' | 'manual'
    rows_total: Mapped[int] = mapped_column(Integer, nullable=False)
    accepted: Mapped[int] = mapped_column(Integer, nullable=False)
    rejected: Mapped[int] = mapped_column(Integer, nullable=False)
    imputed: Mapped[int] = mapped_column(Integer, nullable=False)
    updated: Mapped[int] = mapped_column(Integer, nullable=False)
    duplicates_in_file: Mapped[int] = mapped_column(Integer, nullable=False)
    report_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    readings: Mapped[List["Reading"]] = relationship("Reading", back_populates="ingestion")


class NetworkLink(Base):
    __tablename__ = "network_links"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    link_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    source_asset_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("assets.asset_id", ondelete="CASCADE"), nullable=False, index=True
    )
    destination_asset_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("assets.asset_id", ondelete="CASCADE"), nullable=False, index=True
    )
    link_type: Mapped[str] = mapped_column(String(32), nullable=False, default="fiber")  # fiber, microwave, satellite
    capacity_gbps: Mapped[float] = mapped_column(Float, nullable=False, default=10.0)
    utilization_pct: Mapped[float] = mapped_column(Float, nullable=False, default=50.0)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="up")  # up, degraded, down
    is_synthetic: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)

    source_asset: Mapped["Asset"] = relationship(
        "Asset", foreign_keys=[source_asset_id], back_populates="outgoing_links"
    )
    destination_asset: Mapped["Asset"] = relationship(
        "Asset", foreign_keys=[destination_asset_id], back_populates="incoming_links"
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(128), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default="noc_analyst")  # noc_analyst, network_engineer, admin
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    sessions: Mapped[List["UserSession"]] = relationship(
        "UserSession", back_populates="user", cascade="all, delete-orphan"
    )


class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    token: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    user: Mapped["User"] = relationship("User", back_populates="sessions")
