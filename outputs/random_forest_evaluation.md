# Random Forest Classifier Evaluation Report

**Model**: Random Forest Classifier (`n_estimators=100`, `random_state=42`, `class_weight='balanced'`)  
**Target**: `Investigation_Priority` (`Routine`, `Medium`, `High`)  
**Evaluation Dataset**: Held-out Stratified Test Split ($N = 1,200$, 20% of 6,000 assets)  
**Training Set**: $N = 4,800$ assets (80% of 6,000 assets)  

---

## ⚠️ Important Target Semantics & Policy Notice

> [!IMPORTANT]
> **Policy-Derived Target Notice**:  
> The classification target **`Investigation_Priority`** is strictly **policy-derived from the Version 3 rule-based heuristics engine** (`network_health_v3_results.csv`). It represents heuristic operational triage priority calculated from service performance symptom thresholds (latency, packet loss, call drop rate, utilization, and load).  
> **It does NOT represent observed real-world equipment failures, hardware breakdowns, or physical physical component outages.** The high model accuracy reflects the Random Forest's capability to learn and reproduce the multi-metric threshold decision boundaries of the Version 3 triage policy.

---

## 📊 Summary Test Performance

| Metric | Value | Percentage |
|---|---|---|
| **Accuracy** | `0.9950` | **`99.50%`** |
| **Macro Precision** | `0.9967` | **`99.67%`** |
| **Macro Recall** | `0.9902` | **`99.02%`** |
| **Macro F1-Score** | `0.9934` | **`99.34%`** |

---

## 📈 Per-Class Classification Report

| Priority Class | Precision | Recall | F1-Score | Support (Test Set) |
|---|---|---|---|---|
| **Routine** | `1.0000` | `0.9976` | `0.9988` | `417.0` |
| **Medium** | `0.9900` | `1.0000` | `0.9950` | `597.0` |
| **High** | `1.0000` | `0.9731` | `0.9864` | `186.0` |
| **Macro Average** | `0.9967` | `0.9902` | `0.9934` | `1,200` |
| **Weighted Average** | `0.9950` | `0.9950` | `0.9950` | `1,200` |

---

## 🗂️ Confusion Matrix (Test Set $N = 1,200$)

| True \ Predicted | Predicted: **Routine** | Predicted: **Medium** | Predicted: **High** | Total True |
|---|---|---|---|---|
| **True: Routine** | **`416`** | `1` | `0` | `417.0` |
| **True: Medium** | `0` | **`597`** | `0` | `597.0` |
| **True: High** | `0` | `5` | **`181`** | `186.0` |
| **Total Predicted** | `416` | `603` | `181` | `1,200` |

### Key Matrix Observations:
- **Routine Assets**: 416 of 417 correctly classified (99.76% recall). 0 false positives from High or Medium.
- **Medium Assets**: 597 of 597 correctly classified (100.00% recall). 6 borderline assets from adjacent classes mapped here.
- **High Priority Assets**: 181 of 186 correctly classified (97.31% recall, 100.00% precision). Zero false positives.

---

## 🔍 Feature Importances (Top 10)

| Rank | Feature | Importance | Relative Weight |
|---|---|---|---|
| 1 | `Packet_Loss_pct` | `0.3020` | 30.20% |
| 2 | `Latency_ms` | `0.1421` | 14.21% |
| 3 | `Call_Drop_Rate_pct` | `0.1372` | 13.72% |
| 4 | `Resource_Utilization_pct` | `0.0807` | 8.07% |
| 5 | `Traffic_Load_pct` | `0.0784` | 7.84% |
| 6 | `Network_Stress_Index` | `0.0620` | 6.20% |
| 7 | `Signal_Quality_Score` | `0.0293` | 2.93% |
| 8 | `Signal_Strength_dBm` | `0.0280` | 2.80% |
| 9 | `Asset_Type_Network Gateway` | `0.0252` | 2.52% |
| 10 | `Asset_Type_Router` | `0.0237` | 2.37% |

---

## 🧪 Five Representative Prediction Examples

| Asset ID | Hardware Type | Rule-Based Priority | Classifier Prediction | P(Routine) | P(Medium) | P(High) | Match |
|---|---|---|---|---|---|---|---|
| `AS-IND-PUN-MH-BS-00002` | Base Station | **Routine** | **Routine** | 1.00 | 0.00 | 0.00 | ✅ |
| `NA-USA-NEW-NY-CT-00004` | Cell Tower | **Medium** | **Medium** | 0.00 | 1.00 | 0.00 | ✅ |
| `AS-CHN-SHA-SH-RT-00001` | Router | **High** | **High** | 0.01 | 0.03 | 0.96 | ✅ |
| `OC-AUS-MEL-VIC-GW-00007` | Network Gateway | **Medium** | **Medium** | 0.02 | 0.95 | 0.03 | ✅ |
| `EU-FRA-PAR-IDF-CT-00003` | Cell Tower | **High** | **High** | 0.00 | 0.33 | 0.67 | ✅ |
