"""One-off status recalculation script for NEXUSNET.

Updates ONLY the readings.status column from stored values (is_at_risk, is_anomaly, metrics).
Does NOT re-run SVM or DBSCAN; does NOT change scores, labels, DB schema, or other fields.

Rules:
1. red    = is_at_risk is true (regardless of anomaly)
2. purple = is_anomaly is true AND not at risk
3. yellow = not at risk, not anomaly, but near-threshold: any label-clause metric from
            backend/ml/config.json at >= 80% of its limit, OR Network_Stress_Index > 45,
            OR Signal_Quality_Score < 35
4. green  = everything else
"""
import sys
from pathlib import Path

# Add project root and backend dir to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BASE_DIR))

import pandas as pd
from sqlalchemy import select
from backend.app.db import SessionLocal
from backend.app.models import Reading
from backend.app.status_policy import compute_status_vectorized


def recalculate_readings_status() -> None:
    """Recalculate status column for all stored readings in the database."""
    db = SessionLocal()
    try:
        readings = db.scalars(select(Reading)).all()
        total_readings = len(readings)
        print(f"[RECALCULATE] Found {total_readings} readings in database.")

        if total_readings == 0:
            print("[RECALCULATE] No readings to update.")
            return

        # Build DataFrame of stored values
        data = []
        for r in readings:
            data.append({
                "id": r.id,
                "is_at_risk": bool(r.is_at_risk),
                "is_anomaly": bool(r.is_anomaly),
                "Network_Stress_Index": r.network_stress_index,
                "Signal_Quality_Score": r.signal_quality_score,
                "Latency_ms": r.latency_ms,
                "Packet_Loss_pct": r.packet_loss_pct,
                "Call_Drop_Rate_pct": r.call_drop_rate_pct,
                "old_status": r.status,
            })
        df = pd.DataFrame(data)

        # Compute status with strict precedence
        new_statuses = compute_status_vectorized(df)
        df["new_status"] = new_statuses

        # Update Reading.status
        reading_dict = {r.id: r for r in readings}
        changed_count = 0
        for _, row in df.iterrows():
            rid = int(row["id"])
            new_st = str(row["new_status"])
            reading = reading_dict[rid]
            if reading.status != new_st:
                reading.status = new_st
                changed_count += 1

        db.commit()
        print(f"[RECALCULATE] Updated status for {changed_count} readings (out of {total_readings}).")

        # Counts verification
        counts = df["new_status"].value_counts().to_dict()
        at_risk_count = int(df["is_at_risk"].sum())
        anom_not_risk = int(((df["is_anomaly"] == True) & (df["is_at_risk"] == False)).sum())
        total_sum = sum(counts.values())

        print("=== RECALCULATION SUMMARY ===")
        print(f"Red:    {counts.get('red', 0)}")
        print(f"Purple: {counts.get('purple', 0)}")
        print(f"Yellow: {counts.get('yellow', 0)}")
        print(f"Green:  {counts.get('green', 0)}")
        print(f"Total:  {total_sum}")
        print(f"Total at-risk: {at_risk_count} (Red matches: {counts.get('red', 0) == at_risk_count})")
        print(f"Anomalies not at risk: {anom_not_risk} (Purple matches: {counts.get('purple', 0) == anom_not_risk})")
        print(f"Sum matches total: {total_sum == total_readings}")

    finally:
        db.close()


if __name__ == "__main__":
    recalculate_readings_status()
