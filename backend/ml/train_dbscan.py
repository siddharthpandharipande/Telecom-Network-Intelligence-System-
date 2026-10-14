"""Phase 5: Real DBSCAN Implementation.
Fits DBSCAN on the 8 base telemetry metrics (scaled), performs an eps sweep with k-distance elbow analysis,
constructs a scorable NearestNeighbors core-point artifact, and verifies 100% noise consistency.
"""
from pathlib import Path
import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler

from backend.ml.config import load_config, save_config


def train_dbscan():
    repo_root = Path(__file__).resolve().parents[2]
    config = load_config()

    data_path = repo_root / "dataset" / "nexusnet_features_labeled.csv"
    if not data_path.exists():
        raise FileNotFoundError(f"Labeled dataset not found at {data_path}")

    df = pd.read_csv(data_path)
    base_telemetry_cols = config["telemetry_columns"]

    print("=" * 80)
    print("NEXUSNET ML HARDENING — PHASE 5: REAL DBSCAN CLUSTERING & ANOMALY DETECTION")
    print(f"Features: {base_telemetry_cols}")
    print(f"Dataset Size: {len(df)} rows")
    print("=" * 80)

    # 1. Scaling the 8 base telemetry columns
    scaler = StandardScaler()
    X = df[base_telemetry_cols].values
    X_scaled = scaler.fit_transform(X)

    min_samples = 16
    plots_dir = repo_root / "backend" / "plots"
    plots_dir.mkdir(parents=True, exist_ok=True)

    # 2. Compute k-distance graph (k = min_samples = 16)
    print("\n[1/5] Computing k-distance graph for min_samples=16...")
    nn_k = NearestNeighbors(n_neighbors=min_samples)
    nn_k.fit(X_scaled)
    distances, _ = nn_k.kneighbors(X_scaled)
    k_distances = np.sort(distances[:, -1])  # Distance to 16th nearest neighbor

    kdist_path = plots_dir / "dbscan_kdistance.png"
    plt.figure(figsize=(7, 5))
    plt.plot(k_distances, color="#0284c7", lw=2)
    plt.title("NEXUSNET DBSCAN — k-Distance Graph (k=16)", fontsize=12, fontweight="bold", pad=10)
    plt.xlabel("Points sorted by 16-NN distance", fontsize=10, fontweight="bold")
    plt.ylabel("16-NN Distance (eps candidate)", fontsize=10, fontweight="bold")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(kdist_path, dpi=300)
    plt.close()
    print(f"[Plot Saved] k-distance graph saved to: {kdist_path}")

    # 3. Sweep eps from 0.3 to 2.5
    print("\n[2/5] Running eps grid sweep...")
    sweep_results = []
    eps_grid = np.arange(0.3, 2.6, 0.1)

    for eps_val in eps_grid:
        eps_rounded = round(float(eps_val), 2)
        db = DBSCAN(eps=eps_rounded, min_samples=min_samples).fit(X_scaled)
        labels = db.labels_
        n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
        n_noise = int(np.sum(labels == -1))
        noise_pct = round((n_noise / len(labels)) * 100, 2)
        sweep_results.append({
            "eps": eps_rounded,
            "min_samples": min_samples,
            "n_clusters": n_clusters,
            "n_noise": n_noise,
            "noise_pct": noise_pct,
        })
        print(f"  eps={eps_rounded:<4} | n_clusters={n_clusters:<4} | noise={n_noise:<4} ({noise_pct:.2f}%)")

    sweep_df = pd.DataFrame(sweep_results)

    # 4. Select optimal eps near elbow where noise is between 2% and 8%
    # If multiple, select the one with best cluster cohesion
    valid_eps = sweep_df[(sweep_df["noise_pct"] >= 2.0) & (sweep_df["noise_pct"] <= 8.0)]
    if not valid_eps.empty:
        # Choose median candidate in target window
        chosen_row = valid_eps.iloc[len(valid_eps) // 2]
    else:
        # Pick the closest to 5% noise
        chosen_row = sweep_df.iloc[(sweep_df["noise_pct"] - 5.0).abs().argmin()]

    chosen_eps = float(chosen_row["eps"])
    chosen_noise_pct = float(chosen_row["noise_pct"])
    chosen_clusters = int(chosen_row["n_clusters"])

    print(f"\n[3/5] Selected optimal eps={chosen_eps} (min_samples={min_samples})")
    print(f"      Clusters: {chosen_clusters} | Noise: {chosen_noise_pct}%")

    # 5. Fit final DBSCAN with chosen eps
    final_dbscan = DBSCAN(eps=chosen_eps, min_samples=min_samples).fit(X_scaled)
    final_labels = final_dbscan.labels_

    core_indices = final_dbscan.core_sample_indices_
    core_points = X_scaled[core_indices]
    core_labels = final_labels[core_indices]

    print(f"\n[4/5] Building Scorable Artifact...")
    print(f"      Total Core Points: {len(core_indices)} out of {len(X_scaled)}")

    # Fit NearestNeighbors(1) on core points for O(1) inference
    core_nn = NearestNeighbors(n_neighbors=1).fit(core_points)

    dbscan_artifact = {
        "scaler": scaler,
        "features": base_telemetry_cols,
        "eps": chosen_eps,
        "min_samples": min_samples,
        "core_points": core_points,
        "core_labels": core_labels,
        "core_nn": core_nn,
        "n_clusters": chosen_clusters,
        "noise_pct": chosen_noise_pct,
    }

    models_dir = repo_root / "backend" / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    artifact_path = models_dir / "dbscan_artifact.joblib"
    joblib.dump(dbscan_artifact, artifact_path)
    print(f"[Artifact Saved] DBSCAN scorable artifact saved to: {artifact_path}")

    # 6. VERIFY: Applying inference rule to all 6,000 rows reproduces noise/non-noise 100%
    print("\n[5/5] Verifying 100% anomaly reproduction on training data...")
    # Scoring rule: find nearest core point; if dist <= eps -> inlier (cluster of nearest core), else anomaly (-1)
    nn_dists, nn_idx = core_nn.kneighbors(X_scaled)
    nn_dists = nn_dists.flatten()
    nn_idx = nn_idx.flatten()

    predicted_clusters = np.where(nn_dists <= chosen_eps, core_labels[nn_idx], -1)
    is_anomaly_pred = (predicted_clusters == -1)
    is_anomaly_true = (final_labels == -1)

    match_count = np.sum(is_anomaly_pred == is_anomaly_true)
    accuracy_anomaly = match_count / len(final_labels)
    print(f"      Anomaly Label Agreement: {match_count} / {len(final_labels)} ({accuracy_anomaly * 100:.2f}%)")
    assert accuracy_anomaly == 1.0, f"Verification failed! Only {accuracy_anomaly * 100:.2f}% matched."
    print("      [+] VERIFIED: Inference rule strictly reproduces 100% of DBSCAN anomaly assignments!")

    # 7. Update config.json with chosen dbscan parameters
    config["dbscan"]["eps"] = chosen_eps
    config["dbscan"]["min_samples"] = min_samples
    save_config(config)

    # 8. Compute 2x2 cross-tab (is_at_risk x is_anomaly) over all 6,000 rows using shipped SVM
    svm_pipeline_path = models_dir / "svm_pipeline.joblib"
    if svm_pipeline_path.exists():
        svm_pipe = joblib.load(svm_pipeline_path)
        svm_pred = svm_pipe.predict(df[config["svm_features"]["numeric"]])
        is_at_risk = (svm_pred == 1)

        ct = pd.crosstab(
            pd.Series(is_at_risk, name="SVM_At_Risk"),
            pd.Series(is_anomaly_true, name="DBSCAN_Anomaly"),
            margins=True,
        )
        print("\n" + "=" * 50)
        print("2x2 CROSS-TAB: SVM Risk vs DBSCAN Anomaly (n=6000)")
        print("=" * 50)
        print(ct)
        print("=" * 50)
        cross_tab_dict = ct.to_dict()
    else:
        cross_tab_dict = {}

    return {
        "eps": chosen_eps,
        "min_samples": min_samples,
        "n_clusters": chosen_clusters,
        "noise_pct": chosen_noise_pct,
        "sweep_table": sweep_results,
        "cross_tab": cross_tab_dict,
    }


if __name__ == "__main__":
    train_dbscan()
