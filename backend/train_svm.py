"""
NEXUSNET - AI-Powered Telecom Network Intelligence System
=========================================================
Module: SVM Network Risk Classification Model Training
Description: 
    Trains a Support Vector Machine (SVM) binary classifier using an RBF kernel to predict 
    whether a telecom network asset is 'Normal' (0) or 'At Risk' (1).
    
College / Academic Project Implementation
Author: Siddharth Pandharipande
"""

import os
import sys

# Ensure UTF-8 output encoding for Windows terminal compatibility
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

import joblib
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
    classification_report
)

def train_nexusnet_svm():
    print("=" * 70)
    print(" NEXUSNET: AI-Powered Telecom Network Intelligence System")
    print(" Module: Support Vector Machine (SVM) Classifier Training")
    print("=" * 70)

    # -------------------------------------------------------------------------
    # STEP 1: LOAD DATASET
    # -------------------------------------------------------------------------
    csv_path_raw = r"C:\Users\sidpa\OneDrive\VIT-SEM-5-TY\Data Science\nexusnet_worldwide_network_assets_6000.csv"
    csv_path_repo = os.path.join("..", "dataset", "nexusnet_preprocessed_feature_engineered.csv")

    if os.path.exists(csv_path_raw):
        print(f"\n[1/6] Loading raw telecom telemetry dataset from:\n      {csv_path_raw}")
        df = pd.read_csv(csv_path_raw)
    elif os.path.exists(csv_path_repo):
        print(f"\n[1/6] Loading dataset from repository path:\n      {csv_path_repo}")
        df = pd.read_csv(csv_path_repo)
    else:
        raise FileNotFoundError("Could not locate NEXUSNET dataset CSV file!")

    print(f"      Dataset Shape: {df.shape[0]} rows x {df.shape[1]} columns")

    # -------------------------------------------------------------------------
    # STEP 2: FEATURE ENGINEERING (AUTOMATIC CALCULATION)
    # -------------------------------------------------------------------------
    print("\n[2/6] Performing Domain-Specific Feature Engineering...")

    # Calculate Network Stress Index (Average load & degradation factors)
    df['Network_Stress_Index'] = (
        df['Traffic_Load_pct'] + 
        df['Resource_Utilization_pct'] + 
        df['Packet_Loss_pct'] + 
        df['Call_Drop_Rate_pct']
    ) / 4.0

    # Calculate Throughput per Connected User (Mbps per user)
    df['Throughput_per_User'] = df['Throughput_Mbps'] / df['Connected_Users'].replace(0, np.nan)
    df['Throughput_per_User'] = df['Throughput_per_User'].fillna(0.0)

    # Calculate Signal Quality Score (Scale -105 dBm to -55 dBm into 0 - 100%)
    df['Signal_Quality_Score'] = np.clip(((df['Signal_Strength_dBm'] + 105.0) / 50.0) * 100.0, 0.0, 100.0)

    # Timestamp Decomposition
    df['Timestamp_dt'] = pd.to_datetime(df['Timestamp'], errors='coerce')
    df['Hour'] = df['Timestamp_dt'].dt.hour
    df['Peak_Hour'] = np.where(df['Hour'].between(18, 22), 1, 0)

    print("      [+] Created: Network_Stress_Index")
    print("      [+] Created: Throughput_per_User")
    print("      [+] Created: Signal_Quality_Score")
    print("      [+] Created: Peak_Hour Flag")

    # -------------------------------------------------------------------------
    # STEP 3: PROTOTYPE TARGET CREATION (Network_Status)
    # -------------------------------------------------------------------------
    # NOTE FOR VIVA / ACADEMIC REVIEW:
    # Since real telecom ground-truth labels are proprietary, we define a prototype
    # target label based on domain rules. An asset is 'At Risk' (1) if operational thresholds are breached.
    print("\n[3/6] Defining Derived Prototype Target Column: Network_Status")
    print("      Logic: Asset is 'At Risk' (1) if Stress > 55% OR Packet Loss > 4.5% OR")
    print("             Call Drop > 3.5% OR Latency > 120ms OR Signal Quality < 20%")
    print("             Otherwise 'Normal' (0).")

    df['Network_Status'] = np.where(
        (df['Network_Stress_Index'] > 55.0) | 
        (df['Packet_Loss_pct'] > 4.5) | 
        (df['Call_Drop_Rate_pct'] > 3.5) | 
        (df['Latency_ms'] > 120.0) | 
        (df['Signal_Quality_Score'] < 20.0),
        'At Risk',
        'Normal'
    )

    # Save updated CSV to dataset directory for transparency
    dataset_out_path = os.path.join("..", "dataset", "nexusnet_preprocessed_feature_engineered.csv")
    os.makedirs(os.path.dirname(dataset_out_path), exist_ok=True)
    df.to_csv(dataset_out_path, index=False)
    print(f"      [+] Updated preprocessed CSV saved to: {dataset_out_path}")

    # Class balance overview
    class_counts = df['Network_Status'].value_counts()
    print(f"      Class Distribution: Normal = {class_counts.get('Normal', 0)}, At Risk = {class_counts.get('At Risk', 0)}")

    # -------------------------------------------------------------------------
    # STEP 4: FEATURE SELECTION & TRAIN-TEST SPLIT
    # -------------------------------------------------------------------------
    # Exclude non-predictive metadata: Asset_ID, City, Country, Region, Continent, Latitude, Longitude
    feature_columns = [
        'Signal_Strength_dBm',
        'Latency_ms',
        'Packet_Loss_pct',
        'Traffic_Load_pct',
        'Call_Drop_Rate_pct',
        'Resource_Utilization_pct',
        'Network_Stress_Index',
        'Signal_Quality_Score',
        'Throughput_per_User'
    ]

    X = df[feature_columns]
    y = (df['Network_Status'] == 'At Risk').astype(int)  # 0 = Normal, 1 = At Risk

    print(f"\n[4/6] Preparing Data for Training:")
    print(f"      Selected {len(feature_columns)} Features: {feature_columns}")
    print(f"      Excluded Identifiers & Geographics (Asset_ID, Latitude, Longitude, etc.)")

    # Train-Test Split (80% Train, 20% Test, Stratified)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print(f"      Train Set: {X_train.shape[0]} samples | Test Set: {X_test.shape[0]} samples")

    # Feature Scaling using StandardScaler
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    print("      [+] Standardized features using StandardScaler (mean=0, variance=1)")

    # -------------------------------------------------------------------------
    # STEP 5: SVM MODEL TRAINING
    # -------------------------------------------------------------------------
    print("\n[5/6] Training Support Vector Machine (SVM) Classifier...")
    print("      Hyperparameters: kernel='rbf', random_state=42, probability=True")

    svm_model = SVC(
        kernel='rbf',
        random_state=42,
        probability=True
    )
    svm_model.fit(X_train_scaled, y_train)
    print("      [+] SVM Classifier training completed successfully!")

    # -------------------------------------------------------------------------
    # STEP 6: EVALUATION & ARTIFACT EXPORT
    # -------------------------------------------------------------------------
    y_pred = svm_model.predict(X_test_scaled)
    y_proba = svm_model.predict_proba(X_test_scaled)[:, 1]

    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred)
    rec = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    roc_auc = roc_auc_score(y_test, y_proba)
    cm = confusion_matrix(y_test, y_pred)

    print("\n" + "=" * 70)
    print(" MODEL EVALUATION RESULTS")
    print("=" * 70)
    print(f"  • Accuracy        : {acc * 100:.2f}%")
    print(f"  • Precision       : {prec * 100:.2f}%")
    print(f"  • Recall          : {rec * 100:.2f}%")
    print(f"  • F1-Score        : {f1 * 100:.2f}%")
    print(f"  • ROC-AUC Score   : {roc_auc * 100:.2f}%")
    print("\nConfusion Matrix:")
    print(f"  [[ TN={cm[0][0]:<4}  FP={cm[0][1]:<4} ]")
    print(f"   [ FN={cm[1][0]:<4}  TP={cm[1][1]:<4} ]]")
    print("\nClassification Report:\n")
    print(classification_report(y_test, y_pred, target_names=['Normal', 'At Risk']))
    print("=" * 70)

    # Plot Confusion Matrix using Matplotlib / Seaborn
    os.makedirs("plots", exist_ok=True)
    plt.figure(figsize=(7, 5))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=['Normal', 'At Risk'], yticklabels=['Normal', 'At Risk'])
    plt.title('NEXUSNET SVM Model - Confusion Matrix', fontsize=14, fontweight='bold')
    plt.xlabel('Predicted Label', fontsize=12)
    plt.ylabel('Actual Ground Truth', fontsize=12)
    plt.tight_layout()
    plot_path = os.path.join("plots", "confusion_matrix.png")
    plt.savefig(plot_path, dpi=300)
    plt.close()
    print(f"\n[Visual] Saved Confusion Matrix plot to: {plot_path}")

    # Save Model and Scaler Artifacts
    models_dir = "models"
    os.makedirs(models_dir, exist_ok=True)

    model_path_1 = os.path.join(models_dir, "nexusnet_svm_model.pkl")
    scaler_path_1 = os.path.join(models_dir, "nexusnet_scaler.pkl")
    model_path_2 = "nexusnet_svm_model.pkl"
    scaler_path_2 = "nexusnet_scaler.pkl"

    joblib.dump(svm_model, model_path_1)
    joblib.dump(scaler, scaler_path_1)
    joblib.dump(svm_model, model_path_2)
    joblib.dump(scaler, scaler_path_2)

    print("\n[Artifacts Saved Successfully]:")
    print(f"  [+] {model_path_1}")
    print(f"  [+] {scaler_path_1}")
    print(f"  [+] {model_path_2}")
    print(f"  [+] {scaler_path_2}")
    print("\n Training complete! Model is ready for single-record prediction.\n")

if __name__ == "__main__":
    train_nexusnet_svm()
