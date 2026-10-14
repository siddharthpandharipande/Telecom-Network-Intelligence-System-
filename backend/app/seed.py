"""Database Seeding Script for NEXUSNET.

Usage:
    python -m backend.app.seed

Loads the canonical 6,000 asset telemetry records, validates with the unified ingestion
validator, runs vectorized ML inference, bulk-inserts assets and readings idempotently,
and opens auto-incidents for the top at-risk assets.
"""
from __future__ import annotations

import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.db import SessionLocal, init_db
from backend.app.ingestion import (
    parse_csv_to_dataframe,
    process_ingestion,
)
from backend.app.models import Asset, Incident, IncidentEvent, IngestionLog, Reading, utc_now
from backend.app.settings import settings


def seed_database(session: Optional[Session] = None, force_reseed: bool = False) -> Dict[str, Any]:
    """Idempotently seed database from canonical 6,000 CSV records.

    Parameters
    ----------
    session : Optional[Session]
        Existing DB session, or None to create one.
    force_reseed : bool
        If False, skips seeding if database already contains readings.
    """
    start_time = time.time()
    db = session or SessionLocal()
    own_session = session is None

    try:
        init_db()

        existing_readings_count = db.scalar(select(func.count(Reading.id))) or 0
        if existing_readings_count > 0 and not force_reseed:
            print(
                f"[SEED] Database already populated with {existing_readings_count} readings. Skipping duplicate seed."
            )
            return {
                "status": "skipped",
                "existing_readings": existing_readings_count,
            }

        csv_path = settings.DATASET_PATH
        if not csv_path.exists():
            raise FileNotFoundError(f"Canonical seed CSV not found at: {csv_path}")

        print(f"[SEED] Reading canonical dataset from: {csv_path}")
        with open(csv_path, "rb") as f:
            csv_bytes = f.read()

        raw_df, header_warnings = parse_csv_to_dataframe(csv_bytes)
        print(f"[SEED] Parsed {len(raw_df)} rows. Processing vectorized ingestion pipeline...")

        # Process ingestion with source='seed'
        report = process_ingestion(
            db=db,
            raw_df=raw_df,
            filename=csv_path.name,
            source="seed",
            impute=False,
            dry_run=False,
        )

        # Create auto-incidents for top SEED_INCIDENT_LIMIT at-risk readings
        limit = settings.SEED_INCIDENT_LIMIT
        top_at_risk_readings = db.scalars(
            select(Reading)
            .where(Reading.is_at_risk == True)  # noqa: E712
            .order_by(Reading.risk_score.desc(), Reading.timestamp.desc())
            .limit(limit)
        ).all()

        now = utc_now()
        incidents_created = 0

        # Check existing incidents
        existing_incident_assets = set(db.scalars(select(Incident.asset_id)).all())

        for r in top_at_risk_readings:
            if r.asset_id not in existing_incident_assets:
                severity = (
                    "critical"
                    if (r.is_at_risk and r.is_anomaly) or r.risk_score >= 0.90
                    else "high"
                )
                title = f"High Risk Severity Incident for Asset {r.asset_id}"
                inc = Incident(
                    asset_id=r.asset_id,
                    reading_id=r.id,
                    severity=severity,
                    title=title,
                    status="open",
                    source="auto",
                    created_at=now,
                    updated_at=now,
                )
                db.add(inc)
                db.flush()

                event = IncidentEvent(
                    incident_id=inc.id,
                    ts=now,
                    actor="system",
                    action="opened",
                    note="Incident opened automatically during initial database seed",
                    to_status="open",
                )
                db.add(event)
                existing_incident_assets.add(r.asset_id)
                incidents_created += 1

        db.commit()
        duration = time.time() - start_time

        print(
            f"[SEED] Successfully seeded database in {duration:.2f}s:\n"
            f"       - Total Assets   : {db.scalar(select(func.count(Asset.asset_id)))}\n"
            f"       - Total Readings : {db.scalar(select(func.count(Reading.id)))}\n"
            f"       - Auto Incidents : {incidents_created} (limit: {limit})\n"
            f"       - Risk Breakdown : {report['risk_summary']['status_counts']}"
        )

        return {
            "status": "success",
            "duration_seconds": round(duration, 2),
            "report": report,
            "incidents_created": incidents_created,
        }

    finally:
        if own_session:
            db.close()


if __name__ == "__main__":
    seed_database()
