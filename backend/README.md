# NEXUSNET – AI-Powered Telecom Network Intelligence System
## Support Vector Machine (SVM) Classification Module (Academic & Viva Guide)

---

## 📌 Project Overview
**NEXUSNET** is a college-level Telecom Network Operations Center (NOC) intelligence platform designed to monitor cell towers, base stations, network gateways, and routers across global telecom infrastructure.

This module implements a **binary Support Vector Machine (SVM) classifier** using an **Radial Basis Function (RBF) kernel** to predict whether a given network asset is **Normal** (Operational) or **At Risk** (Experiencing operational stress / degradation).

---

## 🎯 Key Project Specifications
* **Dataset Size**: ~6,000 Telecom Asset Records (30 initial columns)
* **Algorithm Implemented**: Support Vector Machine (`sklearn.svm.SVC`)
* **Kernel Function**: Radial Basis Function (`kernel="rbf"`)
* **Evaluation Metrics**:
  * **Accuracy**: `95.50%`
  * **Precision**: `94.52%`
  * **Recall**: `95.88%`
  * **F1-Score**: `95.20%`

---

## ⚙️ 1. Domain-Specific Feature Engineering
From the raw company-level network telemetry metrics, 4 engineered features are automatically calculated:

1. **Network Stress Index (`Network_Stress_Index`)**:
   $$\text{Stress Index} = \frac{\text{Traffic Load (\%)} + \text{Resource Utilization (\%)} + \text{Packet Loss (\%)} + \text{Call Drop Rate (\%)}}{4}$$
   *Represents composite operational stress across load, loss, and drops.*

2. **Signal Quality Score (`Signal_Quality_Score`)**:
   $$\text{Signal Quality Score} = \text{clip}\left(\frac{\text{Signal Strength (dBm)} + 105}{50} \times 100, 0, 100\right)$$
   *Converts raw Reference Signal Received Power (RSRP in dBm, where -105 dBm is weak and -55 dBm is excellent) to a 0–100 score.*

3. **Throughput per User (`Throughput_per_User`)**:
   $$\text{Throughput per User} = \frac{\text{Throughput (Mbps)}}{\text{Connected Users}}$$
   *Measures bandwidth availability allocated to individual active subscribers.*

4. **Peak Hour Flag (`Peak_Hour`)**:
   *Binary flag (1 if Timestamp hour is between 18:00 and 22:00, 0 otherwise).*

---

## 🏷️ 2. Derived Prototype Target (`Network_Status`)
> **Note for Viva Examiner**: Real-world telecom failure logs are proprietary. A domain-expert prototype rule is derived to label assets:

An asset is classified as **At Risk (1)** if any of the following operational limits are breached:
* $\text{Network Stress Index} > 55\%$
* $\text{Packet Loss} > 4.5\%$
* $\text{Call Drop Rate} > 3.5\%$
* $\text{Latency} > 120\text{ ms}$
* $\text{Signal Quality Score} < 20$

Otherwise, the asset is classified as **Normal (0)**.

---

## 🚫 3. Feature Selection & Exclusion Strategy
To prevent data leakage and overfitting, non-predictive identifiers and geographical coordinates are strictly **excluded** from the SVM feature vector:

* **Excluded Features**: `Asset_ID`, `Continent`, `Country`, `City`, `Region`, `Latitude`, `Longitude`, `Timestamp`
* **Selected SVM Features (9)**:
  1. `Signal_Strength_dBm`
  2. `Latency_ms`
  3. `Packet_Loss_pct`
  4. `Traffic_Load_pct`
  5. `Call_Drop_Rate_pct`
  6. `Resource_Utilization_pct`
  7. `Network_Stress_Index`
  8. `Signal_Quality_Score`
  9. `Throughput_per_User`

---

## 🛠️ 4. Model Training & Pipeline Steps
1. **Train/Test Split**: 80% Training Data (4,800 samples), 20% Testing Data (1,200 samples) with `stratify=y` and `random_state=42`.
2. **Feature Scaling**: `StandardScaler()` fits on training data ($X_{\text{train}}$) to transform metrics into zero-mean, unit-variance z-scores.
3. **Model Configuration**:
   ```python
   from sklearn.svm import SVC

   svm_model = SVC(kernel="rbf", random_state=42, probability=True)
   svm_model.fit(X_train_scaled, y_train)
   ```

---

## 🚀 5. How to Run the Code

### Step A: Train Model & Save Artifacts
Run the training script from inside the `backend/` directory:
```bash
python train_svm.py
```
*Output*:
* Generates `nexusnet_svm_model.pkl` and `nexusnet_scaler.pkl` in `backend/` and `backend/models/`.
* Saves confusion matrix visualization to `backend/plots/confusion_matrix.png`.
* Updates dataset in `dataset/nexusnet_preprocessed_feature_engineered.csv`.

### Step B: Single Record Telemetry Prediction
Run single record inference:
```bash
python predict.py
```
*Output*: Displays asset metadata, engineered metrics, SVM prediction (`NORMAL` / `AT RISK`), prediction probability confidence %, and health summary diagnosis.

---

## 💡 Viva Q&A Guide for College Defence

**Q1: Why did you choose Support Vector Machine (SVM) for this dataset?**
* **Answer**: SVM is exceptionally effective for binary classification in medium-sized, high-dimensional numerical feature spaces. It constructs an optimal hyper-plane maximizing the margin between Normal and At-Risk assets.

**Q2: What is the role of the RBF Kernel?**
* **Answer**: The Radial Basis Function (RBF) kernel maps non-linear network metric relationships into a higher-dimensional feature space where a linear boundary can separate degraded assets from healthy ones.

**Q3: Why did you use `StandardScaler`?**
* **Answer**: SVM relies on distance metrics between support vectors. Unscaled features (e.g., Latency in 100s of ms vs Call Drop Rate in 0–5%) would allow larger magnitude variables to dominate distance calculations. `StandardScaler` standardizes all features to mean 0 and std 1.

**Q4: Why were `Latitude`, `Longitude`, and `Asset_ID` excluded?**
* **Answer**: Telemetry asset coordinates and IDs are arbitrary spatial/textual identifiers. Including them would lead to memorization (overfitting) rather than learning true network health degradation patterns.
