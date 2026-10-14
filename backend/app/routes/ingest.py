"""CSV file ingestion and log routes."""
import json
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.ingestion import parse_csv_to_dataframe, process_ingestion
from backend.app.models import IngestionLog
from backend.app.settings import settings

router = APIRouter(prefix="/ingest", tags=["Ingestion"])


@router.post("/csv")
async def ingest_csv_file(
    file: UploadFile = File(...),
    dry_run: bool = Query(False, description="Simulate ingestion without writing to database"),
    impute: bool = Query(False, description="Impute missing telemetry metrics from training medians"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Upload and ingest a CSV file of network asset telemetry records."""
    content = await file.read()

    if len(content) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail={
                "detail": f"File size exceeds maximum allowed upload size ({settings.MAX_UPLOAD_BYTES / (1024*1024):.1f} MB)",
                "code": "FILE_TOO_LARGE",
                "errors": [f"File size {len(content)} bytes exceeds limit {settings.MAX_UPLOAD_BYTES}"],
            },
        )

    try:
        raw_df, header_warnings = parse_csv_to_dataframe(content)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail={
                "detail": f"Unable to parse CSV file: {str(e)}",
                "code": "INVALID_CSV",
                "errors": [str(e)],
            },
        )

    if len(raw_df) > settings.MAX_ROWS:
        raise HTTPException(
            status_code=400,
            detail={
                "detail": f"CSV exceeds maximum row limit of {settings.MAX_ROWS} rows",
                "code": "TOO_MANY_ROWS",
                "errors": [f"Encountered {len(raw_df)} rows; limit is {settings.MAX_ROWS}"],
            },
        )

    report = process_ingestion(
        db=db,
        raw_df=raw_df,
        filename=file.filename or "uploaded.csv",
        source="csv",
        impute=impute,
        dry_run=dry_run,
    )

    if header_warnings:
        report["warnings"].extend(header_warnings)

    return report


@router.get("/log")
def get_ingestion_logs(
    limit: int = Query(20, ge=1, le=100, description="Max log items to return"),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Retrieve historical ingestion logs."""
    logs = (
        db.scalars(select(IngestionLog).order_by(IngestionLog.created_at.desc()).limit(limit))
        .all()
    )

    results = []
    for log in logs:
        parsed_report = {}
        if log.report_json:
            try:
                parsed_report = json.loads(log.report_json)
            except Exception:
                pass

        results.append(
            {
                "id": log.id,
                "created_at": log.created_at,
                "filename": log.filename,
                "source": log.source,
                "rows_total": log.rows_total,
                "accepted": log.accepted,
                "rejected": log.rejected,
                "imputed": log.imputed,
                "updated": log.updated,
                "duplicates_in_file": log.duplicates_in_file,
                "report": parsed_report,
            }
        )
    return results
