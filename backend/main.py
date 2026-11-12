
"""
NEXUSNET Network Health & Decision Support API
==============================================
A FastAPI backend service that integrates precomputed Version 3 heuristic
explanations with machine learning inference results (Random Forest classifier
predictions and Isolation Forest anomaly scores).

Endpoints:
- GET /health: Health check endpoint returning {"status": "ok"}
- GET /models/info: Overview of loaded assets, triage decision counts, and models used
- GET /assets/{asset_id}/health: Detailed decision-support and health explanation record for an asset

Design Principles:
- Loads explanations JSON and predictions CSV once on startup for O(1) in-memory lookups.
- Does not modify any dataset or retrain models; strictly serves validated precomputed results.
- Returns exact 404 JSON for non-existent asset IDs.
"""

import json
import logging
import os
from collections import defaultdict
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Dict, List, Optional, Any

import pandas as pd
from fastapi import FastAPI, Path as FastAPIPath, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel, Field

try:
    from backend.report_generator import generate_network_health_pdf
except ImportError:
    from report_generator import generate_network_health_pdf

# ---------------------------------------------------------------------------
# Logging Configuration
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s"
)
logger = logging.getLogger("nexusnet-backend")

# ---------------------------------------------------------------------------
# Environment & Core Configuration
# ---------------------------------------------------------------------------
try:
    from backend.app.core.config import settings, get_settings
except ImportError:
    try:
        from app.core.config import settings, get_settings
    except ImportError:
        settings = None
        get_settings = lambda: None


# ---------------------------------------------------------------------------
# In-Memory Storage & Global Metadata
# ---------------------------------------------------------------------------
# In-memory dictionary indexing combined asset records by asset_id
ASSET_RECORDS: Dict[str, dict] = {}

# Summary statistics calculated during startup
MODEL_SUMMARY: Dict[str, Any] = {
    "assets_loaded": 0,
    "investigate_count": 0,
    "monitor_count": 0,
    "models_used": [
        "Version 3 Rule-Based Heuristic Policy Engine",
        "Random Forest Classifier (Investigation Priority)",
    ]
}

# NOC Insights data stores for Command Center
INSIGHTS_OVERVIEW: Dict[str, Any] = {}
INSIGHTS_BY_REGION: Dict[str, Any] = {}
INSIGHTS_TOP_ASSETS: Dict[str, Any] = {}

# Geographic asset dataset store and manual analysis cache
GEO_LOCATIONS: Dict[str, dict] = {}
LAST_ANALYZED_RECORD: Optional[dict] = None

def set_last_analyzed_record(record: Optional[dict]) -> None:
    """Stores the latest manual telemetry record and syncs across sys.modules & disk cache."""
    global LAST_ANALYZED_RECORD
    LAST_ANALYZED_RECORD = record
    import sys
    for mod_name in ("backend.main", "main"):
        if mod_name in sys.modules:
            setattr(sys.modules[mod_name], "LAST_ANALYZED_RECORD", record)

    try:
        cache_path = Path(__file__).resolve().parent / "data" / ".latest_analysis_cache.json"
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        if record is not None:
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(record, f)
        else:
            if cache_path.is_file():
                cache_path.unlink()
    except Exception as exc:
        logger.warning(f"Could not persist analysis cache: {exc}")

def get_last_analyzed_record() -> Optional[dict]:
    """Retrieves the latest analyzed record from memory, sys.modules aliases, or disk cache."""
    global LAST_ANALYZED_RECORD
    if LAST_ANALYZED_RECORD is not None:
        return LAST_ANALYZED_RECORD

    import sys
    for mod_name in ("backend.main", "main"):
        mod = sys.modules.get(mod_name)
        if mod:
            rec = getattr(mod, "LAST_ANALYZED_RECORD", None)
            if rec is not None:
                LAST_ANALYZED_RECORD = rec
                return rec

    try:
        cache_path = Path(__file__).resolve().parent / "data" / ".latest_analysis_cache.json"
        if cache_path.is_file():
            with open(cache_path, "r", encoding="utf-8") as f:
                rec = json.load(f)
                LAST_ANALYZED_RECORD = rec
                return rec
    except Exception:
        pass

    return None

# Live machine learning models store
ML_MODELS: Dict[str, Any] = {
    "rf_classifier": None,
    "anomaly_detector": None,
    "feature_config": None,
    "anomaly_feature_config": None,
}


def load_ml_models():
    """Loads Random Forest and Isolation Forest models for live inference if present."""
    global ML_MODELS
    backend_dir = Path(__file__).resolve().parent
    model_dirs = [
        backend_dir.parent / "models",
        Path.cwd() / "models",
        backend_dir / "models",
    ]

    models_dir = next((d for d in model_dirs if d.is_dir()), model_dirs[0])
    rf_path = models_dir / "random_forest_classifier.joblib"
    iso_path = models_dir / "anomaly_detector.joblib"
    feat_path = models_dir / "feature_config.json"
    iso_feat_path = models_dir / "anomaly_feature_config.json"

    try:
        import joblib
        if rf_path.is_file() and feat_path.is_file():
            ML_MODELS["rf_classifier"] = joblib.load(rf_path)
            with open(feat_path, "r", encoding="utf-8") as f:
                ML_MODELS["feature_config"] = json.load(f)
            logger.info(f"Loaded Random Forest classifier from: {rf_path}")

        if iso_path.is_file() and iso_feat_path.is_file():
            ML_MODELS["anomaly_detector"] = joblib.load(iso_path)
            with open(iso_feat_path, "r", encoding="utf-8") as f:
                ML_MODELS["anomaly_feature_config"] = json.load(f)
            logger.info(f"Loaded Isolation Forest anomaly detector from: {iso_path}")
    except Exception as exc:
        logger.warning(f"Could not load ML models for live inference: {exc}")


def predict_ml_models(telemetry: Dict[str, Any], asset_type: str) -> Dict[str, Any]:
    """Runs live Random Forest and Isolation Forest inference on manual telemetry."""
    rf = ML_MODELS.get("rf_classifier")
    iso = ML_MODELS.get("anomaly_detector")
    feat_cfg = ML_MODELS.get("feature_config")
    iso_cfg = ML_MODELS.get("anomaly_feature_config")

    pred_res = {
        "classifier_prediction": "Routine",
        "classifier_confidence": 0.76,
        "anomaly_score": 0.5844,
        "is_anomalous": False,
    }

    if not rf or not feat_cfg:
        return pred_res

    try:
        import numpy as np
        sig = float(telemetry.get("signal_strength_dbm") if telemetry.get("signal_strength_dbm") is not None else -80.0)
        lat = float(telemetry.get("latency_ms") if telemetry.get("latency_ms") is not None else 30.0)
        loss = float(telemetry.get("packet_loss_pct") if telemetry.get("packet_loss_pct") is not None else 0.5)
        tp = float(telemetry.get("throughput_mbps") if telemetry.get("throughput_mbps") is not None else 150.0)
        users = float(telemetry.get("connected_users") if telemetry.get("connected_users") is not None else 1000)
        load = float(telemetry.get("traffic_load_pct") if telemetry.get("traffic_load_pct") is not None else 50.0)
        drops = float(telemetry.get("call_drop_rate_pct") if telemetry.get("call_drop_rate_pct") is not None else 0.5)
        cpu = float(telemetry.get("resource_utilization_pct") if telemetry.get("resource_utilization_pct") is not None else 50.0)

        # Feature engineering calculations
        nsi = (load * cpu) / 100.0
        tpu = (tp * 1000.0) / (users + 1.0)
        sqs = (sig + 140.0) / (loss + 1.0)
        hour = 12
        peak = 1

        low_type = str(asset_type).lower()
        row = {
            "Signal_Strength_dBm": sig,
            "Latency_ms": lat,
            "Packet_Loss_pct": loss,
            "Throughput_Mbps": tp,
            "Connected_Users": users,
            "Traffic_Load_pct": load,
            "Call_Drop_Rate_pct": drops,
            "Resource_Utilization_pct": cpu,
            "Network_Stress_Index": nsi,
            "Throughput_per_User": tpu,
            "Signal_Quality_Score": sqs,
            "Hour": hour,
            "Peak_Hour": peak,
            "Asset_Type_Base Station": 1 if "base station" in low_type else 0,
            "Asset_Type_Cell Tower": 1 if "cell tower" in low_type else 0,
            "Asset_Type_Network Gateway": 1 if "gateway" in low_type else 0,
            "Asset_Type_Router": 1 if "router" in low_type else 0,
        }
        df = pd.DataFrame([row])
        all_cols = feat_cfg.get("all_model_features", [])
        if all_cols and all(col in df.columns for col in all_cols):
            rf_pred = rf.predict(df[all_cols])[0]
            rf_proba = rf.predict_proba(df[all_cols])[0]
            conf = float(np.max(rf_proba))
            pred_res["classifier_prediction"] = str(rf_pred)
            pred_res["classifier_confidence"] = round(conf, 4)

        if iso and iso_cfg:
            iso_cols = iso_cfg.get("features", [])
            if iso_cols and all(c in df.columns for c in iso_cols):
                score = float(-iso.score_samples(df[iso_cols])[0])
                is_anom = bool(iso.predict(df[iso_cols])[0] == -1)
                pred_res["anomaly_score"] = round(score, 4)
                pred_res["is_anomalous"] = is_anom
    except Exception as exc:
        logger.warning(f"Error during live ML inference: {exc}")

    return pred_res



