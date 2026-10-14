# NEXUSNET — ML Hardening Report (Offline ML Layer)

**Date**: 2026-10-14  
**Project**: NEXUSNET Telecom NOC Intelligence System  
**Branch**: `ml-hardening`  
**Git Tag**: `before-ml-hardening`  

---

## 1. Executive Summary & Decision Taken

### Decision Rule Outcome
Per the project specification, the leakage ablation evaluated whether cause-side telemetry (`Signal_Strength_dBm`, `Traffic_Load_pct`, `Resource_Utilization_pct`, `Connected_Users`, `Throughput_Mbps`, `Peak_Hour`, `Asset_Type`) could forecast QoS SLA failure (`Label_QoS3`: Latency > 120ms OR Packet Loss > 4.5% OR Call Drop Rate > 3.5%):
- **Decision Criterion**: SHIP `cause_side` if 5-fold CV ROC-AUC $\ge 0.70$ AND PR-AUC $\ge \text{prevalence} + 0.10$ ($0.565$).
- **Measured Empirical Results**: RBF SVM on `(Label_QoS3, F_cause)` yielded:
  - **Mean CV ROC-AUC**: `0.578 ± 0.015` ($< 0.70$)
  - **Mean CV PR-AUC**: `0.467 ± 0.022` ($< 0.565$)
  - **Mean CV F1**: `0.391 ± 0.013`

### Shipped Model
Because the cause-side predictive power on this synthetic dataset is insufficient, the decision rule mandated shipping **`legacy_policy`**:
- **Target Label**: `Label_Legacy5` (5-clause SLA threshold rule)
- **Features**: `F9_current` (9 telemetry + engineered metrics)
- **Mandatory Limitation Statement**:
  > *"Risk score approximates a rule-defined SLA policy; metrics reflect that the label is a function of the inputs and must not be read as failure-prediction accuracy."*

---

## 2. Phase 3 Leakage Ablation Results

Evaluated across 5-fold Stratified Cross-Validation on all 6,000 records. All pipelines fit transformers inside folds.

| Experiment | Model | Accuracy | Precision | Recall | F1 Score | ROC-AUC | PR-AUC |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **(Legacy5, F9_current)**<br>*Prevalence: 46.50%* | **SVC (RBF, balanced)** | **0.945 ± 0.004** | 0.932 ± 0.005 | 0.952 ± 0.007 | **0.941 ± 0.004** | **0.990 ± 0.001** | **0.988 ± 0.002** |
| | DecisionTree (depth=3) | 0.989 ± 0.003 | 0.987 ± 0.005 | 0.989 ± 0.004 | 0.988 ± 0.003 | 0.988 ± 0.003 | 0.982 ± 0.005 |
| | LogisticRegression | 0.945 ± 0.004 | 0.939 ± 0.006 | 0.943 ± 0.006 | 0.941 ± 0.005 | 0.988 ± 0.002 | 0.985 ± 0.003 |
| | DummyClassifier (stratified) | 0.501 ± 0.009 | 0.464 ± 0.010 | 0.465 ± 0.010 | 0.465 ± 0.010 | 0.500 ± 0.009 | 0.465 ± 0.007 |
| **(QoS3, F_noderived)**<br>*Prevalence: 46.50%* | **SVC (RBF, balanced)** | **0.996 ± 0.002** | 0.995 ± 0.003 | 0.997 ± 0.002 | **0.996 ± 0.002** | **1.000 ± 0.000** | **1.000 ± 0.000** |
| | DecisionTree (depth=3) | 1.000 ± 0.000 | 1.000 ± 0.000 | 1.000 ± 0.000 | 1.000 ± 0.000 | 1.000 ± 0.000 | 1.000 ± 0.000 |
| | LogisticRegression | 0.982 ± 0.004 | 0.982 ± 0.004 | 0.978 ± 0.007 | 0.980 ± 0.004 | 0.998 ± 0.001 | 0.998 ± 0.001 |
| | DummyClassifier (stratified) | 0.501 ± 0.009 | 0.464 ± 0.010 | 0.465 ± 0.010 | 0.465 ± 0.010 | 0.500 ± 0.009 | 0.465 ± 0.007 |
| **(QoS3, F_cause)**<br>*Prevalence: 46.50%* | **SVC (RBF, balanced)** | **0.634 ± 0.017** | 0.650 ± 0.035 | 0.280 ± 0.017 | **0.391 ± 0.013** | **0.578 ± 0.015** | **0.467 ± 0.022** |
| | DecisionTree (depth=3) | 0.536 ± 0.016 | 0.502 ± 0.025 | 0.601 ± 0.081 | 0.543 ± 0.039 | 0.537 ± 0.018 | 0.490 ± 0.014 |
| | LogisticRegression | 0.632 ± 0.012 | 0.706 ± 0.038 | 0.228 ± 0.025 | 0.344 ± 0.031 | 0.577 ± 0.015 | 0.528 ± 0.014 |
| | DummyClassifier (stratified) | 0.501 ± 0.009 | 0.464 ± 0.010 | 0.465 ± 0.010 | 0.465 ± 0.010 | 0.500 ± 0.009 | 0.465 ± 0.007 |

