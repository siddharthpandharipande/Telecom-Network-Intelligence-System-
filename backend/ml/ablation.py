"""Phase 3: Leakage Ablation Study.
Runs 5-fold StratifiedKFold cross-validation on the full labeled dataset across 3 feature/label experiments
and 4 model families using strict leak-free sklearn Pipelines.
"""
from pathlib import Path
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier

from backend.ml.config import load_config


def build_pipeline(numeric_cols, categorical_cols, model):
    transformers = []
    if numeric_cols:
        transformers.append(("num", StandardScaler(), numeric_cols))
    if categorical_cols:
        transformers.append(
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                categorical_cols,
            )
        )
    preprocessor = ColumnTransformer(transformers=transformers)
    return Pipeline([("preprocessor", preprocessor), ("classifier", model)])


def run_ablation():
    config = load_config()
    repo_root = Path(__file__).resolve().parents[2]
    data_path = repo_root / "dataset" / "nexusnet_features_labeled.csv"
    if not data_path.exists():
        raise FileNotFoundError(f"Labeled dataset not found at {data_path}")

    df = pd.read_csv(data_path)
    n_samples = len(df)

    print("=" * 80)
    print("NEXUSNET ML HARDENING — PHASE 3: LEAKAGE ABLATION STUDY")
    print(f"Total Dataset Rows: {n_samples}")
    print("=" * 80)

    # Label prevalence
    legacy_prev = df["Label_Legacy5"].mean()
    qos3_prev = df["Label_QoS3"].mean()
    print(f"Label_Legacy5 Prevalence: {legacy_prev * 100:.2f}% ({df['Label_Legacy5'].sum()} / {n_samples})")
    print(f"Label_QoS3 Prevalence:    {qos3_prev * 100:.2f}% ({df['Label_QoS3'].sum()} / {n_samples})\n")

    # Feature sets definition
    feature_sets = {
        "F9_current": {
            "num": [
                "Signal_Strength_dBm",
                "Latency_ms",
                "Packet_Loss_pct",
                "Traffic_Load_pct",
                "Call_Drop_Rate_pct",
                "Resource_Utilization_pct",
                "Network_Stress_Index",
                "Signal_Quality_Score",
                "Throughput_per_User",
            ],
            "cat": [],
        },
        "F_noderived": {
            "num": [
                "Signal_Strength_dBm",
                "Latency_ms",
                "Packet_Loss_pct",
                "Throughput_Mbps",
                "Connected_Users",
                "Traffic_Load_pct",
                "Call_Drop_Rate_pct",
                "Resource_Utilization_pct",
                "Peak_Hour",
            ],
            "cat": [],
        },
        "F_cause": {
            "num": [
                "Signal_Strength_dBm",
                "Traffic_Load_pct",
                "Resource_Utilization_pct",
                "Connected_Users",
                "Throughput_Mbps",
                "Peak_Hour",
            ],
            "cat": ["Asset_Type"],
        },
    }

    experiments = [
        {"exp_name": "Exp1: (Legacy5, F9_current)", "label_col": "Label_Legacy5", "features_key": "F9_current"},
        {"exp_name": "Exp2: (QoS3, F_noderived)", "label_col": "Label_QoS3", "features_key": "F_noderived"},
        {"exp_name": "Exp3: (QoS3, F_cause)", "label_col": "Label_QoS3", "features_key": "F_cause"},
    ]

    models = {
        "SVM (RBF)": lambda: SVC(kernel="rbf", class_weight="balanced", probability=True, random_state=42),
        "Decision Tree (d=3)": lambda: DecisionTreeClassifier(max_depth=3, random_state=42),
        "Logistic Regression": lambda: LogisticRegression(max_iter=1000, random_state=42),
        "Dummy (Stratified)": lambda: DummyClassifier(strategy="stratified", random_state=42),
    }

    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    results = []

    for exp in experiments:
        exp_name = exp["exp_name"]
        label_col = exp["label_col"]
        fkey = exp["features_key"]
        num_cols = feature_sets[fkey]["num"]
        cat_cols = feature_sets[fkey]["cat"]
        all_cols = num_cols + cat_cols

        X = df[all_cols]
        y = df[label_col].values
        prevalence = y.mean()

        print(f"\n--- Running {exp_name} (Features: {len(all_cols)}, Target: {label_col}) ---")

        for m_name, model_fn in models.items():
            fold_metrics = {"acc": [], "prec": [], "rec": [], "f1": [], "roc_auc": [], "pr_auc": []}

            for train_idx, val_idx in skf.split(X, y):
                X_train, X_val = X.iloc[train_idx], X.iloc[val_idx]
                y_train, y_val = y[train_idx], y[val_idx]

                pipe = build_pipeline(num_cols, cat_cols, model_fn())
                pipe.fit(X_train, y_train)

                y_pred = pipe.predict(X_val)
                # Compute probability for positive class
                if hasattr(pipe, "predict_proba"):
                    y_prob = pipe.predict_proba(X_val)[:, 1]
                elif hasattr(pipe, "decision_function"):
                    y_prob = pipe.decision_function(X_val)
                else:
                    y_prob = y_pred

                fold_metrics["acc"].append(accuracy_score(y_val, y_pred))
                fold_metrics["prec"].append(precision_score(y_val, y_pred, zero_division=0))
                fold_metrics["rec"].append(recall_score(y_val, y_pred, zero_division=0))
                fold_metrics["f1"].append(f1_score(y_val, y_pred, zero_division=0))
                fold_metrics["roc_auc"].append(roc_auc_score(y_val, y_prob))
                fold_metrics["pr_auc"].append(average_precision_score(y_val, y_prob))

            row = {
                "experiment": exp_name,
                "label": label_col,
                "features": fkey,
                "model": m_name,
                "prevalence": round(prevalence, 4),
                "acc_mean": round(float(np.mean(fold_metrics["acc"])), 4),
                "acc_std": round(float(np.std(fold_metrics["acc"])), 4),
                "prec_mean": round(float(np.mean(fold_metrics["prec"])), 4),
                "prec_std": round(float(np.std(fold_metrics["prec"])), 4),
                "rec_mean": round(float(np.mean(fold_metrics["rec"])), 4),
                "rec_std": round(float(np.std(fold_metrics["rec"])), 4),
                "f1_mean": round(float(np.mean(fold_metrics["f1"])), 4),
                "f1_std": round(float(np.std(fold_metrics["f1"])), 4),
                "roc_auc_mean": round(float(np.mean(fold_metrics["roc_auc"])), 4),
                "roc_auc_std": round(float(np.std(fold_metrics["roc_auc"])), 4),
                "pr_auc_mean": round(float(np.mean(fold_metrics["pr_auc"])), 4),
                "pr_auc_std": round(float(np.std(fold_metrics["pr_auc"])), 4),
            }
            results.append(row)
            print(
                f"  [{m_name:<20}] Accuracy: {row['acc_mean']:.3f}±{row['acc_std']:.3f} | "
                f"F1: {row['f1_mean']:.3f}±{row['f1_std']:.3f} | "
                f"ROC-AUC: {row['roc_auc_mean']:.3f}±{row['roc_auc_std']:.3f} | "
                f"PR-AUC: {row['pr_auc_mean']:.3f}±{row['pr_auc_std']:.3f}"
            )

    results_df = pd.DataFrame(results)

    # Save results CSV
    models_dir = repo_root / "backend" / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    out_csv = models_dir / "ablation_results.csv"
    results_df.to_csv(out_csv, index=False)
    print(f"\n[Artifact Saved] Ablation results saved to: {out_csv}")

    # Save visual plot
    plots_dir = repo_root / "backend" / "plots"
    plots_dir.mkdir(parents=True, exist_ok=True)
    out_png = plots_dir / "ablation_v2.png"

    plt.figure(figsize=(12, 6))
    palette = sns.color_palette("Set2", n_colors=len(models))
    ax = sns.barplot(
        data=results_df,
        x="experiment",
        y="roc_auc_mean",
        hue="model",
        palette=palette,
        edgecolor="black",
        linewidth=0.8,
    )
    plt.title("NEXUSNET Leakage Ablation Study — ROC-AUC Comparison Across Setups", fontsize=14, fontweight="bold", pad=12)
    plt.xlabel("Experiment Setup", fontsize=11, fontweight="bold")
    plt.ylabel("Mean 5-Fold ROC-AUC", fontsize=11, fontweight="bold")
    plt.ylim(0.4, 1.02)
    plt.axhline(0.5, color="gray", linestyle="--", alpha=0.7, label="Chance Level (0.50)")
    plt.legend(title="Model Family", bbox_to_anchor=(1.02, 1), loc="upper left")
    plt.tight_layout()
    plt.savefig(out_png, dpi=300)
    plt.close()
    print(f"[Plot Saved] Ablation comparison plot saved to: {out_png}")

    return results_df


if __name__ == "__main__":
    run_ablation()
