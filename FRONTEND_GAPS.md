# FRONTEND GAPS & BACKEND CAPABILITY NOTES

This document notes endpoints, features, and capabilities in the NEXUSNET frontend rewire that required handling due to backend API architecture, missing backend models, or dataset boundaries.

---

### 1. Network Topology Links
- **Gap:** The backend database schema contains `assets`, `telemetry_readings`, `incidents`, `audit_events`, and `ingest_logs`. There is no table or relationship modeling physical or logical network links between nodes.
- **Frontend Action Taken:** Removed all hardcoded `INITIAL_LINKS` and map SVG link polylines. Removed the fake "Network Links" KPI counter from `NetworkAssets.tsx` and `Overview.tsx`. The frontend does not fabricate mock topology links.

---

### 2. Multi-Day Historical Time Series & Hourly Profile Meaningfulness
- **Gap:** The underlying dataset is a synthetic snapshot covering a single calendar day (`2026-09-16 00:00:00` to `23:00:00`). The backend endpoint `GET /api/analytics/hourly` returns `meaningful: false` because hourly aggregations over a single day do not constitute a multi-day longitudinal time series trend.
- **Frontend Action Taken:** `Overview.tsx` inspects `meaningful`. Because `meaningful === false`, it renders the alternative distribution of records across asset types (Base Station, Cell Tower, Network Gateway, Router) and clearly states the data snapshot range: `"Dataset snapshot: 2026-09-16 00:00:00 to 2026-09-16 23:00:00"`. Deceptive multi-day trend charts (`PERFORMANCE_DATA`) were completely removed.

---

### 3. Operator Authentication & Multi-User Profiles
- **Gap:** The FastAPI prototype does not implement session authentication, JWT tokens, user databases, or OAuth.
- **Frontend Action Taken:** Removed the hardcoded operator profile card from `/settings` and replaced it with a permanent note: `"No authentication in this prototype — single-session NOC analyst mode."` Operator names in incident action logs default to `"NOC Analyst"` or the user's manual input.

---

### 4. Continuous Live Telemetry Streaming
- **Gap:** There is no WebSocket server or SSE (Server-Sent Events) live stream pushing telemetry packets from real-world cell towers.
- **Frontend Action Taken:** Removed the 3-second `setInterval` artificial jitter generator from `TelemetryContext.tsx`. Replaced the misleading `"Live Stream"` topbar button with a truthful `"Snapshot (2026-09-16)"` badge. Wording like "Live Map" was updated to "Network Map", and "Live Telemetry" was updated to "Latest telemetry snapshot".

---

### 5. Backend Status Legend Alignment
- **Frontend Action Taken:** Frontend status badges and circle markers derive colors and labels directly from the live `GET /api/config` (`status_legend`):
  - `green`: Normal — SVM classifies as Normal, no DBSCAN anomaly.
  - `yellow`: Degraded / At Risk — SVM classifies as elevated risk.
  - `purple`: Structural Anomaly — DBSCAN classifies as noise cluster (-1).
  - `red`: Compound Critical Risk — Node is BOTH at risk AND an anomaly.
