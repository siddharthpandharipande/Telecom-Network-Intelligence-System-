# NEXUSNET — New Frontend (Stitch Averon SaaS Design System)

This modern frontend application is an exact, high-fidelity implementation of the **Averon SaaS Design System** exported from Google Stitch, built with the project's production React + TypeScript + Vite + Tailwind CSS tech stack.

---

## 🚀 Tech Stack

- **Framework:** React 18 (`react`, `react-dom`)
- **Language:** TypeScript 5.5 (`strict: true`)
- **Build Tool:** Vite 5 (Fast HMR & Optimized Bundling)
- **Styling:** Tailwind CSS 3.4 with custom Averon tokens
- **Typography:** Plus Jakarta Sans (Primary Sans) & Newsreader (Editorial Serif Italic)
- **Icons:** Google Material Symbols Outlined & Lucide React
- **Routing:** React Router DOM v6
- **Cartography & Maps:** Real GIS Leaflet Engine with OpenStreetMap & CartoDB Positron Tiles, Live Beacon Pulsing Markers, RF Heatmap Coverage Circles, and Fiber Backbone Polylines
- **Data Visualizations:** Recharts & Interactive SVG Trajectories
- **Backend API:** Full typed integration with FastAPI backend (`http://localhost:8000`) with automatic offline demonstration fallback

---

## 🎨 Design System Hallmarks (Averon DNA)

1. **Atmospheric Ethereal Canvas:** Luminous `#FAF9FF` substrate with 3 ambient radial glow fields in lavender, soft rose, and indigo.
2. **Floating Pill Navigation Dock:** Centered frosted-glass navigation capsule with dark active state pills, scale-on-hover elevation, and smooth transitions across the 5 core pages.
3. **Editorial Typography Pairing:** Modern geometric **Plus Jakarta Sans** paired with elegant editorial serif italic accents (**Newsreader**) for headline authority.
4. **Spacious Squircle Cards:** Generous padding (`p-7` to `p-10`), `rounded-[28px]` and `rounded-[32px]` corner curvature, hairline borders (`border-slate-200/70`), and soft ambient shadows.
5. **Dual Comparative Matrices:** Clean "Legacy Static Thresholds" vs. "NEXUSNET AI Intelligence" operational comparison.
6. **Strict Separation of Models:** Clear visual distinction between supervised risk classification (**SVM**) and unsupervised spatial clustering (**DBSCAN**).

---

## 🖥️ The 5 Core Application Pages

| Route | Page | Description |
|---|---|---|
| `/` or `/command-center` | **Command Center** | Executive dashboard summarizing fleet health, 4 Bento metric cards with subtle hover lift, SVM vs DBSCAN distribution breakdown, and priority attention queue. |
| `/asset-investigation` | **Asset Investigation** | Deep inspection view for target node (e.g. `TWR-IND-042`). Features separate SVM & DBSCAN assessments, 8 telemetry measurements, deterministic threshold breaches, engineered features (NSI/SQS/TPU), 4-step evidence synthesis chain, and physical work order triage. |
| `/network-map` | **Network Map** | **Real GIS Cartography** powered by Leaflet using CartoDB Positron and OpenStreetMap tiles with live GPS coordinates (Mumbai West, BKC, Worli, Powai, Thane), pulsing beacon radar rings, RF coverage circles, fiber trunks, and target asset drawer. |
| `/network-trends` | **Network Trends** | Multi-dimensional time-series performance graphs for latency spikes, packet loss rates, top affected sectors, and downloadable CSV telemetry export. |
| `/analyze-telemetry` | **Analyze Telemetry** | Interactive simulation sandbox with 7-stage processing workflow, "At-Risk" and "Normal" presets, 8 live telemetry inputs, and real-time computation of NSI, SQS, TPU, threshold violations, and SVM/DBSCAN predictions. |

---

## 🛠️ How to Run

### 1. Navigate to directory
```powershell
cd "c:\Users\padha\Desktop\ds frontend\new frontend"
```

### 2. Install dependencies
```powershell
npm install
```

### 3. Start development server
```powershell
npm run dev
```
Starts at **`http://localhost:3000`**.
