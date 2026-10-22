# NEXUSNET — AI-Powered Telecom Network Intelligence System

**NEXUSNET** is a production-grade, AI-powered Telecom Network Operations Center (NOC) intelligence platform. It monitors mission-critical telecom infrastructure across 6,000+ assets, predicts equipment degradation risk via Support Vector Machines (SVM), discovers multidimensional density outliers with DBSCAN, renders physical and logical topology polylines on an interactive Leaflet map, provides simulated historical telemetry replay, streams real-time ingestion events via WebSockets, and enforces role-based access control (RBAC).

---

## 🏛️ System Architecture

```
                  ┌──────────────────────────────────────────────┐
                  │          React 18 + Vite Frontend            │
                  │  (Tailwind CSS, Leaflet Maps, Recharts, SVG) │
                  └───────┬──────────────────────────────▲───────┘
                          │ HTTP REST                    │ WebSocket
                          │ /api/health/dashboard        │ /api/ws/telemetry
                          │ /api/replay/*                │ (Live Ingestion)
                          │ /api/topology/links          │
                          │ /api/auth/*                  │
                          ▼                              │
                  ┌──────────────────────────────────────┴───────┐
                  │             FastAPI Backend                  │
                  │  - Authentication & RBAC (Bearer / scrypt)   │
                  │  - Real-Time ConnectionManager Broadcast     │
                  │  - Transparent NSI & Health Aggregations     │
                  │  - Historical Analytics Engine               │
                  └───────┬──────────────────────────────┬───────┘
                          │                              │
         ┌────────────────┴───────────────┐              │
         ▼                                ▼              ▼
┌──────────────────┐            ┌──────────────────┐  ┌──────────────────┐
│   ML Pipeline    │            │  SQLite Database │  │ Network Topology │
│ - SVM Classifier │            │  - 6,004 Assets  │  │ - Fiber Optics   │
│ - DBSCAN Cluster │            │  - 6,007 Telemetry│  │ - Microwave      │
│ - StandardScaler │            │  - Audit Users   │  │ - Satellite Mesh │
└──────────────────┘            └──────────────────┘  └──────────────────┘
```

---

## 🔑 Key Features & Implementation Overview

### 1. 📈 Network Health Dashboard (`/health`)
- **12 Database-Backed KPI Cards**: Total Network Assets, Normal Assets, At-Risk Assets, At-Risk %, DBSCAN Anomaly Count, Network Availability %, Avg Signal Strength (dBm), Avg Latency (ms), Avg Packet Loss (%), Avg Traffic Load (%), Avg Resource Utilization (%), and Mean Network Stress Index (NSI).
- **Explainable Health Calculation**:
  $$\text{NSI} = \frac{\text{Traffic Load} + \text{Resource Utilization} + \text{Packet Loss} + \text{Call Drop Rate}}{4}$$
  $$\text{Health Score} = 100 - (0.45 \times \text{NSI} + 0.35 \times \text{RiskPct} + 0.20 \times \text{AnomalyPct})$$
- **Configurable Tiers**: Healthy (Score $\ge 75$), Warning ($50 \le \text{Score} < 75$), Critical ($\text{Score} < 50$).
- **Responsive Analytics Charts**: Normal vs At Risk distribution, DBSCAN anomaly breakdown, NSI distribution, latency & packet loss per asset type, signal strength distribution, and regional risk distribution.
- **Multidimensional Filters**: Continent, Country, City, Asset Type, and Status filters with backend SQL aggregation.
- **Asset Details Drawer**: Complete telemetry, derived metrics, SVM prediction, DBSCAN cluster label, and decision-support disclaimers.

### 2. ⏪ Feature 1: Simulated Historical Telemetry Replay (`/map`)
- Step-through chronological replay of the 24-hour observation cycle (`2026-09-16 00:00:00` to `23:00:00`).
- **Controls**: Play, Pause, Step Backward, Step Forward, Reset to Hour 0, Playback Speed (1x, 2x, 5x, 10x), and interactive 0–23h scrubber.
- Dynamic marker updates, simulated timestamp badge, and transparent labeling as **Simulated Historical Replay**.

### 3. ⚡ Feature 2: Real-Time WebSocket Streaming (`/api/ws/telemetry`)
- Full duplex WebSocket endpoint with client heartbeat (ping/pong) and auto-reconnect logic.
- Asynchronous broadcasting triggered whenever new telemetry is uploaded via single entry or bulk CSV ingestion.
- Truthful Topbar connection pill: `Connected — awaiting new telemetry` when idle.

### 4. 🛡️ Feature 3: Authentication and Role-Based Access Control (RBAC)
- Password hashing with **scrypt** and secure bearer session token generation (`secrets.token_urlsafe(32)`).
- Three discrete operational roles:
  - **NOC Analyst**: Dashboard monitoring, map inspection, telemetry ingestion, permitted inference.
  - **Network Engineer**: Root-cause diagnostics, incident lifecycle resolution, threshold investigating.
  - **Administrator**: User account management, system configuration, link topology administration.
- CLI User Management: `backend/app/manage_users.py`.
- Fast Presentation Role Switcher in the top bar for evaluation demonstrations.