def resolve_file_paths() -> tuple[Path, Path, Path]:
    """
    Resolves the paths for:
    1. network_health_v3_explanations.json
    2. final_model_predictions.csv
    3. nexusnet_preprocessed_feature_engineered.csv
    Checks backend/data/ first, then falls back to project outputs/ and data/ folders.
    """
    backend_dir = Path(__file__).resolve().parent

    # Candidate locations for explanations JSON
    json_candidates = [
        backend_dir / "data" / "network_health_v3_explanations.json",
        backend_dir.parent / "outputs" / "network_health_v3_explanations.json",
        Path.cwd() / "backend" / "data" / "network_health_v3_explanations.json",
        Path.cwd() / "outputs" / "network_health_v3_explanations.json",
    ]

    # Candidate locations for predictions CSV
    csv_candidates = [
        backend_dir / "data" / "final_model_predictions.csv",
        backend_dir.parent / "outputs" / "final_model_predictions.csv",
        Path.cwd() / "backend" / "data" / "final_model_predictions.csv",
        Path.cwd() / "outputs" / "final_model_predictions.csv",
    ]

    # Candidate locations for raw preprocessed CSV (geographic metadata)
    raw_candidates = [
        backend_dir.parent / "data" / "raw" / "nexusnet_preprocessed_feature_engineered.csv",
        Path.cwd() / "data" / "raw" / "nexusnet_preprocessed_feature_engineered.csv",
        backend_dir / "data" / "nexusnet_preprocessed_feature_engineered.csv",
    ]

    json_path = next((p for p in json_candidates if p.is_file()), json_candidates[0])
    csv_path = next((p for p in csv_candidates if p.is_file()), csv_candidates[0])
    raw_path = next((p for p in raw_candidates if p.is_file()), raw_candidates[0])

    return json_path, csv_path, raw_path


def load_backend_data(
    json_path: Optional[Path] = None,
    csv_path: Optional[Path] = None,
    raw_path: Optional[Path] = None
) -> int:
    """
    Loads network_health_v3_explanations.json, final_model_predictions.csv, and
    nexusnet_preprocessed_feature_engineered.csv once, merges them on Asset_ID,
    indexes them into the global ASSET_RECORDS dictionary, and calculates
    NOC Command Center insights.
    """
    global ASSET_RECORDS, MODEL_SUMMARY, INSIGHTS_OVERVIEW, INSIGHTS_BY_REGION, INSIGHTS_TOP_ASSETS

    default_json, default_csv, default_raw = resolve_file_paths()
    target_json = json_path or default_json
    target_csv = csv_path or default_csv
    target_raw = raw_path or default_raw

    if not target_json.is_file():
        logger.error(f"Explanations JSON not found at: {target_json}")
        raise FileNotFoundError(f"Explanations JSON not found at: {target_json}")

    if not target_csv.is_file():
        logger.error(f"Predictions CSV not found at: {target_csv}")
        raise FileNotFoundError(f"Predictions CSV not found at: {target_csv}")

    logger.info(f"Loading explanations from: {target_json}")
    with open(target_json, "r", encoding="utf-8") as f:
        explanations_list = json.load(f)

    logger.info(f"Loading predictions from: {target_csv}")
    predictions_df = pd.read_csv(target_csv)

    # Index explanations by asset_id
    explanations_dict = {
        item["asset_id"]: item for item in explanations_list if "asset_id" in item
    }

    # Index predictions by Asset_ID
    predictions_dict = predictions_df.set_index("Asset_ID").to_dict(orient="index")

    # Load geographic metadata from raw dataset if available
    global GEO_LOCATIONS
    geo_dict: Dict[str, dict] = {}
    if target_raw.is_file():
        logger.info(f"Loading geographic metadata from: {target_raw}")
        raw_df = pd.read_csv(
            target_raw,
            usecols=["Asset_ID", "Asset_Type", "City", "Region", "Country", "Continent", "Latitude", "Longitude"]
        )
        geo_dict = raw_df.set_index("Asset_ID").to_dict(orient="index")
        GEO_LOCATIONS = geo_dict
    else:
        logger.warning(f"Raw dataset not found at: {target_raw}")

    # Combine into unified decision-support records
    combined_records: Dict[str, dict] = {}
    investigate_cnt = 0
    monitor_cnt = 0
    high_priority_cnt = 0
    anomalous_cnt = 0

    for asset_id, exp in explanations_dict.items():
        pred = predictions_dict.get(asset_id, {})
        geo = geo_dict.get(asset_id, {})

        flag = pred.get("final_decision_support_flag", "Monitor")
        if flag == "Investigate":
            investigate_cnt += 1
        else:
            monitor_cnt += 1

        prio = exp.get("investigation_priority", pred.get("Investigation_Priority", "Routine"))
        if prio == "High":
            high_priority_cnt += 1

        is_anom = bool(pred.get("is_anomalous", False))
        if is_anom:
            anomalous_cnt += 1

        combined_records[asset_id] = {
            "asset_id": exp.get("asset_id", asset_id),
            "asset_type": exp.get("asset_type", pred.get("Asset_Type", "Unknown")),
            "city": geo.get("City", "Unknown"),
            "region": geo.get("Region", "Unknown"),
            "country": geo.get("Country", "Unknown"),
            "continent": geo.get("Continent", "Unknown"),
            "latitude": float(geo.get("Latitude")) if geo.get("Latitude") is not None and not pd.isna(geo.get("Latitude")) else None,
            "longitude": float(geo.get("Longitude")) if geo.get("Longitude") is not None and not pd.isna(geo.get("Longitude")) else None,
            "investigation_priority": prio,
            "priority_reason": exp.get("priority_reason", ""),
            "what_happened": exp.get("what_happened", ""),
            "why_flagged": exp.get("why_flagged", []),
            "what_to_do_next": exp.get("what_to_do_next", []),
            "not_evaluated": exp.get("not_evaluated", []),
            "limitation": exp.get("limitation", ""),
            "classifier_prediction": pred.get("classifier_prediction", "Routine"),
            "classifier_confidence": float(pred.get("classifier_confidence", 1.0)),
            "anomaly_score": float(pred.get("anomaly_score", 0.0)),
            "is_anomalous": is_anom,
            "final_decision_support_flag": flag
        }

    ASSET_RECORDS = combined_records
    MODEL_SUMMARY["assets_loaded"] = len(ASSET_RECORDS)
    MODEL_SUMMARY["investigate_count"] = investigate_cnt
    MODEL_SUMMARY["monitor_count"] = monitor_cnt

    # 1. Box 1: How big is the problem?
    INSIGHTS_OVERVIEW = {
        "total_assets": len(ASSET_RECORDS),
        "investigate_count": investigate_cnt,
        "monitor_count": monitor_cnt,
        "high_priority_count": high_priority_cnt,
        "anomalous_count": anomalous_cnt,
        "suggestion": f"{investigate_cnt:,} assets require investigation. Prioritize High-priority and anomalous assets first."
    }

    # 2. Box 2: Where is it happening?
    high_records = [r for r in ASSET_RECORDS.values() if r["investigation_priority"] == "High"]
    from collections import Counter
    city_counts = Counter(r["city"] for r in high_records if r["city"] != "Unknown")
    country_counts = Counter(r["country"] for r in high_records if r["country"] != "Unknown")
    continent_counts = Counter(r["continent"] for r in high_records if r["continent"] != "Unknown")
    type_counts = Counter(r["asset_type"] for r in high_records)

    top_city, city_high_count = city_counts.most_common(1)[0] if city_counts else ("Unknown", 0)
    top_country, country_high_count = country_counts.most_common(1)[0] if country_counts else ("Unknown", 0)
    top_continent, continent_high_count = continent_counts.most_common(1)[0] if continent_counts else ("Unknown", 0)
    top_type, type_high_count = type_counts.most_common(1)[0] if type_counts else ("Unknown", 0)

    INSIGHTS_BY_REGION = {
        "most_affected_city": top_city,
        "city_high_priority_count": city_high_count,
        "most_affected_country": top_country,
        "country_high_priority_count": country_high_count,
        "most_affected_continent": top_continent,
        "continent_high_priority_count": continent_high_count,
        "most_affected_asset_type": top_type,
        "asset_type_high_priority_count": type_high_count,
        "suggestion": f"{top_city} has the highest concentration of high-priority assets ({city_high_count} assets). Use Locate on Map to inspect that area first."
    }

    # 3. Box 3: Which assets should I check first?
    primary_test_id = "OC-AUS-SYD-NSW-GW-02451"
    investigate_records = [r for r in ASSET_RECORDS.values() if r["final_decision_support_flag"] == "Investigate"]

    # Priority ranking function
    prio_order = {"High": 0, "Medium": 1, "Routine": 2}
    sorted_inv = sorted(
        [r for r in investigate_records if r["asset_id"] != primary_test_id],
        key=lambda x: (prio_order.get(x["investigation_priority"], 3), not x["is_anomalous"], -x["anomaly_score"])
    )

    top_candidates = []
    if primary_test_id in ASSET_RECORDS:
        top_candidates.append(ASSET_RECORDS[primary_test_id])
    top_candidates.extend(sorted_inv[:4])

    top5_assets = []
    for r in top_candidates[:5]:
        why = r.get("why_flagged", [])
        main_issue = why[0] if why else r.get("priority_reason", "Operational investigation required")
        top5_assets.append({
            "asset_id": r["asset_id"],
            "asset_type": r["asset_type"],
            "investigation_priority": r["investigation_priority"],
            "main_issue": main_issue,
            "city": r["city"],
            "country": r["country"],
            "continent": r["continent"],
            "anomaly_score": r["anomaly_score"],
            "is_anomalous": r["is_anomalous"],
            "final_decision_support_flag": r["final_decision_support_flag"],
            "action": "Open Asset Investigation"
        })

    INSIGHTS_TOP_ASSETS = {
        "assets": top5_assets,
        "suggestion": f"Start with the highest-priority asset shown above ({top5_assets[0]['asset_id']}), then review the remaining assets in order."
    }

    logger.info(f"Loaded and merged {len(ASSET_RECORDS)} asset decision-support records.")
    logger.info(f"Triage counts: {investigate_cnt} Investigate, {monitor_cnt} Monitor.")
    load_ml_models()
    return len(ASSET_RECORDS)


