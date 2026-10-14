"""Helper utilities for converting DB models to schemas."""
from typing import Any, Dict, Optional
from backend.app.models import Asset, Reading
from backend.app.schemas import ReadingResponse
from backend.ml.inference import threshold_breaches


def reading_to_response(reading: Reading, asset: Optional[Asset] = None) -> ReadingResponse:
    """Format a Reading ORM instance into a ReadingResponse schema, including SLA threshold breaches."""
    target_asset = asset or reading.asset

    eval_dict: Dict[str, Any] = {
        "Signal_Strength_dBm": reading.signal_strength_dbm,
        "Latency_ms": reading.latency_ms,
        "Packet_Loss_pct": reading.packet_loss_pct,
        "Throughput_Mbps": reading.throughput_mbps,
        "Connected_Users": reading.connected_users,
        "Traffic_Load_pct": reading.traffic_load_pct,
        "Call_Drop_Rate_pct": reading.call_drop_rate_pct,
        "Resource_Utilization_pct": reading.resource_utilization_pct,
        "Network_Stress_Index": reading.network_stress_index,
        "Signal_Quality_Score": reading.signal_quality_score,
        "Throughput_per_User": reading.throughput_per_user,
    }

    breaches = threshold_breaches(eval_dict)

    return ReadingResponse(
        asset_id=reading.asset_id,
        asset_type=target_asset.asset_type if target_asset else "Unknown",
        continent=target_asset.continent if target_asset else None,
        country=target_asset.country if target_asset else None,
        city=target_asset.city if target_asset else None,
        region=target_asset.region if target_asset else None,
        latitude=target_asset.latitude if target_asset else None,
        longitude=target_asset.longitude if target_asset else None,
        timestamp=reading.timestamp,
        signal_strength_dbm=reading.signal_strength_dbm,
        latency_ms=reading.latency_ms,
        packet_loss_pct=reading.packet_loss_pct,
        throughput_mbps=reading.throughput_mbps,
        connected_users=reading.connected_users,
        traffic_load_pct=reading.traffic_load_pct,
        call_drop_rate_pct=reading.call_drop_rate_pct,
        resource_utilization_pct=reading.resource_utilization_pct,
        peak_hour=reading.peak_hour,
        network_stress_index=reading.network_stress_index,
        signal_quality_score=reading.signal_quality_score,
        throughput_per_user=reading.throughput_per_user,
        risk_label=reading.risk_label,
        risk_score=reading.risk_score,
        is_at_risk=reading.is_at_risk,
        dbscan_cluster=reading.dbscan_cluster,
        is_anomaly=reading.is_anomaly,
        nearest_core_distance=reading.nearest_core_distance,
        status=reading.status,
        threshold_breaches=breaches,
        model_version=reading.model_version,
        source=reading.source,
    )
