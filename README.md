# NEXUSNET — Autonomous Telecom Network Intelligence & Decision Support Platform

NEXUSNET is an enterprise Network Operations Center (NOC) intelligence and health monitoring system. It processes telemetry across 6,000+ global telecom network assets, evaluates provisional SLA policy rules, predicts investigation priority via a Supervised Random Forest Classifier, identifies multivariate outliers via Isolation Forest anomaly detection, generates academic PDF operational reports, and provides an integrated Gemini-powered NOC Assistant.

---

## 📁 Project Directory Structure

```
ds-frontend-main/
│
├── backend/                  # Python FastAPI Backend Service
│   ├── app/
│   │   ├── api/routes/       # Modular API route controllers (e.g. chatbot.py)
│   │   ├── core/             # Application configuration & safe .env loader (config.py)
│   │   └── services/         # Gemini chat service & grounded prompt builder
│   ├── data/                 # Backend runtime caches and explanations JSON
│   │   ├── final_model_predictions.csv
│   │   └── network_health_v3_explanations.json
│   ├── reports/              # Storage directory for generated PDF reports
│   ├── tests/                # Automated pytest suite (29 tests)
│   │   └── test_api.py
│   ├── .env                  # Environment configuration & Gemini API key (git-ignored)
│   ├── .env.example          # Environment configuration template
│   ├── main.py               # FastAPI application entry point & SLA rule engine
│   ├── report_generator.py   # Academic PDF report generation engine
│   └── requirements.txt      # Python backend dependencies
│
├── frontend/                 # React 18 + Vite + Tailwind CSS Frontend
│   ├── src/
│   │   ├── api/              # Typed REST client & custom hooks
│   │   ├── components/       # UI components & global NOC Chatbot modal
│   │   ├── pages/            # 4 core views (Command Center, Network Map, Trends, Analyze Telemetry)
│   │   ├── types/            # TypeScript interfaces and schemas
│   │   ├── App.tsx           # Main application routing & global chatbot mount
│   │   └── main.tsx          # React application root
│   ├── index.html            # Single-page application entry point
│   ├── package.json          # Node dependencies & build scripts
│   ├── tailwind.config.js    # Custom Averon SaaS design theme
│   ├── tsconfig.json         # TypeScript compiler configuration
│   └── vite.config.ts        # Vite dev server configuration & backend proxy
│
├── data/                     # Dataset Directory
│   └── raw/
│       └── nexusnet_preprocessed_feature_engineered.csv  # 6,000-asset baseline metadata
│
├── models/                   # Machine Learning Model Artifacts
│   ├── random_forest_classifier.joblib                   # Supervised Random Forest Classifier
│   ├── anomaly_detector.joblib                           # Unsupervised Isolation Forest Anomaly Detector
│   ├── feature_config.json                               # RF feature specification
│   ├── anomaly_feature_config.json                       # IF feature specification
│   ├── model_metadata.json                               # Model metrics & metadata
│   └── encoder.joblib                                    # Category encoder
│
├── outputs/                  # Model Outputs & Evaluation Documentation
│   ├── final_model_predictions.csv                       # Consolidated predictions
│   ├── network_health_v3_explanations.json               # Full JSON explanations catalog
│   ├── network_health_v3_results.csv                     # V3 policy evaluation results
│   ├── model_training_dataset.csv                        # Normalized training split
│   ├── classifier_predictions.csv                        # RF validation predictions
│   ├── anomaly_detection_results.csv                     # Isolation Forest output scores
│   ├── random_forest_evaluation.md                       # Classifier performance audit
│   └── isolation_forest_evaluation.md                    # Anomaly detection audit
│
├── .gitignore                # Git ignore configuration
└── README.md                 # Project architecture & user guide
```

---

## 🚀 Quick Start Guide

### 1. Backend Setup & Startup

```bash
# Install Python dependencies
pip install -r backend/requirements.txt

# Start the FastAPI server (from repository root)
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
- Interactive API Documentation (Swagger UI): [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- Alternative direct execution: `python backend/main.py`

### 2. Frontend Setup & Startup

```bash
# Navigate to frontend and install dependencies
cd frontend
npm install

# Start Vite development server
npm run dev
```
- Access the web interface at: [http://localhost:3000](http://localhost:3000)

---

## 🧪 Testing & Verification

Run the automated backend test suite (29 tests validating health, insights, geographic lookups, PDF generation, and NOC Chatbot):

```bash
python -m pytest backend/tests/test_api.py -v
```

Build the production frontend bundle:

```bash
npm run build --prefix frontend
```