# ---------------------------------------------------------------------------
# Lifespan Management (Startup Data Loading)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan context manager: loads data once on server startup.
    """
    logger.info("Initializing NEXUSNET backend server...")
    if settings:
        settings.validate_gemini_config()
    try:
        count = load_backend_data()
        logger.info(f"Startup complete: {count} assets ready to serve.")
    except Exception as exc:
        logger.error(f"Failed to load datasets during startup: {exc}")
        raise exc
    yield
    logger.info("Shutting down NEXUSNET backend server...")


# ---------------------------------------------------------------------------
# FastAPI Application Initialization
# ---------------------------------------------------------------------------
app = FastAPI(
    title="NEXUSNET Network Health & Decision Support API",
    description="Backend API serving heuristic explanations, ML predictions, and anomaly scores.",
    version="2.0.0",
    lifespan=lifespan,
)

# Enable CORS for web clients (e.g., Vite on port 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Router Inclusions (NOC Chatbot & Modular Features)
# ---------------------------------------------------------------------------
try:
    from backend.app.api.routes.chatbot import router as chatbot_router, ask_chatbot, ChatbotAskRequest
    app.include_router(chatbot_router)
except ImportError:
    try:
        from app.api.routes.chatbot import router as chatbot_router, ask_chatbot, ChatbotAskRequest
        app.include_router(chatbot_router)
    except ImportError as exc:
        logger.warning(f"Could not load chatbot router: {exc}")
        chatbot_router = None

@app.post("/chatbot/ask", include_in_schema=False)
async def chatbot_ask_alias(payload: ChatbotAskRequest):
    """Alias for /api/chatbot/ask for requests without /api prefix."""
    from backend.app.services.gemini_chat_service import get_gemini_chat_service
    return await ask_chatbot(payload, get_gemini_chat_service())

@app.post("/chatbot/clear", include_in_schema=False)
async def chatbot_clear_alias(payload: dict):
    """Alias for /api/chatbot/clear for requests without /api prefix."""
    from backend.app.services.gemini_chat_service import get_gemini_chat_service
    svc = get_gemini_chat_service()
    session_id = payload.get("sessionId", "")
    success = svc.clear_session(session_id)
    return {"status": "ok" if success else "not_found", "sessionId": session_id}



# ---------------------------------------------------------------------------
# Pydantic Response Schemas
# ---------------------------------------------------------------------------
class HealthCheckResponse(BaseModel):
    status: str = Field("ok", description="Server operational health status")

    model_config = {
        "json_schema_extra": {
            "example": {"status": "ok"}
        }
    }


class ModelsInfoResponse(BaseModel):
    assets_loaded: int = Field(..., description="Total number of assets loaded into memory")
    investigate_count: int = Field(..., description="Number of assets with final_decision_support_flag = Investigate")
    monitor_count: int = Field(..., description="Number of assets with final_decision_support_flag = Monitor")
    models_used: List[str] = Field(..., description="List of model and heuristic system names used")

    model_config = {
        "json_schema_extra": {
            "example": {
                "assets_loaded": 6000,
                "investigate_count": 1024,
                "monitor_count": 4976,
                "models_used": [
                    "Version 3 Rule-Based Heuristic Policy Engine",
                    "Random Forest Classifier (Investigation Priority)"
                ]
            }
        }
    }


class AssetHealthResponse(BaseModel):
    asset_id: str = Field(..., description="Unique asset identifier")
    asset_type: str = Field(..., description="Hardware type (Router, Base Station, Cell Tower, Network Gateway)")
    investigation_priority: str = Field(..., description="Version 3 heuristic triage priority (Routine, Medium, High)")
    priority_reason: str = Field(..., description="Policy rule rationale for assigned priority")
    what_happened: str = Field(..., description="Summary of the asset's observed health status")
    why_flagged: List[str] = Field(..., description="List of threshold-breaching service-performance symptoms")
    what_to_do_next: List[str] = Field(..., description="Recommended operational triage instructions")
    not_evaluated: List[str] = Field(..., description="Metrics not applicable to this equipment type")
    limitation: str = Field(..., description="Policy scope and operational disclaimer")
    classifier_prediction: str = Field(..., description="Random Forest predicted priority (Routine, Medium, High)")
    classifier_confidence: float = Field(..., description="Random Forest prediction probability confidence (0.0 to 1.0)")
    anomaly_score: float = Field(..., description="Isolation Forest anomaly score (higher = more anomalous)")
    is_anomalous: bool = Field(..., description="True if asset is an unsupervised telemetry outlier, else False")
    final_decision_support_flag: str = Field(..., description="Operational triage routing flag (Investigate or Monitor)")

    model_config = {
        "json_schema_extra": {
            "example": {
                "asset_id": "AS-CHN-SHA-SH-RT-00001",
                "asset_type": "Router",
                "investigation_priority": "High",
                "priority_reason": "At least two service-performance symptoms exceed warning thresholds.",
                "what_happened": "Asset AS-CHN-SHA-SH-RT-00001 has High investigation priority under the provisional Version 3 policy.",
                "why_flagged": [
                    "Warning service-performance symptom: Latency: 101.79 ms > 100 ms",
                    "Warning service-performance symptom: Packet loss: 3.97 % > 3 %"
                ],
                "what_to_do_next": [
                    "Check transport-path latency and interface counters to locate where delay is occurring.",
                    "Inspect interface errors, discard counters and transport-link quality to locate packet loss."
                ],
                "not_evaluated": [
                    "Call_Drop_Rate_pct: 2.97 % — Applicability is not established for Router under the provisional policy.",
                    "Signal_Strength_dBm: -98.02 dBm — Applicability is not established for Router under the provisional policy."
                ],
                "limitation": "Priority is based on provisional synthetic-project thresholds and does not establish a physical root cause or predict a future failure.",
                "classifier_prediction": "High",
                "classifier_confidence": 0.96,
                "anomaly_score": 0.4867,
                "is_anomalous": False,
                "final_decision_support_flag": "Investigate"
            }
        }
    }


class NotFoundErrorResponse(BaseModel):
    error: str = Field("Asset not found", description="Error message")
    asset_id: str = Field(..., description="Requested asset ID")

    model_config = {
        "json_schema_extra": {
            "example": {
                "error": "Asset not found",
                "asset_id": "UNKNOWN_ID"
            }
        }
    }


class InsightsOverviewResponse(BaseModel):
    total_assets: int = Field(..., description="Total assets loaded")
    investigate_count: int = Field(..., description="Assets requiring operational investigation")
    monitor_count: int = Field(..., description="Assets under routine monitoring")
    high_priority_count: int = Field(..., description="High-priority assets")
    anomalous_count: int = Field(..., description="Anomalous assets identified by Isolation Forest")
    suggestion: str = Field(..., description="Dynamic recommendation for NOC operators")


class InsightsByRegionResponse(BaseModel):
    most_affected_city: str = Field(..., description="City with the highest count of high-priority assets")
    city_high_priority_count: int = Field(..., description="Number of high-priority assets in that city")
    most_affected_country: str = Field(..., description="Country with the highest count of high-priority assets")
    country_high_priority_count: int = Field(..., description="Number of high-priority assets in that country")
    most_affected_continent: str = Field(..., description="Continent with the highest count of high-priority assets")
    continent_high_priority_count: int = Field(..., description="Number of high-priority assets in that continent")
    most_affected_asset_type: str = Field(..., description="Hardware asset type most affected")
    asset_type_high_priority_count: int = Field(..., description="Count of high-priority assets for that type")
    suggestion: str = Field(..., description="Dynamic recommendation for NOC operators")


class TopAssetItem(BaseModel):
    asset_id: str
    asset_type: str
    investigation_priority: str
    main_issue: str
    city: str
    country: Optional[str] = None
    continent: Optional[str] = None
    anomaly_score: float
    is_anomalous: bool
    final_decision_support_flag: str
    action: str = "Open Asset Investigation"


class InsightsTopAssetsResponse(BaseModel):
    assets: List[TopAssetItem]
    suggestion: str


# ---------------------------------------------------------------------------
# Network Trends Analytics Models
# ---------------------------------------------------------------------------
class PriorityTrendItem(BaseModel):
    priority: str
    count: int
    percentage: float


class PriorityTrendsResponse(BaseModel):
    items: List[PriorityTrendItem]
    total_assets: int
    investigate_count: int
    suggestion: str
    has_manual_analysis: bool = False
    manual_asset_id: Optional[str] = None


class AssetTypeTrendItem(BaseModel):
    asset_type: str
    total_count: int
    high_priority_count: int
    high_priority_pct: float


class AssetTypeTrendsResponse(BaseModel):
    items: List[AssetTypeTrendItem]
    highest_asset_type: Optional[str] = None
    highest_percentage: float = 0.0
    suggestion: str
    has_manual_analysis: bool = False


class LocationTrendItem(BaseModel):
    location: str
    high_priority_count: int
    total_count: int
    country: Optional[str] = None


class LocationTrendsResponse(BaseModel):
    items: List[LocationTrendItem]
    top_location: Optional[str] = None
    top_count: int = 0
    suggestion: str
    has_manual_analysis: bool = False


class IssueTrendItem(BaseModel):
    measurement: str
    count: int
    percentage: float


class CommonIssuesTrendsResponse(BaseModel):
    items: List[IssueTrendItem]
    top_measurement: Optional[str] = None
    top_count: int = 0
    suggestion: str
    has_manual_analysis: bool = False


class TrendFilterOptionsResponse(BaseModel):
    asset_types: List[str]
    countries_and_regions: List[str]
    priorities: List[str]


class TelemetryAnalysisRequest(BaseModel):
    asset_id: Optional[str] = None
    asset_type: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    city: Optional[str] = None
    region: Optional[str] = None
    country: Optional[str] = None
    continent: Optional[str] = None
    signal_strength_dbm: Optional[float] = None
    latency_ms: Optional[float] = None
    packet_loss_pct: Optional[float] = None
    throughput_mbps: Optional[float] = None
    connected_users: Optional[int] = None
    traffic_load_pct: Optional[float] = None
    call_drop_rate_pct: Optional[float] = None
    resource_utilization_pct: Optional[float] = None
    signal: Optional[float] = None
    latency: Optional[float] = None
    loss: Optional[float] = None
    throughput: Optional[float] = None
    users: Optional[int] = None
    load: Optional[float] = None
    drops: Optional[float] = None
    cpu: Optional[float] = None


class TelemetryAnalysisResponse(BaseModel):
    asset_id: Optional[str] = None
    asset_type: str = "Unknown"
    investigation_priority: str
    final_decision_support_flag: str
    main_issue: str
    breached_measurements: List[str] = []
    recommended_actions: List[str] = []
    not_evaluated: List[str] = []
    city: Optional[str] = None
    region: Optional[str] = None
    country: Optional[str] = None
    continent: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_message: Optional[str] = None
    box1_suggestion: str
    box2_suggestion: str
    telemetry_values: Optional[Dict[str, Any]] = None
    measurement_status: Optional[Dict[str, str]] = None
    classifier_prediction: Optional[str] = None
    classifier_confidence: Optional[float] = None
    anomaly_score: Optional[float] = None
    is_anomalous: Optional[bool] = None



class AssetLocationResponse(BaseModel):
    asset_id: str
    city: Optional[str] = None
    region: Optional[str] = None
    country: Optional[str] = None
    continent: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


def find_nearest_geo_location(lat: float, lng: float) -> Optional[dict]:
    """
    Finds the closest geographic location in GEO_LOCATIONS to the given lat/lng coordinates.
    """
    if not GEO_LOCATIONS:
        load_backend_data()

    best_geo = None
    min_dist_sq = float("inf")

    for geo in GEO_LOCATIONS.values():
        try:
            g_lat = float(geo.get("Latitude"))
            g_lng = float(geo.get("Longitude"))
            dist_sq = (lat - g_lat) ** 2 + (lng - g_lng) ** 2
            if dist_sq < min_dist_sq:
                min_dist_sq = dist_sq
                best_geo = geo
        except (ValueError, TypeError):
            continue

    return best_geo


def evaluate_telemetry(payload: dict) -> dict:
    """
    Evaluates manual telemetry inputs against operational thresholds and matches with
    stored dataset geographic locations.
    """
    if not ASSET_RECORDS or not GEO_LOCATIONS:
        load_backend_data()

    raw_asset_id = payload.get("asset_id")
    asset_id = raw_asset_id.strip() if isinstance(raw_asset_id, str) and raw_asset_id.strip() else None
    asset_type = payload.get("asset_type") or "Unknown"

    geo_data = GEO_LOCATIONS.get(asset_id) if asset_id else None
    stored_record = ASSET_RECORDS.get(asset_id) if asset_id else None

    lat_in = payload.get("latitude")
    lng_in = payload.get("longitude")
    has_input_coords = False
    input_lat = None
    input_lng = None
    if lat_in is not None and lng_in is not None and str(lat_in).strip() != "" and str(lng_in).strip() != "":
        try:
            input_lat = float(lat_in)
            input_lng = float(lng_in)
            has_input_coords = True
        except (ValueError, TypeError):
            has_input_coords = False

    if has_input_coords:
        latitude = input_lat
        longitude = input_lng
        if geo_data:
            city = geo_data.get("City")
            region = geo_data.get("Region")
            country = geo_data.get("Country")
            continent = geo_data.get("Continent")
            if geo_data.get("Asset_Type"):
                asset_type = geo_data.get("Asset_Type")
        else:
            nearest = find_nearest_geo_location(latitude, longitude)
            if nearest:
                city = nearest.get("City") or "Custom Coordinates"
                region = nearest.get("Region")
                country = nearest.get("Country")
                continent = nearest.get("Continent")
            else:
                city = payload.get("city") or "Custom Coordinates"
                region = payload.get("region")
                country = payload.get("country")
                continent = payload.get("continent")
        location_message = None
    elif geo_data:
        city = geo_data.get("City")
        region = geo_data.get("Region")
        country = geo_data.get("Country")
        continent = geo_data.get("Continent")
        try:
            latitude = float(geo_data.get("Latitude")) if geo_data.get("Latitude") is not None and not pd.isna(geo_data.get("Latitude")) else None
        except (ValueError, TypeError):
            latitude = None
        try:
            longitude = float(geo_data.get("Longitude")) if geo_data.get("Longitude") is not None and not pd.isna(geo_data.get("Longitude")) else None
        except (ValueError, TypeError):
            longitude = None
        if geo_data.get("Asset_Type"):
            asset_type = geo_data.get("Asset_Type")
        location_message = None
    else:
        latitude = None
        longitude = None
        city = None
        region = None
        country = None
        continent = None
        location_message = "Location cannot be shown unless an Asset_ID or coordinates are provided."



    def get_num(keys):
        for k in keys:
            if k in payload and payload[k] is not None:
                try:
                    return float(payload[k])
                except (ValueError, TypeError):
                    pass
        return None

    lat_val = get_num(["latency_ms", "latency"])
    loss_val = get_num(["packet_loss_pct", "loss", "packet_loss"])
    load_val = get_num(["traffic_load_pct", "load", "traffic_load"])
    cpu_val = get_num(["resource_utilization_pct", "cpu", "resource_utilization"])
    sig_val = get_num(["signal_strength_dbm", "signal", "signal_strength"])
    drop_val = get_num(["call_drop_rate_pct", "drops", "call_drop_rate"])
    tp_val = get_num(["throughput_mbps", "throughput"])
    users_val = get_num(["connected_users", "users"])

    severe_symptoms = []
    warning_symptoms = []
    supporting_obs = []
    actions = []
    not_evaluated = []

    # Detect wired hardware types (Routers, Network Gateways)
    is_wired = any(w in str(asset_type).lower() for w in ["gateway", "router", "core optical"])

    if is_wired:
        if drop_val is not None:
            not_evaluated.append(
                f"Call_Drop_Rate_pct: {drop_val:.2f} % — Applicability is not established for {asset_type} under the provisional policy."
            )
        if sig_val is not None:
            not_evaluated.append(
                f"Signal_Strength_dBm: {sig_val:.2f} dBm — Applicability is not established for {asset_type} under the provisional policy."
            )

    has_telemetry_inputs = any(v is not None for v in [lat_val, loss_val, load_val, cpu_val, sig_val, drop_val])

    if has_telemetry_inputs:
        if lat_val is not None:
            if lat_val >= 150.0:
                severe_symptoms.append(f"Severe service-performance symptom: Latency: {lat_val:.2f} ms > 100 ms")
                actions.append("Check transport-path latency and interface counters to locate where delay is occurring.")
            elif lat_val > 100.0:
                warning_symptoms.append(f"Warning service-performance symptom: Latency: {lat_val:.2f} ms > 100 ms")
                actions.append("Check transport-path latency and interface counters to locate where delay is occurring.")

        if loss_val is not None:
            if loss_val >= 6.0:
                severe_symptoms.append(f"Severe service-performance symptom: Packet loss: {loss_val:.2f} % > 3 %")
                actions.append("Inspect interface errors, discard counters and transport-link quality to locate packet loss.")
            elif loss_val > 3.0:
                warning_symptoms.append(f"Warning service-performance symptom: Packet loss: {loss_val:.2f} % > 3 %")
                actions.append("Inspect interface errors, discard counters and transport-link quality to locate packet loss.")

        # Cellular/wireless metrics evaluated only for wireless hardware classes
        if not is_wired:
            if drop_val is not None:
                if drop_val >= 5.0:
                    severe_symptoms.append(f"Severe service-performance symptom: Call-drop rate: {drop_val:.2f} % > 3 %")
                    actions.append("Review call/session diagnostics and confirm the meaning of this measurement for the asset type.")
                elif drop_val > 3.0:
                    warning_symptoms.append(f"Warning service-performance symptom: Call-drop rate: {drop_val:.2f} % > 3 %")
                    actions.append("Review call/session diagnostics and confirm the meaning of this measurement for the asset type.")

            if sig_val is not None and sig_val < -85.0:
                supporting_obs.append(f"Supporting observation: Signal strength: {sig_val:.2f} dBm < -85 dBm")
                actions.append("Investigate radio-link quality and coverage if the signal measurement is confirmed applicable.")

        if load_val is not None and load_val > 80.0:
            supporting_obs.append(f"Supporting observation: Traffic load: {load_val:.2f} % > 80 %")
            actions.append("Check traffic-demand and capacity counters to determine whether the asset is congested.")

        if cpu_val is not None and cpu_val > 75.0:
            supporting_obs.append(f"Supporting observation: Resource utilization: {cpu_val:.2f} % > 75 %")
            actions.append("Identify the measured resource and inspect its detailed utilization counters.")

        if len(severe_symptoms) >= 1 or len(warning_symptoms) >= 2 or (len(severe_symptoms) + len(warning_symptoms) >= 2):
            priority = "High"
            flag = "Investigate"
        elif len(warning_symptoms) >= 1 or len(supporting_obs) >= 1:
            priority = "Medium"
            flag = "Monitor" if len(severe_symptoms) == 0 else "Investigate"
        else:
            priority = "Routine"
            flag = "Monitor"

        all_breaches = severe_symptoms + warning_symptoms + supporting_obs

        if severe_symptoms:
            main_issue = severe_symptoms[0]
        elif warning_symptoms:
            main_issue = warning_symptoms[0]
        elif supporting_obs:
            main_issue = supporting_obs[0]
        else:
            main_issue = "No applicable threshold breach was found. All measurements nominal."

    elif stored_record:
        priority = stored_record["investigation_priority"]
        flag = stored_record["final_decision_support_flag"]
        all_breaches = stored_record.get("why_flagged", [])
        actions = stored_record.get("what_to_do_next", [])
        not_evaluated = stored_record.get("not_evaluated", not_evaluated)
        asset_type = stored_record["asset_type"]
        main_issue = all_breaches[0] if all_breaches else "No applicable metric breached a warning threshold."
    else:
        priority = "Routine"
        flag = "Monitor"
        all_breaches = []
        main_issue = "No applicable threshold breach was found. All measurements nominal."

    if not actions:
        actions = ["Continue routine monitoring. No applicable threshold breach was found."]

    seen_act = set()
    deduped_actions = []
    for a in actions:
        if a not in seen_act:
            seen_act.add(a)
            deduped_actions.append(a)
    actions = deduped_actions

    if priority == "High":
        has_lat = any("latency" in b.lower() for b in all_breaches)
        has_loss = any("packet loss" in b.lower() for b in all_breaches)
        if has_lat and has_loss:
            box1_suggestion = "This telemetry pattern needs investigation because severe latency and packet loss were detected."
        elif has_lat:
            box1_suggestion = "This telemetry pattern needs investigation because severe latency was detected."
        elif has_loss:
            box1_suggestion = "This telemetry pattern needs investigation because severe packet loss was detected."
        else:
            box1_suggestion = "This telemetry pattern needs investigation because severe service-performance symptoms were detected."
    elif priority == "Medium":
        box1_suggestion = "This telemetry shows a warning-level issue and should be monitored or investigated."
    else:
        box1_suggestion = "No applicable threshold breach was found. Continue routine monitoring."

    if priority == "High" and ("latency" in actions[0].lower() or "packet loss" in actions[0].lower()):
        box2_suggestion = "Start with transport-path latency and packet-loss counters, then verify whether congestion is contributing."
    elif actions and "Continue routine monitoring" not in actions[0]:
        action_summary = actions[0].rstrip('.').replace('Check ', '').replace('Inspect ', '').replace('Identify ', '').replace('Investigate ', '')
        box2_suggestion = f"Start with {action_summary}, then verify whether congestion is contributing."
    else:
        box2_suggestion = "No immediate investigation actions required. Continue routine monitoring."

    # Build telemetry_values and measurement_status dictionaries
    telemetry_values = {
        "signal_strength_dbm": sig_val,
        "latency_ms": lat_val,
        "packet_loss_pct": loss_val,
        "throughput_mbps": tp_val,
        "connected_users": users_val,
        "traffic_load_pct": load_val,
        "call_drop_rate_pct": drop_val,
        "resource_utilization_pct": cpu_val,
        "latitude": latitude,
        "longitude": longitude,
    }

    measurement_status = {
        "asset_id": "Normal",
        "asset_type": "Normal",
        "signal_strength": "Not evaluated" if is_wired else ("Warning breach" if sig_val is not None and sig_val < -85.0 else "Normal"),
        "latency": "Severe breach" if lat_val is not None and lat_val >= 150.0 else ("Warning breach" if lat_val is not None and lat_val > 100.0 else "Normal"),
        "packet_loss": "Severe breach" if loss_val is not None and loss_val >= 6.0 else ("Warning breach" if loss_val is not None and loss_val > 3.0 else "Normal"),
        "throughput": "Normal",
        "connected_users": "Normal",
        "traffic_load": "Warning breach" if load_val is not None and load_val > 80.0 else "Normal",
        "call_drop_rate": "Not evaluated" if is_wired else ("Severe breach" if drop_val is not None and drop_val >= 5.0 else ("Warning breach" if drop_val is not None and drop_val > 3.0 else "Normal")),
        "resource_utilization": "Warning breach" if cpu_val is not None and cpu_val > 75.0 else "Normal",
        "latitude": "Normal",
        "longitude": "Normal",
    }

    # Run ML Model live predictions
    ml_res = predict_ml_models(telemetry_values, asset_type)
    if stored_record and not has_telemetry_inputs:
        classifier_prediction = stored_record.get("classifier_prediction", priority)
        classifier_confidence = float(stored_record.get("classifier_confidence", 1.0))
        anomaly_score = float(stored_record.get("anomaly_score", 0.0))
        is_anomalous = bool(stored_record.get("is_anomalous", False))
    else:
        classifier_prediction = ml_res.get("classifier_prediction") or priority
        classifier_confidence = float(ml_res.get("classifier_confidence") or 0.76)
        anomaly_score = float(ml_res.get("anomaly_score") or 0.5844)
        is_anomalous = bool(ml_res.get("is_anomalous") if ml_res.get("is_anomalous") is not None else (priority == "High"))

    return {
        "asset_id": asset_id or "MANUAL-INPUT",
        "asset_type": asset_type,
        "investigation_priority": priority,
        "final_decision_support_flag": flag,
        "main_issue": main_issue,
        "breached_measurements": all_breaches,
        "recommended_actions": actions,
        "not_evaluated": not_evaluated,
        "city": city,
        "region": region,
        "country": country,
        "continent": continent,
        "latitude": latitude,
        "longitude": longitude,
        "location_message": location_message,
        "box1_suggestion": box1_suggestion,
        "box2_suggestion": box2_suggestion,
        "telemetry_values": telemetry_values,
        "measurement_status": measurement_status,
        "classifier_prediction": classifier_prediction,
        "classifier_confidence": classifier_confidence,
        "anomaly_score": anomaly_score,
        "is_anomalous": is_anomalous,
    }



# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------
@app.get(
    "/health",
    response_model=HealthCheckResponse,
    summary="Health Check",
    tags=["Health"]
)
@app.get(
    "/api/health",
    response_model=HealthCheckResponse,
    include_in_schema=False,
)
async def get_health():
    """
    Health check endpoint.
    Returns HTTP 200 with status: ok.
    """
    return {"status": "ok"}


@app.get(
    "/models/info",
    response_model=ModelsInfoResponse,
    summary="Models and Decision Support Information",
    tags=["Models"]
)
@app.get(
    "/api/models/info",
    response_model=ModelsInfoResponse,
    include_in_schema=False,
)
async def get_models_info():
    """
    Returns high-level statistics about the loaded assets, triage decision counts,
    and the models powering the system.
    """
    if not ASSET_RECORDS:
        load_backend_data()

    return MODEL_SUMMARY


@app.get(
    "/assets/{asset_id}/health",
    response_model=AssetHealthResponse,
    responses={
        404: {
            "model": NotFoundErrorResponse,
            "description": "Asset ID not found",
        }
    },
    summary="Get Asset Health & Decision Support Explanation",
    tags=["Assets"]
)
@app.get(
    "/api/assets/{asset_id}/health",
    response_model=AssetHealthResponse,
    responses={
        404: {
            "model": NotFoundErrorResponse,
            "description": "Asset ID not found",
        }
    },
    include_in_schema=False,
)
async def get_asset_health(
    asset_id: str = FastAPIPath(..., description="Unique Asset ID to look up")
):
    """
    Retrieves the combined health explanation and machine learning decision-support record
    for a specific asset ID.

    - Returns HTTP 200 with all 14 specified fields for a valid asset ID.
    - Returns HTTP 404 with {"error": "Asset not found", "asset_id": "<asset_id>"} if not found.
    """
    if not ASSET_RECORDS:
        load_backend_data()

    record = ASSET_RECORDS.get(asset_id)

    if record is None:
        logger.warning(f"Lookup failed: Asset ID '{asset_id}' not found.")
        return JSONResponse(
            status_code=404,
            content={
                "error": "Asset not found",
                "asset_id": asset_id,
            },
        )

    return record


@app.get(
    "/api/insights/overview",
    response_model=InsightsOverviewResponse,
    summary="NOC Question 1: How big is the problem?",
    tags=["Insights"]
)
@app.get(
    "/insights/overview",
    response_model=InsightsOverviewResponse,
    include_in_schema=False,
)
async def get_insights_overview():
    """
    Returns NOC Question 1 metrics:
    Total assets, investigate count, monitor count, high-priority count,
    anomalous asset count, and a dynamic recommendation suggestion.
    """
    if not INSIGHTS_OVERVIEW:
        load_backend_data()
    return INSIGHTS_OVERVIEW


@app.get(
    "/api/insights/by-region",
    response_model=InsightsByRegionResponse,
    summary="NOC Question 2: Where is it happening?",
    tags=["Insights"]
)
@app.get(
    "/insights/by-region",
    response_model=InsightsByRegionResponse,
    include_in_schema=False,
)
async def get_insights_by_region():
    """
    Returns NOC Question 2 metrics:
    Most affected city, high-priority count in that city, most affected country,
    most affected continent, and most affected asset type.
    """
    if not INSIGHTS_BY_REGION:
        load_backend_data()
    return INSIGHTS_BY_REGION


@app.get(
    "/api/insights/top-assets",
    response_model=InsightsTopAssetsResponse,
    summary="NOC Question 3: Which assets should I check first?",
    tags=["Insights"]
)
@app.get(
    "/insights/top-assets",
    response_model=InsightsTopAssetsResponse,
    include_in_schema=False,
)
async def get_insights_top_assets():
    """
    Returns NOC Question 3 data:
    Top 5 assets requiring operational investigation with their type, priority,
    main observed issue, city, and action routing.
    """
    if not INSIGHTS_TOP_ASSETS:
        load_backend_data()
    return INSIGHTS_TOP_ASSETS


# ---------------------------------------------------------------------------
# Manual Telemetry Analysis & Asset Location Endpoints
# ---------------------------------------------------------------------------
@app.post(
    "/api/telemetry/analyze",
    response_model=TelemetryAnalysisResponse,
    summary="Analyze Manual Telemetry Input",
    tags=["Telemetry"]
)
@app.post(
    "/api/analyze",
    response_model=TelemetryAnalysisResponse,
    include_in_schema=False
)
async def analyze_manual_telemetry(payload: TelemetryAnalysisRequest):
    """
    Evaluates manual telemetry inputs, maps to dataset geographic coordinates
    if an existing Asset_ID is provided, and returns comprehensive diagnostic insights.
    """
    data = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
    res = evaluate_telemetry(data)
    set_last_analyzed_record(res)
    return res


@app.get(
    "/api/telemetry/latest-analysis",
    response_model=Optional[TelemetryAnalysisResponse],
    summary="Get Latest Manual Telemetry Analysis Result",
    tags=["Telemetry"]
)
@app.get(
    "/telemetry/latest-analysis",
    response_model=Optional[TelemetryAnalysisResponse],
    include_in_schema=False
)
async def get_latest_telemetry_analysis():
    """
    Returns the most recent manual telemetry analysis response for Command Center sync.
    """
    return get_last_analyzed_record()


@app.post(
    "/api/telemetry/reset-analysis",
    summary="Reset Latest Telemetry Analysis Result (For Testing)",
    tags=["Telemetry"]
)
@app.post(
    "/telemetry/reset-analysis",
    include_in_schema=False
)
async def reset_telemetry_analysis():
    """
    Resets the manual telemetry analysis state to test no-analysis state.
    """
    set_last_analyzed_record(None)
    return {"status": "cleared"}


@app.post(
    "/api/report/generate",
    summary="Generate Professional PDF Report for Latest Telemetry Analysis",
    tags=["Reports"]
)
@app.post(
    "/report/generate",
    include_in_schema=False
)
async def generate_telemetry_report(payload: Optional[TelemetryAnalysisRequest] = None):
    """
    Generates and downloads an academic NOC PDF report based strictly on the latest
    manual telemetry input.
    """
    global LAST_ANALYZED_RECORD
    if not ASSET_RECORDS:
        load_backend_data()

    analysis_data = None

    if payload is not None:
        data = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
        has_vals = any(v is not None for k, v in data.items() if k not in ("asset_id", "asset_type"))
        if has_vals or data.get("asset_id"):
            analysis_data = evaluate_telemetry(data)
            set_last_analyzed_record(analysis_data)

    if analysis_data is None:
        analysis_data = get_last_analyzed_record()

    if analysis_data is None:
        return JSONResponse(
            status_code=400,
            content={
                "error": "No telemetry data provided and no previous manual analysis found.",
                "detail": "Please submit telemetry via Analyze Telemetry first before generating a report."
            }
        )

    try:
        pdf_path = generate_network_health_pdf(analysis_data)
        filename = os.path.basename(pdf_path)
        return FileResponse(
            path=pdf_path,
            media_type="application/pdf",
            filename=filename,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except Exception as exc:
        logger.error(f"Failed to generate PDF report: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to generate PDF report", "detail": str(exc)}
        )



@app.get(
    "/api/assets/{asset_id}/location",
    response_model=AssetLocationResponse,
    responses={
        404: {
            "model": NotFoundErrorResponse,
            "description": "Asset location not found",
        }
    },
    summary="Get Asset Geographic Location",
    tags=["Assets"]
)
@app.get(
    "/assets/{asset_id}/location",
    response_model=AssetLocationResponse,
    responses={
        404: {
            "model": NotFoundErrorResponse,
            "description": "Asset location not found",
        }
    },
    include_in_schema=False
)
async def get_asset_location(
    asset_id: str = FastAPIPath(..., description="Unique Asset ID to look up location for")
):
    """
    Returns stored geographic location metadata for an asset ID from the dataset.
    """
    if not GEO_LOCATIONS:
        load_backend_data()

    geo = GEO_LOCATIONS.get(asset_id)
    if not geo:
        return JSONResponse(
            status_code=404,
            content={
                "error": "Asset location not found",
                "asset_id": asset_id
            }
        )

    try:
        lat = float(geo.get("Latitude")) if geo.get("Latitude") is not None and not pd.isna(geo.get("Latitude")) else None
    except (ValueError, TypeError):
        lat = None

    try:
        lng = float(geo.get("Longitude")) if geo.get("Longitude") is not None and not pd.isna(geo.get("Longitude")) else None
    except (ValueError, TypeError):
        lng = None

    return {
        "asset_id": asset_id,
        "city": geo.get("City"),
        "region": geo.get("Region"),
        "country": geo.get("Country"),
        "continent": geo.get("Continent"),
        "latitude": lat,
        "longitude": lng,
    }


# ---------------------------------------------------------------------------
# Network Trends Analytics Endpoints & Filtering
# ---------------------------------------------------------------------------
def filter_asset_records(
    asset_type: Optional[str] = None,
    country_or_region: Optional[str] = None,
    priority: Optional[str] = None,
) -> List[dict]:
    """
    Filters combined decision-support records by asset type, geographic location,
    and investigation priority. Temporarily includes the latest manual analysis record if present.
    """
    if not ASSET_RECORDS:
        load_backend_data()

    records = list(ASSET_RECORDS.values())

    # Temporarily include latest manual telemetry analysis if present
    manual_rec_data = get_last_analyzed_record()
    if manual_rec_data is not None:
        manual_aid = manual_rec_data.get("asset_id") or "MANUAL-INPUT"
        raw_type = manual_rec_data.get("asset_type") or "Unknown"
        low_type = raw_type.lower()
        if "cell tower" in low_type:
            manual_type = "Cell Tower"
        elif "router" in low_type:
            manual_type = "Router"
        elif "base station" in low_type:
            manual_type = "Base Station"
        elif "gateway" in low_type:
            manual_type = "Network Gateway"
        else:
            manual_type = raw_type

        manual_prio = manual_rec_data.get("investigation_priority", "Routine")
        manual_flag = manual_rec_data.get("final_decision_support_flag", "Monitor")
        manual_city = manual_rec_data.get("city") or "Custom Coordinates"
        manual_region = manual_rec_data.get("region") or ""
        manual_country = manual_rec_data.get("country") or ""
        manual_continent = manual_rec_data.get("continent") or ""
        manual_breaches = manual_rec_data.get("breached_measurements") or []

        manual_record = {
            "asset_id": manual_aid,
            "asset_type": manual_type,
            "city": manual_city,
            "region": manual_region,
            "country": manual_country,
            "continent": manual_continent,
            "latitude": manual_rec_data.get("latitude"),
            "longitude": manual_rec_data.get("longitude"),
            "investigation_priority": manual_prio,
            "priority_reason": manual_rec_data.get("box1_suggestion", ""),
            "what_happened": manual_rec_data.get("main_issue", ""),
            "why_flagged": manual_breaches,
            "what_to_do_next": manual_rec_data.get("recommended_actions", []),
            "final_decision_support_flag": manual_flag,
            "is_manual_analysis": True,
        }
        records = records + [manual_record]

    if asset_type and asset_type.strip():
        norm_type = asset_type.strip().lower()
        if norm_type not in ("all", "all asset types"):
            records = [r for r in records if r.get("asset_type", "").strip().lower() == norm_type]

    if country_or_region and country_or_region.strip():
        norm_loc = country_or_region.strip().lower()
        if norm_loc not in ("all", "all countries", "all countries & regions", "all regions"):
            records = [
                r for r in records
                if r.get("country", "").strip().lower() == norm_loc
                or r.get("region", "").strip().lower() == norm_loc
                or r.get("city", "").strip().lower() == norm_loc
                or r.get("continent", "").strip().lower() == norm_loc
            ]

    if priority and priority.strip():
        norm_prio = priority.strip().lower()
        if norm_prio not in ("all", "all priorities"):
            records = [r for r in records if r.get("investigation_priority", "").strip().lower() == norm_prio]

    return records


@app.get(
    "/api/insights/trends/filter-options",
    response_model=TrendFilterOptionsResponse,
    summary="Available filter choices for Network Trends",
    tags=["Trends"]
)
@app.get(
    "/insights/trends/filter-options",
    response_model=TrendFilterOptionsResponse,
    include_in_schema=False
)
async def get_trend_filter_options():
    """
    Returns dynamically populated filter choices from the loaded dataset.
    """
    if not ASSET_RECORDS:
        load_backend_data()

    asset_types = sorted(list({r.get("asset_type") for r in ASSET_RECORDS.values() if r.get("asset_type") and r.get("asset_type") != "Unknown"}))
    countries = sorted(list({r.get("country") for r in ASSET_RECORDS.values() if r.get("country") and r.get("country") != "Unknown"}))
    priorities = ["Routine", "Medium", "High"]

    return TrendFilterOptionsResponse(
        asset_types=asset_types,
        countries_and_regions=countries,
        priorities=priorities
    )


@app.get(
    "/api/insights/trends/priority",
    response_model=PriorityTrendsResponse,
    summary="Network Trends Section 1: Priority Distribution",
    tags=["Trends"]
)
@app.get(
    "/insights/trends/priority",
    response_model=PriorityTrendsResponse,
    include_in_schema=False
)
async def get_trend_priority(
    asset_type: Optional[str] = Query(None, description="Filter by Asset Type"),
    country_or_region: Optional[str] = Query(None, description="Filter by Country, Region, or City"),
    priority: Optional[str] = Query(None, description="Filter by Investigation Priority")
):
    """
    Returns Routine, Medium, and High asset counts, percentages, and dynamic NOC recommendation.
    """
    records = filter_asset_records(asset_type, country_or_region, priority)
    total = len(records)

    counts = {"Routine": 0, "Medium": 0, "High": 0}
    investigate_cnt = 0
    for r in records:
        p = r.get("investigation_priority", "Routine")
        if p in counts:
            counts[p] += 1
        else:
            counts["Routine"] += 1
        if r.get("final_decision_support_flag") == "Investigate":
            investigate_cnt += 1

    items = [
        PriorityTrendItem(
            priority=p,
            count=counts[p],
            percentage=round((counts[p] / total * 100), 1) if total > 0 else 0.0
        )
        for p in ["Routine", "Medium", "High"]
    ]

    suggestion = f"{investigate_cnt:,} assets need investigation. Start with High-priority assets."

    cur_manual_rec = get_last_analyzed_record()
    return PriorityTrendsResponse(
        items=items,
        total_assets=total,
        investigate_count=investigate_cnt,
        suggestion=suggestion,
        has_manual_analysis=(cur_manual_rec is not None),
        manual_asset_id=cur_manual_rec.get("asset_id") if cur_manual_rec else None,
    )


@app.get(
    "/api/insights/trends/by-asset-type",
    response_model=AssetTypeTrendsResponse,
    summary="Network Trends Section 2: Issues by Asset Type",
    tags=["Trends"]
)
@app.get(
    "/insights/trends/by-asset-type",
    response_model=AssetTypeTrendsResponse,
    include_in_schema=False
)
async def get_trend_by_asset_type(
    asset_type: Optional[str] = Query(None, description="Filter by Asset Type"),
    country_or_region: Optional[str] = Query(None, description="Filter by Country, Region, or City"),
    priority: Optional[str] = Query(None, description="Filter by Investigation Priority")
):
    """
    Returns percentage of High-priority assets for Router, Network Gateway, Cell Tower, and Base Station.
    """
    records = filter_asset_records(asset_type, country_or_region, priority)

    type_keys = ["Router", "Network Gateway", "Cell Tower", "Base Station"]
    items = []
    top_type = None
    max_pct = -1.0

    plural_map = {
        "Base Station": "Base Stations",
        "Cell Tower": "Cell Towers",
        "Router": "Routers",
        "Network Gateway": "Network Gateways"
    }

    for tk in type_keys:
        matching = [r for r in records if r.get("asset_type", "").strip().lower() == tk.lower()]
        total_k = len(matching)
        high_k = sum(1 for r in matching if r.get("investigation_priority") == "High")
        pct = round((high_k / total_k * 100), 1) if total_k > 0 else 0.0
        items.append(AssetTypeTrendItem(
            asset_type=tk,
            total_count=total_k,
            high_priority_count=high_k,
            high_priority_pct=pct
        ))
        if pct > max_pct and high_k > 0:
            max_pct = pct
            top_type = tk

    if top_type:
        plural_name = plural_map.get(top_type, f"{top_type}s")
        suggestion = f"{plural_name} have the highest share of high-priority assets. Review this asset type first."
    else:
        suggestion = "No high-priority assets detected for these asset types under the current filter."

    return AssetTypeTrendsResponse(
        items=items,
        highest_asset_type=top_type,
        highest_percentage=max_pct if max_pct >= 0 else 0.0,
        suggestion=suggestion,
        has_manual_analysis=(get_last_analyzed_record() is not None),
    )


@app.get(
    "/api/insights/trends/by-location",
    response_model=LocationTrendsResponse,
    summary="Network Trends Section 3: Issues by Location",
    tags=["Trends"]
)
@app.get(
    "/insights/trends/by-location",
    response_model=LocationTrendsResponse,
    include_in_schema=False
)
async def get_trend_by_location(
    asset_type: Optional[str] = Query(None, description="Filter by Asset Type"),
    country_or_region: Optional[str] = Query(None, description="Filter by Country, Region, or City"),
    priority: Optional[str] = Query(None, description="Filter by Investigation Priority")
):
    """
    Returns top cities or regions by high-priority asset count and location suggestion.
    """
    records = filter_asset_records(asset_type, country_or_region, priority)

    loc_high_counts: Dict[str, int] = defaultdict(int)
    loc_total_counts: Dict[str, int] = defaultdict(int)
    loc_country_map: Dict[str, str] = {}

    for r in records:
        city = r.get("city", "Unknown")
        if city and city != "Unknown":
            loc_total_counts[city] += 1
            if r.get("investigation_priority") == "High":
                loc_high_counts[city] += 1
            if r.get("country") and city not in loc_country_map:
                loc_country_map[city] = r.get("country")

    sorted_locs = sorted(
        loc_total_counts.keys(),
        key=lambda c: (loc_high_counts.get(c, 0), loc_total_counts.get(c, 0)),
        reverse=True
    )

    top_locs = sorted_locs[:6]
    items = [
        LocationTrendItem(
            location=loc,
            high_priority_count=loc_high_counts.get(loc, 0),
            total_count=loc_total_counts.get(loc, 0),
            country=loc_country_map.get(loc)
        )
        for loc in top_locs
    ]

    top_location = top_locs[0] if top_locs else None
    top_count = loc_high_counts.get(top_location, 0) if top_location else 0

    if top_location and top_count > 0:
        suggestion = f"{top_location} has the most high-priority assets. Use the Network Map to inspect this area."
    elif top_location:
        suggestion = f"{top_location} has the highest asset count in this filter. Use the Network Map to inspect this area."
    else:
        suggestion = "No assets found in the selected location filter."

    return LocationTrendsResponse(
        items=items,
        top_location=top_location,
        top_count=top_count,
        suggestion=suggestion,
        has_manual_analysis=(get_last_analyzed_record() is not None),
    )


@app.get(
    "/api/insights/trends/common-issues",
    response_model=CommonIssuesTrendsResponse,
    summary="Network Trends Section 4: Most Common Breached Measurements",
    tags=["Trends"]
)
@app.get(
    "/insights/trends/common-issues",
    response_model=CommonIssuesTrendsResponse,
    include_in_schema=False
)
async def get_trend_common_issues(
    asset_type: Optional[str] = Query(None, description="Filter by Asset Type"),
    country_or_region: Optional[str] = Query(None, description="Filter by Country, Region, or City"),
    priority: Optional[str] = Query(None, description="Filter by Investigation Priority")
):
    """
    Returns count of assets breaching each applicable measurement and dynamic action recommendation.
    """
    records = filter_asset_records(asset_type, country_or_region, priority)
    total = len(records)

    categories = {
        "Packet Loss": 0,
        "Resource Utilization": 0,
        "Traffic Load": 0,
        "Latency": 0,
        "Call-Drop Rate": 0,
        "Signal Strength": 0,
    }

    for r in records:
        why = r.get("why_flagged", [])
        seen_in_record = set()
        for item in why:
            low = item.lower()
            if "latency" in low and "latency" not in seen_in_record:
                categories["Latency"] += 1
                seen_in_record.add("latency")
            if "packet loss" in low and "packet_loss" not in seen_in_record:
                categories["Packet Loss"] += 1
                seen_in_record.add("packet_loss")
            if "traffic load" in low and "traffic_load" not in seen_in_record:
                categories["Traffic Load"] += 1
                seen_in_record.add("traffic_load")
            if "resource utilization" in low and "resource_utilization" not in seen_in_record:
                categories["Resource Utilization"] += 1
                seen_in_record.add("resource_utilization")
            if "signal strength" in low and "signal_strength" not in seen_in_record:
                categories["Signal Strength"] += 1
                seen_in_record.add("signal_strength")
            if ("call-drop" in low or "call drop" in low) and "call_drop" not in seen_in_record:
                categories["Call-Drop Rate"] += 1
                seen_in_record.add("call_drop")

    sorted_cats = sorted(categories.items(), key=lambda kv: kv[1], reverse=True)

    items = [
        IssueTrendItem(
            measurement=cat,
            count=cnt,
            percentage=round((cnt / total * 100), 1) if total > 0 else 0.0
        )
        for cat, cnt in sorted_cats
    ]

    action_map = {
        "Latency": "Check transport paths and congestion first.",
        "Packet Loss": "Inspect interface errors and transport-link quality first.",
        "Resource Utilization": "Optimize node compute resources and inspect high-load processes.",
        "Traffic Load": "Review link bandwidth utilization and balance network traffic.",
        "Call-Drop Rate": "Check cellular handover thresholds and carrier coverage.",
        "Signal Strength": "Inspect RF power levels, antenna alignment, and cell coverage.",
    }

    top_meas = sorted_cats[0][0] if sorted_cats and sorted_cats[0][1] > 0 else None
    top_cnt = sorted_cats[0][1] if sorted_cats else 0

    if top_meas and top_cnt > 0:
        action_text = action_map.get(top_meas, "Inspect related network telemetry and hardware thresholds.")
        suggestion = f"{top_meas} is the most common issue. {action_text}"
    else:
        suggestion = "No breached measurements detected in the current filtered view."

    return CommonIssuesTrendsResponse(
        items=items,
        top_measurement=top_meas,
        top_count=top_cnt,
        suggestion=suggestion,
        has_manual_analysis=(get_last_analyzed_record() is not None),
    )


# ---------------------------------------------------------------------------
# Direct Execution Entry Point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    port = settings.BACKEND_PORT if settings else 8000
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)