### Key Ablation Insights:
1. **Target Leakage Proof**: The depth-3 Decision Tree on `(QoS3, F_noderived)` achieves **100.0% accuracy and 1.000 F1**, proving that supervised models simply reverse-engineer the 3 explicit boundary threshold clauses (`Latency > 120`, `Packet_Loss > 4.5`, `Call_Drop > 3.5`).
2. **Cause-Side Failure**: Excluding leaked SLA symptom columns drops RBF SVM ROC-AUC from $0.990$ down to $0.578$ (barely above the dummy classifier's $0.500$), demonstrating that synthetic data generator lacked strong physical causality between load/signal metrics and latency/packet loss.

---

## 3. Shipped Final SVM Performance

Trained using a stratified 80/20 train/test split (`random_state=42`) with 5-fold `GridSearchCV(scoring="f1")` fitted exclusively on the 4,800 training records. Refit with `probability=True` and evaluated **once** on the held-out test split ($n = 1,200$).

- **Pipeline Architecture**: `Pipeline(StandardScaler(), SVC(C=10, class_weight='balanced', gamma=0.1, kernel='rbf', probability=True))`
- **Best Hyperparameters**: `C = 10`, `gamma = 0.1`, `class_weight = "balanced"` (Best CV F1: `0.9577`)

### Held-Out Test Evaluation ($n = 1,200$):
- **Accuracy**: `96.42%` (0.9642)
- **Precision**: `94.94%` (0.9494)
- **Recall**: `97.49%` (0.9749)
- **F1 Score**: `96.20%` (0.9620)
- **ROC-AUC**: `99.55%` (0.9955)
- **PR-AUC**: `99.50%` (0.9950)
- **Brier Score**: `0.0265` (High probability calibration quality)

### Test Confusion Matrix:
$$\begin{pmatrix} \text{TN} = 613 & \text{FP} = 29 \\ \text{FN} = 14 & \text{TP} = 544 \end{pmatrix}$$
- Total Test Records: 1,200 (642 Normal, 558 At Risk)
- False Negative Rate: $2.51\%$ (14 missed at-risk assets)
- False Positive Rate: $4.52\%$ (29 false alarms)

---

## 4. DBSCAN Anomaly Detection Artifact

DBSCAN was built to replace frontend mocking with a rigorous multivariate density-based anomaly detector in Python.

- **Feature Input**: 8 base telemetry metrics (no derived or scaled values):  
  `Signal_Strength_dBm`, `Latency_ms`, `Packet_Loss_pct`, `Throughput_Mbps`, `Connected_Users`, `Traffic_Load_pct`, `Call_Drop_Rate_pct`, `Resource_Utilization_pct`
- **Scaler**: `StandardScaler` fitted on all 6,000 telemetry records
- **Heuristic Parameters**:
  - `min_samples = 16` ($2 \times \text{features}$)
  - `eps = 1.6` (Selected near 16-NN k-distance elbow curve; noise within the 2%–8% target window)
- **Clustering Outcome**:
  - **Dense Clusters**: 2 clusters (Cluster 0: 5,699 points; Cluster 1: 57 points)
  - **Core Samples**: 4,288 points
  - **Multivariate Outliers / Noise**: 244 points (**`4.07%`** noise)
- **Scoring Engine**: Scorable artifact containing `NearestNeighbors(n_neighbors=1)` fitted over the 4,288 core components in scaled space.
  - *Scoring Rule*: New point is scaled; Euclidean distance to nearest core point is computed. If $d \le 1.6$, assigned nearest core cluster (inlier); if $d > 1.6$, assigned $-1$ (multivariate anomaly).
  - *Verification*: Evaluated on all 6,000 training records, achieving **`100.0%` (6,000 / 6,000) exact reproduction** of DBSCAN anomaly labels.

---

## 5. Risk vs. Anomaly Cross-Tabulation ($n = 6,000$)

Combining the shipped SVM Risk predictions with DBSCAN anomaly scoring over the full 6,000 network assets:

| SVM Risk Status | DBSCAN Inlier | DBSCAN Anomaly (Outlier) | Total Assets | % of Fleet |
| :--- | :---: | :---: | :---: | :---: |
| **Normal (Healthy)** | 3,127 | 44 | 3,171 | **52.85%** |
| **At Risk (Policy Breach)** | 2,629 | 200 | 2,829 | **47.15%** |
| **Total** | **5,756 (95.93%)** | **244 (4.07%)** | **6,000** | **100.0%** |

### Operational Takeaways for NOC:
1. **At-Risk Anomalies (200 assets / 3.33%)**: High-priority critical degradation events exhibiting both SLA policy non-compliance and extreme multivariate telemetry deviation.
2. **Normal Anomalies (44 assets / 0.73%)**: Early-warning signals: assets that currently meet standard operational thresholds but operate in atypical telemetry regimes (e.g., unusual user-to-throughput density).
3. **At-Risk Inliers (2,629 assets / 43.82%)**: Routine policy violations operating in high-density regions (standard high-load capacity breaches).

---

## 6. Files Created and Modified

All modifications were restricted to allowed paths. No frontend files or legacy models were altered.

### New Modules (`backend/ml/`):
- `backend/ml/__init__.py`: Package initialization.
- `backend/ml/config.json`: Canonical system registry for thresholds, feature lists, and SLA clauses.
- `backend/ml/config.py`: Deterministic config loader and updater.
- `backend/ml/features.py`: Pure, deterministic feature engineering with division-by-zero protection.
- `backend/ml/ablation.py`: 5-fold Stratified CV leakage ablation engine.
- `backend/ml/train_final_svm.py`: GridSearchCV and final SVM pipeline training.
- `backend/ml/train_dbscan.py`: DBSCAN k-distance analysis, grid search, and scorable artifact generator.
- `backend/ml/inference.py`: Canonical offline ML inference contract (`predict_svm`, `score_dbscan`, `threshold_breaches`).
- `backend/ml/create_model_card.py`: Script to generate standardized `model_card.json`.

### New Datasets (`dataset/`):
- `dataset/nexusnet_worldwide_network_assets_6000.csv`: Local copy of canonical raw telemetry CSV.
- `dataset/nexusnet_features_labeled.csv`: Full unscaled dataset with engineered features, `Label_Legacy5`, and `Label_QoS3`.

### New Models and Plots (`backend/models/`, `backend/plots/`):
- `backend/models/svm_pipeline.joblib`: Shipped unified pipeline (`StandardScaler` + `SVC`).
- `backend/models/dbscan_artifact.joblib`: Shipped scorable DBSCAN nearest-core artifact.
- `backend/models/ablation_results.csv`: Complete empirical metrics table for all 12 ablation models.
- `backend/models/model_card.json`: Full machine-readable model metadata and operational card.
- `backend/plots/ablation_v2.png`: Bar chart comparing ablation model performances.
- `backend/plots/confusion_matrix_v2.png`: Heatmap of final SVM test confusion matrix.
- `backend/plots/roc_v2.png`: ROC curve with AUC metric ($0.9955$).
- `backend/plots/pr_v2.png`: Precision-Recall curve with AUC metric ($0.9950$).
- `backend/plots/dbscan_kdistance.png`: 16-NN distance elbow plot.

### Test Suite (`backend/tests/`):
- `backend/tests/__init__.py`
- `backend/tests/test_ml.py`: 12 automated pytest unit and integration tests (100% pass rate).

### Dependencies & CLI Updates:
- `backend/requirements.txt`: Specified permitted dependencies (`pandas`, `numpy`, `scikit-learn`, `joblib`, `matplotlib`, `seaborn`, `pytest`).
- `backend/predict.py`: Refactored to consume `backend.ml.inference` while maintaining CLI demo usability.
- `ML_CHANGES.md`: This comprehensive project report.

---

## 7. Known Limitations & Academic Disclaimers

1. **Synthetic Data**: The dataset contains 6,000 synthetic rows covering a single date (`2026-09-16 00:00` to `23:00`). The original generator script is unavailable.
2. **Single Telemetry Snapshot**: Only one observation exists per asset. No temporal time-series trends, periodicity, or degradation trajectory over days can be modeled.
3. **Target Leakage in Supervised Labels**: Labels are direct mathematical combinations of input telemetry metrics. SVM classification metrics reflect faithful policy rule recreation rather than physical hardware failure prediction.
4. **Prediction Score Semantics**: The model's calibrated probability indicates adherence to the composite SLA boundary, not empirical hardware failure likelihood.
5. **Local Timestamp Assumption**: Local asset time is assumed when computing peak hours (18:00–22:00) without timezone localization or regional offset adjustment.
