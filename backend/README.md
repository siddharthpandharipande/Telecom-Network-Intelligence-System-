# NEXUSNET Backend API

FastAPI service integrating Version 3 heuristic asset health explanations with supervised machine learning triage predictions (Random Forest) and unsupervised anomaly detection scores (Isolation Forest).

---

## 📋 Features

- **Fast In-Memory Lookup**: Loads `network_health_v3_explanations.json` and `final_model_predictions.csv` once on startup into memory for $O(1)$ lookups.
- **Combined Decision Support**: Returns all 14 specified explanation and ML inference fields.
- **Decision Statistics**: Provides high-level operational overview via `/models/info`.
- **Error Handling**: Gracefully returns structured HTTP 404 JSON on missing asset IDs without crashing.
- **Cross-Origin Ready**: CORS middleware enabled for frontend integration (`localhost:3000`).

---

## 🛠️ Quickstart

### 1. Install Dependencies
```bash
pip install -r backend/requirements.txt
```

### 2. Start the Backend API Server
```bash
# From repository root or DSCP1:
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
Interactive Swagger documentation: `http://127.0.0.1:8000/docs`

---

## 📡 Endpoints

### 1. `GET /health`
- **Description**: Operational health check.
- **Response**: `200 OK`
```json
{
  "status": "ok"
}
```

### 2. `GET /models/info`
- **Description**: Returns asset counts, decision flag counts, and models used.
- **Response**: `200 OK`
```json
{
  "assets_loaded": 6000,
  "investigate_count": 1024,
  "monitor_count": 4976,
  "models_used": [
    "Version 3 Rule-Based Heuristic Policy Engine",
    "Random Forest Classifier (Investigation Priority)",
    "Isolation Forest (Telemetry Anomaly Detector)"
  ]
}
```

### 3. `GET /assets/{asset_id}/health`
- **Description**: Detailed health explanation and decision support record for an asset.
- **Response (Valid Asset)**: `200 OK`
```json
{
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
  "is_anomalous": false,
  "final_decision_support_flag": "Investigate"
}
```

- **Response (Invalid Asset)**: `404 Not Found`
```json
{
  "error": "Asset not found",
  "asset_id": "UNKNOWN_ID"
}
```

---

## 🧪 Automated Testing
```bash
python -m pytest backend/tests -v
```
