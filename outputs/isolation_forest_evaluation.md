# Isolation Forest Anomaly Detection Report

**Model**: `IsolationForest(n_estimators=100, contamination=0.05, random_state=42)`  
**Dataset**: `outputs/model_training_dataset.csv` ($N = 6,000$ assets)  
**Features Evaluated**: 13 numeric telemetry and behavioral features  

---

## ⚠️ Operational Definition & Disclaimer

> [!IMPORTANT]
> **Anomaly Definition & Diagnostic Scope**:  
> In this system, an **anomaly represents an unusual, statistically rare multi-dimensional telemetry pattern** that deviates significantly from baseline cluster behavior.  
> **An anomaly is NOT a confirmed physical hardware failure, mechanical breakdown, or catastrophic service outage.** It serves as an automated triage signal indicating assets with atypical operational conditions (e.g., extreme latency spikes, irregular load/drop combinations, or outlier resource stress) that warrant engineering inspection.

---

## 📊 Summary Anomaly Statistics

| Metric | Value |
|---|---|
| **Total Evaluated Assets** | `6,000` |
| **Anomalous Assets Count** | **`300`** |
| **Anomalous Assets Percentage** | **`5.00%`** |
| **Normal / Baseline Assets Count** | `6,000 - 300 = 5,700` |
| **Normal Assets Percentage** | `95.00%` |
| **Anomaly Score Min** | `0.4069` |
| **Anomaly Score Max** | `0.6678` |
| **Anomaly Score Mean** | `0.4811` |
| **Anomaly Score Median** | `0.4751` |
| **Anomaly Score Std Dev** | `0.0399` |

---

## 📈 Anomaly Score Distribution Breakdown

### Percentile Distribution ($N = 6,000$)
| Percentile | Anomaly Score Threshold | Description |
|---|---|---|
| **Min (0th)** | `0.4069` | Most typical / core nominal telemetry |
| **25th (Q1)** | `0.4515` | Normal operating quartile |
| **50th (Median)** | `0.4751` | Central tendency |
| **75th (Q3)** | `0.5038` | Elevated telemetry activity |
| **90th** | `0.5356` | Noticeable operational deviation |
| **95th (Decision Boundary)** | `0.5576` | Outlier cutoff ($P_{95}$) |
| **99th** | `0.5957` | Extreme statistical outlier |
| **Max (100th)** | `0.6678` | Maximum deviation in dataset |

### Cohort Comparison
- **Anomalous Cohort ($n=300$)**: Mean Score = `0.5815`, Median = `0.5787`, Range = `[0.5576, 0.6678]`
- **Normal Cohort ($n=5700$)**: Mean Score = `0.4758`, Median = `0.4727`, Range = `[0.4069, 0.5576]`

---

## 🔍 Five Representative Anomalous Assets (`is_anomalous = True`)

| Asset ID | Hardware Type | Anomaly Score | Latency (ms) | Packet Loss (%) | Call Drop (%) | Load (%) | Utilization (%) |
|---|---|---|---|---|---|---|---|
| `AS-IND-BEN-KA-RT-00019` | Router | **`0.5793`** | `172.49` | `11.53%` | `3.24%` | `91.68%` | `91.84%` |
| `AF-ZAF-JOH-GP-GW-00038` | Network Gateway | **`0.5866`** | `169.45` | `4.05%` | `8.12%` | `87.98%` | `94.81%` |
| `NA-USA-LOS-CA-CT-00057` | Cell Tower | **`0.5595`** | `161.90` | `6.00%` | `8.02%` | `83.55%` | `98.35%` |
| `SA-ARG-BUE-BA-GW-00114` | Network Gateway | **`0.5846`** | `215.57` | `6.66%` | `7.88%` | `82.75%` | `91.28%` |
| `EU-GBR-LON-ENG-BS-00152` | Base Station | **`0.5610`** | `186.72` | `7.65%` | `7.84%` | `82.98%` | `89.86%` |

---

## 🛡️ Five Representative Non-Anomalous Assets (`is_anomalous = False`)

| Asset ID | Hardware Type | Anomaly Score | Latency (ms) | Packet Loss (%) | Call Drop (%) | Load (%) | Utilization (%) |
|---|---|---|---|---|---|---|---|
| `AS-CHN-SHA-SH-RT-00001` | Router | **`0.4867`** | `101.79` | `3.97%` | `2.97%` | `53.73%` | `66.61%` |
| `AS-IND-PUN-MH-BS-00002` | Base Station | **`0.4699`** | `43.53` | `2.36%` | `1.30%` | `34.84%` | `46.72%` |
| `EU-FRA-PAR-IDF-CT-00003` | Cell Tower | **`0.4797`** | `52.78` | `3.23%` | `3.43%` | `68.58%` | `60.72%` |
| `NA-USA-NEW-NY-CT-00004` | Cell Tower | **`0.4760`** | `68.20` | `3.60%` | `0.44%` | `69.70%` | `79.04%` |
| `AS-KOR-SEO-11-CT-00005` | Cell Tower | **`0.4647`** | `60.63` | `1.03%` | `2.66%` | `41.61%` | `80.72%` |
