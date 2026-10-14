"""Phase 4: Decision Rule and Final Shipped SVM Model Training.
Trains the selected variant inside a leak-free sklearn Pipeline using GridSearchCV on train split only,
evaluates once on held-out test split, and exports svm_pipeline.joblib along with evaluation plots.
"""
from pathlib import Path
import json
import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.compose import ColumnTransformer
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import GridSearchCV, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

from backend.ml.config import load_config, save_config


def train_shipped_svm():
    repo_root = Path(__file__).resolve().parents[2]
    config = load_config()

    data_path = repo_root / "dataset" / "nexusnet_features_labeled.csv"
    if not data_path.exists():
        raise FileNotFoundError(f"Labeled dataset not found at {data_path}")

    df = pd.read_csv(data_path)

    # Decision rule from Phase 3 results:
    # (QoS3, F_cause) had ROC-AUC = 0.578 (< 0.70 threshold).
    # Therefore, decision = legacy_policy
    shipped_variant = "legacy_policy"
    decision_reason = (
        "Phase 3 ablation revealed (QoS3, F_cause) achieved CV ROC-AUC of 0.578 "
        "(below the >= 0.70 threshold for cause-side failure forecasting). "
        "Per decision rule, shipping variant 'legacy_policy' (label Legacy5, features F9_current). "
        "Risk score approximates a rule-defined SLA policy; metrics reflect that the label is a "
        "function of the inputs and must not be read as failure-prediction accuracy."
    )

    print("=" * 80)
    print(f"NEXUSNET ML HARDENING — PHASE 4: FINAL SVM TRAINING")
    print(f"Shipped Variant: {shipped_variant}")
    print(f"Reason: {decision_reason}")
    print("=" * 80)

    # Update config.json with decision
    config["decision"] = {
        "shipped_variant": shipped_variant,
        "reason": decision_reason,
        "limitation_text": (
            "Risk score approximates a rule-defined SLA policy; metrics reflect that the label is a "
            "function of the inputs and must not be read as failure-prediction accuracy."
        ),
    }
    save_config(config)

    # Features and target for legacy_policy
    numeric_features = [
        "Signal_Strength_dBm",
        "Latency_ms",
        "Packet_Loss_pct",
        "Traffic_Load_pct",
        "Call_Drop_Rate_pct",
        "Resource_Utilization_pct",
        "Network_Stress_Index",
        "Signal_Quality_Score",
        "Throughput_per_User",
    ]
    target_col = "Label_Legacy5"

    X = df[numeric_features]
    y = df[target_col].values

    # Stratified 80/20 train/test split (random_state=42)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    print(f"Train samples: {len(X_train)} | Test samples: {len(X_test)}")

    # Preprocessor inside pipeline
    preprocessor = ColumnTransformer(
        transformers=[("num", StandardScaler(), numeric_features)]
    )

    # Pipeline for GridSearchCV (probability=False during search for speed)
    pipe = Pipeline([
        ("preprocessor", preprocessor),
        ("classifier", SVC(kernel="rbf", random_state=42, probability=False)),
    ])

    param_grid = {
        "classifier__C": [0.5, 1, 2, 5, 10],
        "classifier__gamma": ["scale", 0.01, 0.05, 0.1],
        "classifier__class_weight": [None, "balanced"],
    }

    print("\n[1/4] Running GridSearchCV on TRAIN split only (5-fold CV, scoring='f1')...")
    grid_search = GridSearchCV(
        estimator=pipe,
        param_grid=param_grid,
        cv=5,
        scoring="f1",
        n_jobs=-1,
        verbose=1,
    )
    grid_search.fit(X_train, y_train)

    best_params = grid_search.best_params_
    print(f"Best CV F1 score: {grid_search.best_score_:.4f}")
    print(f"Best Hyperparameters: {best_params}")

    # Extract clean classifier params
    clf_params = {k.replace("classifier__", ""): v for k, v in best_params.items()}

    # Refit the best estimator on the full TRAIN split with probability=True
    print("\n[2/4] Refitting optimal pipeline with probability=True on full training set...")
    final_pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("classifier", SVC(kernel="rbf", probability=True, random_state=42, **clf_params)),
    ])
    final_pipeline.fit(X_train, y_train)

    # Save ONE unified pipeline artifact
    models_dir = repo_root / "backend" / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    pipeline_path = models_dir / "svm_pipeline.joblib"
    joblib.dump(final_pipeline, pipeline_path)
    print(f"[Artifact Saved] Shipped SVM Pipeline saved to: {pipeline_path}")

    # Evaluate ONCE on held-out test split
    print("\n[3/4] Evaluating once on held-out test split (n=1200)...")
    y_pred = final_pipeline.predict(X_test)
    y_prob = final_pipeline.predict_proba(X_test)[:, 1]

    acc = float(accuracy_score(y_test, y_pred))
    prec = float(precision_score(y_test, y_pred))
    rec = float(recall_score(y_test, y_pred))
    f1 = float(f1_score(y_test, y_pred))
    roc_auc = float(roc_auc_score(y_test, y_prob))
    pr_auc = float(average_precision_score(y_test, y_prob))
    brier = float(brier_score_loss(y_test, y_prob))
    cm = confusion_matrix(y_test, y_pred)
    cm_list = [[int(cm[0, 0]), int(cm[0, 1])], [int(cm[1, 0]), int(cm[1, 1])]]

    print("\n" + "=" * 50)
    print("FINAL TEST EVALUATION METRICS:")
    print("=" * 50)
    print(f"Accuracy:        {acc * 100:.2f}%")
    print(f"Precision:       {prec * 100:.2f}%")
    print(f"Recall:          {rec * 100:.2f}%")
    print(f"F1 Score:        {f1 * 100:.2f}%")
    print(f"ROC-AUC:         {roc_auc * 100:.2f}%")
    print(f"PR-AUC:          {pr_auc * 100:.2f}%")
    print(f"Brier Score:     {brier:.4f}")
    print(f"Confusion Matrix: [[TN={cm[0,0]}, FP={cm[0,1]}], [FN={cm[1,0]}, TP={cm[1,1]}]]")
    print("=" * 50)

    # Save plots
    plots_dir = repo_root / "backend" / "plots"
    plots_dir.mkdir(parents=True, exist_ok=True)

    # 1. Confusion Matrix Plot
    plt.figure(figsize=(6, 5))
    sns.heatmap(
        cm,
        annot=True,
        fmt="d",
        cmap="Blues",
        xticklabels=["Normal", "At Risk"],
        yticklabels=["Normal", "At Risk"],
        cbar=False,
    )
    plt.title("NEXUSNET Shipped SVM — Confusion Matrix (Test Split)", fontsize=12, fontweight="bold", pad=10)
    plt.xlabel("Predicted Label", fontsize=10, fontweight="bold")
    plt.ylabel("Actual Label", fontsize=10, fontweight="bold")
    plt.tight_layout()
    cm_plot_path = plots_dir / "confusion_matrix_v2.png"
    plt.savefig(cm_plot_path, dpi=300)
    plt.close()
    print(f"[Plot Saved] {cm_plot_path}")

    # 2. ROC Curve Plot
    fpr, tpr, _ = roc_curve(y_test, y_prob)
    plt.figure(figsize=(6, 5))
    plt.plot(fpr, tpr, color="#2563eb", lw=2, label=f"SVM RBF (AUC = {roc_auc:.4f})")
    plt.plot([0, 1], [0, 1], color="gray", linestyle="--", alpha=0.7)
    plt.xlim([0.0, 1.0])
    plt.ylim([0.0, 1.05])
    plt.xlabel("False Positive Rate", fontsize=10, fontweight="bold")
    plt.ylabel("True Positive Rate (Recall)", fontsize=10, fontweight="bold")
    plt.title("NEXUSNET Shipped SVM — ROC Curve (Test Split)", fontsize=12, fontweight="bold", pad=10)
    plt.legend(loc="lower right")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    roc_plot_path = plots_dir / "roc_v2.png"
    plt.savefig(roc_plot_path, dpi=300)
    plt.close()
    print(f"[Plot Saved] {roc_plot_path}")

    # 3. Precision-Recall Curve Plot
    precs, recs, _ = precision_recall_curve(y_test, y_prob)
    prevalence = float(y_test.mean())
    plt.figure(figsize=(6, 5))
    plt.plot(recs, precs, color="#7c3aed", lw=2, label=f"SVM RBF (PR-AUC = {pr_auc:.4f})")
    plt.axhline(prevalence, color="gray", linestyle="--", alpha=0.7, label=f"Baseline Prevalence ({prevalence:.2f})")
    plt.xlim([0.0, 1.0])
    plt.ylim([0.0, 1.05])
    plt.xlabel("Recall", fontsize=10, fontweight="bold")
    plt.ylabel("Precision", fontsize=10, fontweight="bold")
    plt.title("NEXUSNET Shipped SVM — Precision-Recall Curve (Test Split)", fontsize=12, fontweight="bold", pad=10)
    plt.legend(loc="lower left")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    pr_plot_path = plots_dir / "pr_v2.png"
    plt.savefig(pr_plot_path, dpi=300)
    plt.close()
    print(f"[Plot Saved] {pr_plot_path}")

    metrics = {
        "accuracy": acc,
        "precision": prec,
        "recall": rec,
        "f1": f1,
        "roc_auc": roc_auc,
        "pr_auc": pr_auc,
        "brier_score": brier,
        "confusion_matrix": cm_list,
        "best_params": clf_params,
        "best_cv_f1": float(grid_search.best_score_),
    }
    return metrics


if __name__ == "__main__":
    train_shipped_svm()
