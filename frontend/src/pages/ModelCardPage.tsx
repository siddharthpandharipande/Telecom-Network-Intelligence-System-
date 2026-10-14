import React, { useState, useEffect } from 'react';
import {
  FileText,
  Brain,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Database,
  Sliders,
  Shield,
  Activity,
  Calendar,
  RefreshCw,
  Info,
} from 'lucide-react';
import { getModelCard, getConfig } from '../api/client';
import { ModelCard, SystemConfig } from '../types/api';

export const ModelCardPage: React.FC = () => {
  const [modelCard, setModelCard] = useState<ModelCard | null>(null);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([getModelCard(), getConfig()])
      .then(([mc, cfg]) => {
        if (active) {
          setModelCard(mc);
          setConfig(cfg);
        }
      })
      .catch((err) => {
        if (active) setError(err.message || 'Failed to load Model Card data');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 font-sans">
        <RefreshCw size={24} className="animate-spin inline-block mr-2 text-blue-500" />
        <span>Loading production Model Card specifications...</span>
      </div>
    );
  }

  if (error || !modelCard) {
    return (
      <div className="p-8 text-center text-red-500 font-sans space-y-2">
        <AlertTriangle size={24} className="inline-block" />
        <div>{error || 'Model Card information not available from backend'}</div>
      </div>
    );
  }

  const { svm, label, dataset, decision, ablation, dbscan, limitations } = modelCard;

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto font-sans pb-16">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-500 uppercase tracking-wider mb-1">
              <FileText size={16} />
              <span>Machine Learning Documentation</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              NEXUSNET Model Card & Architecture Audit
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
              Formal specifications, evaluation benchmarks, ablation experiments, hyperparameter sweeps, and architectural limitations for the deployed Supervised SVM and Unsupervised DBSCAN models.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-xs font-mono font-semibold">
              Version: {modelCard.model_version}
            </span>
          </div>
        </div>
      </div>

      {/* Section 1: Dataset Provenance & Note */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
          <Database size={18} className="text-blue-500" />
          <span>1. Dataset Provenance & Snapshot Context</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 text-[11px] block">Dataset Nature</span>
            <span className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-1 block">
              Synthetic (Single-Day Snapshot)
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Original generator lost</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 text-[11px] block">Total Asset Rows</span>
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono block">
              {dataset.rows.toLocaleString()} assets (1 row per asset)
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">No continuous multi-day history</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 text-[11px] block">Time Window Covered</span>
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono block">
              {dataset.date_range}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Hours 00:00 to 23:00 local time</span>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300">
          ⚠️ <strong>Dataset Note:</strong> The dataset is a synthetic single-day collection of 6,000 telecommunications assets. There are no multi-day historical trends or real-world subscriber PII. All evaluations represent performance on this snapshot.
        </div>
      </div>

      {/* Section 2: Ground Truth Label Definition & Prevalence */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
          <Shield size={18} className="text-red-500" />
          <span>2. Operational Label Policy & Prevalence ({label.name})</span>
        </h2>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          The classification target distinguishes <strong>Normal Operating</strong> nodes from nodes with an <strong>At Risk of Service Degradation</strong> status based on a composite 5-clause SLA operational boundary.
        </p>

        {/* 5 Clauses Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-500">
                <th className="p-3 font-semibold">Clause #</th>
                <th className="p-3 font-semibold">Telemetry Metric</th>
                <th className="p-3 font-semibold">Operator</th>
                <th className="p-3 font-semibold">Threshold Limit</th>
                <th className="p-3 font-semibold">Breach Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-800">
              {label.clauses.map((c, i) => (
                <tr key={i}>
                  <td className="p-3 font-mono font-bold text-slate-500">Clause {i + 1}</td>
                  <td className="p-3 font-mono font-semibold text-blue-500">{c.metric}</td>
                  <td className="p-3 font-mono text-center font-bold">{c.op}</td>
                  <td className="p-3 font-mono font-bold text-red-500">{c.limit}</td>
                  <td className="p-3 text-slate-600 dark:text-slate-300">{c.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Prevalence */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 text-[11px] block">Normal Class Prevalence</span>
            <span className="text-base font-bold text-emerald-500 font-mono mt-0.5 block">
              {label.prevalence.Normal.toLocaleString()} ({label.prevalence.Normal_pct}%)
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 text-[11px] block">At Risk Class Prevalence</span>
            <span className="text-base font-bold text-red-500 font-mono mt-0.5 block">
              {label.prevalence.At_Risk.toLocaleString()} ({label.prevalence.At_Risk_pct}%)
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 text-[11px] block">Class Imbalance</span>
            <span className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5 block">
              Balanced (1.15:1)
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 text-[11px] block">Shipped Decision</span>
            <span className="text-xs font-semibold text-blue-500 mt-1 block">
              {decision.shipped_variant}
            </span>
          </div>
        </div>
      </div>

      {/* Section 3: Deployed SVM Architecture & Test Benchmarks */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
          <Brain size={18} className="text-blue-500" />
          <span>3. Deployed SVM Pipeline Architecture & Test Split Evaluation</span>
        </h2>

        {/* Hyperparameters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 text-[11px] block">Kernel</span>
            <span className="font-bold font-mono text-slate-900 dark:text-slate-100 uppercase">
              {svm.best_params.kernel} (RBF)
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 text-[11px] block">Regularization (C)</span>
            <span className="font-bold font-mono text-slate-900 dark:text-slate-100">
              C = {svm.best_params.C}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 text-[11px] block">Kernel Coefficient (gamma)</span>
            <span className="font-bold font-mono text-slate-900 dark:text-slate-100">
              gamma = {svm.best_params.gamma}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 text-[11px] block">Class Weighting</span>
            <span className="font-bold font-mono text-slate-900 dark:text-slate-100 capitalize">
              {svm.best_params.class_weight}
            </span>
          </div>
        </div>

        {/* Test Evaluation Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs pt-1">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 text-[11px] block">Accuracy</span>
            <span className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100">
              {(svm.test_metrics.accuracy * 100).toFixed(2)}%
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 text-[11px] block">Precision</span>
            <span className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100">
              {(svm.test_metrics.precision * 100).toFixed(2)}%
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 text-[11px] block">Recall</span>
            <span className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100">
              {(svm.test_metrics.recall * 100).toFixed(2)}%
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 text-[11px] block">F1 Score</span>
            <span className="text-lg font-bold font-mono text-emerald-500">
              {(svm.test_metrics.f1 * 100).toFixed(2)}%
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 text-[11px] block">ROC-AUC</span>
            <span className="text-lg font-bold font-mono text-blue-500">
              {svm.test_metrics.roc_auc.toFixed(4)}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 text-[11px] block">Brier Score</span>
            <span className="text-lg font-bold font-mono text-purple-500">
              {svm.test_metrics.brier_score.toFixed(4)}
            </span>
          </div>
        </div>

        {/* Confusion Matrix Table */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-3">
          <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 block">
            Test Confusion Matrix (1,200 Held-Out Samples)
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <span className="text-emerald-700 dark:text-emerald-400 text-[11px] block font-semibold">True Negatives (TN)</span>
              <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">
                {svm.confusion_matrix.tn}
              </span>
              <span className="text-[10px] text-slate-500">Correctly identified Normal</span>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <span className="text-amber-700 dark:text-amber-400 text-[11px] block font-semibold">False Positives (FP)</span>
              <span className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1 block">
                {svm.confusion_matrix.fp}
              </span>
              <span className="text-[10px] text-slate-500">False degradation alarm</span>
            </div>
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <span className="text-red-700 dark:text-red-400 text-[11px] block font-semibold">False Negatives (FN)</span>
              <span className="text-xl font-bold font-mono text-red-600 dark:text-red-400 mt-1 block">
                {svm.confusion_matrix.fn}
              </span>
              <span className="text-[10px] text-slate-500">Missed degradation alert</span>
            </div>
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <span className="text-blue-700 dark:text-blue-400 text-[11px] block font-semibold">True Positives (TP)</span>
              <span className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1 block">
                {svm.confusion_matrix.tp}
              </span>
              <span className="text-[10px] text-slate-500">Correctly flagged At Risk</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Full Multi-Experiment Ablation Table */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="border-b border-slate-200 dark:border-slate-700 pb-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Layers size={18} className="text-purple-500" />
            <span>4. Model Ablation Benchmarks (12 Experimental Conditions)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cross-validated 5-fold evaluation comparing SVM (RBF) against Decision Tree, Logistic Regression, and Dummy baseline across 3 feature/label policies
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="p-2.5">Experiment</th>
                <th className="p-2.5">Model</th>
                <th className="p-2.5">Accuracy</th>
                <th className="p-2.5">Precision</th>
                <th className="p-2.5">Recall</th>
                <th className="p-2.5">F1 Score</th>
                <th className="p-2.5">ROC-AUC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-mono text-[11px] bg-white dark:bg-slate-800">
              {ablation.map((row, idx) => (
                <tr
                  key={idx}
                  className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 ${
                    row.model.includes('SVM') && row.experiment.includes('Legacy5')
                      ? 'bg-blue-50/50 dark:bg-blue-900/20 font-semibold'
                      : ''
                  }`}
                >
                  <td className="p-2.5 text-slate-700 dark:text-slate-300 font-sans">{row.experiment}</td>
                  <td className="p-2.5 text-slate-900 dark:text-slate-100 font-sans font-medium">
                    {row.model}
                    {row.model.includes('SVM') && row.experiment.includes('Legacy5') && (
                      <span className="ml-1.5 px-1.5 py-0.2 rounded bg-blue-500 text-white text-[10px] font-sans">
                        Shipped
                      </span>
                    )}
                  </td>
                  <td className="p-2.5">{(row.acc_mean * 100).toFixed(2)}%</td>
                  <td className="p-2.5">{(row.prec_mean * 100).toFixed(2)}%</td>
                  <td className="p-2.5">{(row.rec_mean * 100).toFixed(2)}%</td>
                  <td className="p-2.5 font-bold text-emerald-600 dark:text-emerald-400">
                    {(row.f1_mean * 100).toFixed(2)}%
                  </td>
                  <td className="p-2.5 text-blue-500">{row.roc_auc_mean.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 5: DBSCAN Parameters & Sweep Sensitivity */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
          <Activity size={18} className="text-purple-500" />
          <span>5. DBSCAN Anomaly Clustering Parameters & Epsilon Sweep</span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 text-[11px] block">Epsilon (eps)</span>
            <span className="text-base font-bold font-mono text-purple-600 dark:text-purple-400 block mt-0.5">
              {dbscan.eps}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 text-[11px] block">Min Samples (min_samples)</span>
            <span className="text-base font-bold font-mono text-slate-900 dark:text-slate-100 block mt-0.5">
              {dbscan.min_samples}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 text-[11px] block">Identified Clusters</span>
            <span className="text-base font-bold font-mono text-slate-900 dark:text-slate-100 block mt-0.5">
              {dbscan.n_clusters} clusters
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 text-[11px] block">Noise Outlier Ratio</span>
            <span className="text-base font-bold font-mono text-red-500 block mt-0.5">
              {dbscan.noise_count} ({dbscan.noise_pct}%)
            </span>
          </div>
        </div>

        {/* Sweep table excerpt */}
        <div className="space-y-2 pt-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
            Epsilon Sensitivity Sweep (min_samples = 16):
          </span>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-500 text-[11px]">
                  <th className="p-2 font-semibold">Eps</th>
                  <th className="p-2 font-semibold">MinPts</th>
                  <th className="p-2 font-semibold">Clusters Found</th>
                  <th className="p-2 font-semibold">Noise Outliers</th>
                  <th className="p-2 font-semibold">Noise Share</th>
                  <th className="p-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-mono text-[11px] bg-white dark:bg-slate-800">
                {dbscan.sweep_table.map((row, i) => (
                  <tr
                    key={i}
                    className={row.eps === dbscan.eps ? 'bg-purple-50 dark:bg-purple-900/20 font-bold' : ''}
                  >
                    <td className="p-2">{row.eps.toFixed(2)}</td>
                    <td className="p-2">{row.min_samples}</td>
                    <td className="p-2">{row.n_clusters}</td>
                    <td className="p-2">{row.n_noise}</td>
                    <td className="p-2">{row.noise_pct.toFixed(2)}%</td>
                    <td className="p-2 font-sans font-semibold">
                      {row.eps === dbscan.eps ? (
                        <span className="px-2 py-0.5 rounded bg-purple-600 text-white text-[10px]">
                          Shipped Operational
                        </span>
                      ) : row.noise_pct > 50 ? (
                        <span className="text-slate-400">Under-clustered</span>
                      ) : row.noise_pct < 1 ? (
                        <span className="text-slate-400">Over-clustered</span>
                      ) : (
                        <span className="text-slate-500">Plausible</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Section 6: Limitations & Boundaries */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
          <AlertTriangle size={18} className="text-amber-500" />
          <span>6. Formal Model Limitations & Operational Caveats</span>
        </h2>

        <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
          {limitations.map((lim, i) => (
            <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="leading-relaxed">{lim}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
