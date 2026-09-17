# NEXUSNET — AI-Powered Telecom Network Intelligence System

**NEXUSNET** is a production-grade, AI-Powered Telecom Network Operations Center (NOC) platform that monitors telecom infrastructure, predicts network degradation risk using SVM, detects outliers using DBSCAN, visualizes Indian geographic telecom networks on an interactive Leaflet map, and provides full Alert & Incident management workflows.

---

## 🔄 End-to-End Operational Workflow Pipeline

```
① Company Data Input ➔ ② RUN AI ANALYSIS (SVM + DBSCAN) ➔ ③ Network Health ➔ ④ Live Network Map
```

### 1. 🏢 Company Network Data Input (`/data-input`)
- **Single-Entry Ingestion**: Input company telemetry data via manual 13-parameter form or bulk CSV/Excel upload.
- **13 Telemetry Parameters**: Cell/Tower ID, Asset Type (`Cell`, `Tower`, `Base Station`, `Router`), Latitude, Longitude, Signal Strength (dBm), Latency (ms), Packet Loss (%), Throughput (Mbps), Connected Users, Traffic Load (%), Call Drop Rate (%), Resource Utilization (%), Timestamp.
- **Run AI Analysis Trigger**: Click **"RUN AI ANALYSIS →"** to execute SVM & DBSCAN AI models without re-entering data.

### 2. 🤖 AI Processing & Inference Results (`/svm` & `/dbscan`)
- **SVM Risk Prediction (`/svm`)**: Supervised classification model predicting **NORMAL** vs **AT RISK** categories, Risk Score %, Confidence Level %, primary degradation drivers, and model explanations.
- **DBSCAN Anomaly Detection (`/dbscan`)**: Unsupervised density-based spatial clustering classifying cells as **NORMAL** vs **ANOMALY** outliers, computing Anomaly Score (0.00–1.00), and plotting assets on the **Density Cluster Scatter Plot**.

### 3. 📈 Real-Time Network Health Dashboard (`/health`)
- Live telemetry health monitoring featuring 8 KPI cards with sparkline SVG charts, latency/throughput trends, and a **Submitted Company Telemetry Inventory Table**.

### 4. 🗺️ Interactive Live Network Map (`/map`)
- **Real Interactive Leaflet Map** with OpenStreetMap tiles centered on Indian telecom hubs (Pune, Mumbai, Delhi, Bengaluru, Hyderabad, Chennai, Ahmedabad, Kolkata).
- **Dynamic AI Status Marker Colors**:
  - 🟢 **Healthy**
  - 🟡 **Warning**
  - 🔴 **At Risk** (SVM Risk prediction)
  - 🟣 **Anomaly** (DBSCAN Anomaly outlier)
- **Asset Drawer**: Clicking any marker slides out a drawer displaying exact Cell/Tower ID, Asset Type, Lat/Lng coordinates, 13 telemetry parameters, and SVM + DBSCAN AI results.

---

## 🛠️ Technology Stack

- **Frontend Core**: React 18, Vite, TypeScript
- **Styling**: Custom NOC Dark Theme, Tailwind CSS
- **Interactive Mapping**: Leaflet, React Leaflet, OpenStreetMap
- **Data Visualization**: Recharts
- **Icons**: Lucide React
- **Routing**: React Router DOM v6

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)

### Installation & Local Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start local development server
npm run dev
```

Open `http://localhost:3000` in your web browser.

### Production Build

```bash
npm run build
```