### 5. 🌐 Feature 4: Physical & Logical Network Links (`/map`)
- Leaflet `Polyline` topology layer connecting real infrastructure coordinates.
- Supports **Fiber Optic** (cyan), **Microwave Link** (amber), and **Satellite Mesh** (purple).
- Seeded with 30 realistic backbone links across Mumbai, Pune, Delhi, Bengaluru, Hyderabad, Chennai, and Singapore.
- Explicitly labeled in the UI and database schema as **Demonstration Topology** (`is_synthetic=True`) to preserve data integrity.
- Interactive link click drawer with bandwidth capacity, live utilization %, and operational status.

### 6. 📅 Feature 5: Multi-Day Historical Trends (`/analytics`)
- Historical aggregation engine supporting date-range filtering, asset-specific filtering, and hourly averages.
- Visualizes mean NSI, resource utilization, latency, and packet loss trends over time with Recharts.
- Clear empty-state handling explaining available database coverage (`2026-09-16`) and accepting future multi-day uploads.

---

## 🚀 Quickstart & Local Setup

### 1. Prerequisites
- **Python**: 3.10+ (tested with Python 3.11, 3.12, 3.14)
- **Node.js**: v18+ and **npm**: v9+

### 2. Backend Setup & Run

```bash
# Clone the repository
git clone https://github.com/siddharthpandharipande/Telecom-Network-Intelligence-System-.git
cd Telecom-Network-Intelligence-System-

# (Optional) Create virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install Python dependencies
pip install -r backend/requirements.txt

# Start FastAPI server on port 8000
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
The backend API documentation is available at `http://127.0.0.1:8000/docs`.

### 3. Frontend Setup & Run

```bash
# From repository root
cd frontend

# Install npm dependencies
npm install

# Start Vite dev server on port 3000
npm run dev
```
Open `http://localhost:3000` in your web browser.

---

## 👤 User Accounts & Role Credentials

The database automatically seeds 3 demonstration accounts on initial startup:

| Username | Password | Role | Description |
| :--- | :--- | :--- | :--- |
| `admin` | `NocAdmin@2026` | **Administrator** | Full configuration, user management & topology editing |
| `engineer` | `Engineer@2026` | **Network Engineer** | Diagnostics, incident management, threshold analysis |
| `analyst` | `Analyst@2026` | **NOC Analyst** | Operations dashboard, live map, asset inspection |

### Safe Initial Admin Seeding via CLI

To create a new administrator or reset credentials without hardcoding:

```bash
# Set PYTHONPATH to repository root
python backend/app/manage_users.py create --username custom_admin --password "StrongPassword123" --email "admin@telecom.org" --role admin
```

To list all existing users:
```bash
python backend/app/manage_users.py list
```

---

## 🧪 Automated Testing & Verification

### Running Backend Pytest Suite

```bash
python -m pytest backend/tests -v
```
**Results**: **32 passed, 0 failures**.
Covers:
- Authentication, token generation, login/logout, unauthorized access
- Demonstration topology CRUD & self-link prevention
- Replay boundaries, slices, and metadata
- Network Health Dashboard 12 KPI calculations
- Historical trends aggregation
- SVM feature engineering and inference determinism
- DBSCAN anomaly detection reproduction
- Ingestion validation and duplicate prevention

### Running Frontend Production Build

```bash
cd frontend
npm run build
```
**Results**:
- TypeScript type checking: `tsc` passed with 0 errors.
- Vite production bundle built cleanly into `dist/`.

---

## 📡 API Reference Summary

| Method | Endpoint | Description | Role / Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticate with username & password, returns Bearer token | Public |
| `POST` | `/api/auth/logout` | Invalidate current session token | Authenticated |
| `GET` | `/api/auth/me` | Return active user profile and permissions | Authenticated |
| `GET` | `/api/health/dashboard` | 12 KPIs, transparent NSI formula, and 6 distribution sets | Public / Analyst |
| `GET` | `/api/replay/meta` | Replay window metadata (start/end timestamp, hourly steps) | Public / Analyst |
| `GET` | `/api/replay/slice?hour=H` | Telemetry slice for specific simulated hour (0–23) | Public / Analyst |
| `WS` | `/api/ws/telemetry` | WebSocket stream broadcasting new telemetry ingestions | Public / Analyst |
| `GET` | `/api/topology/links` | Retrieve physical/logical link polylines | Public / Analyst |
| `POST` | `/api/topology/links` | Create network link between assets | Administrator |
| `GET` | `/api/analytics/history` | Multi-day and hourly historical trend analysis | Public / Analyst |

---

## ⚖️ Model & Data Integrity Note

- **SVM Risk vs DBSCAN Anomaly**: SVM predicts whether an asset is **NORMAL** or **AT RISK** based on supervised multidimensional degradation indicators. DBSCAN detects points outside dense operating clusters as **ANOMALIES** (noise). These models operate independently and are never conflated.
- **Decision-Support Outputs**: Model predictions represent algorithmic risk classifications to guide engineering triage, not infallible mechanical diagnoses.
- **Topology Integrity**: The 30 demo links are explicitly tagged `is_synthetic=True` and labeled in the UI as **Demonstration Topology** to avoid confusing simulated demo topology with genuine survey infrastructure.
