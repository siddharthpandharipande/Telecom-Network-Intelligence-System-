import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Brain,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  MapPin,
  Activity,
  Layers,
  AlertTriangle,
  RefreshCw,
  Search,
  Sliders,
  Check,
} from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';
import { useTelemetry } from '../context/TelemetryContext';
import { useConfig, useApiStatus, getStatusStyle } from '../api/hooks';
import { getModelCard, getStatsOverview, getAssetDetail, getAssets } from '../api/client';
import { ModelCard, StatsOverview, AssetDetail, Reading } from '../types/api';

const RISK_DISTRIBUTION_COLORS = {
  normal: '#10b981',
  atRisk: '#ef4444',
};

export const SVMPrediction: React.FC = () => {
  const navigate = useNavigate();
  const { config } = useConfig();
  const { isOnline } = useApiStatus();
  const { createIncident } = useTelemetry();

  const [modelCard, setModelCard] = useState<ModelCard | null>(null);
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Asset Inspection State
  const [inspectedAssetId, setInspectedAssetId] = useState<string>('MH-PN-SHIV-901');
  const [assetSearchInput, setAssetSearchInput] = useState<string>('');
  const [inspectedDetail, setInspectedDetail] = useState<AssetDetail | null>(null);
  const [loadingAsset, setLoadingAsset] = useState<boolean>(false);
  const [assetError, setAssetError] = useState<string | null>(null);

  // At-Risk Assets Table
  const [atRiskList, setAtRiskList] = useState<Reading[]>([]);
  const [atRiskTotal, setAtRiskTotal] = useState<number>(0);
  const [atRiskPage, setAtRiskPage] = useState<number>(1);
  const [loadingTable, setLoadingTable] = useState<boolean>(false);

  // Load Model Card & Overview
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mc, st] = await Promise.all([getModelCard(), getStatsOverview()]);
      setModelCard(mc);
      setStats(st);
    } catch (err: any) {
      setError(err.message || 'Failed to load SVM model diagnostics from backend');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load Inspected Asset Detail
  const loadAsset = useCallback(async (id: string) => {
    if (!id.trim()) return;
    setLoadingAsset(true);
    setAssetError(null);
    try {
      const detail = await getAssetDetail(id.trim());
      setInspectedDetail(detail);
      setInspectedAssetId(id.trim());
    } catch (err: any) {
      setAssetError(err.message || `Could not find asset "${id}" in database`);
    } finally {
      setLoadingAsset(false);
    }
  }, []);

  // Initial asset inspection
  useEffect(() => {
    loadAsset(inspectedAssetId);
  }, []);

  // Load At-Risk Assets list
  const loadAtRiskAssets = useCallback(async () => {
    setLoadingTable(true);
    try {
      const res = await getAssets({ is_at_risk: true, page: atRiskPage, page_size: 6 });
      setAtRiskList(res.items);
      setAtRiskTotal(res.total);
    } catch (err: any) {
      console.error('Failed to load at-risk assets:', err);
    } finally {
      setLoadingTable(false);
    }
  }, [atRiskPage]);

  useEffect(() => {
    loadAtRiskAssets();
  }, [loadAtRiskAssets]);

  // Risk Distribution data for Donut
  const normalCount = stats?.risk_counts?.normal ?? 0;
  const atRiskCount = stats?.risk_counts?.at_risk ?? 0;
  const totalCount = normalCount + atRiskCount;
  const normalPct = totalCount > 0 ? ((normalCount / totalCount) * 100).toFixed(1) : '0';
  const atRiskPct = totalCount > 0 ? ((atRiskCount / totalCount) * 100).toFixed(1) : '0';

  const riskDonutData = [
    { name: 'Normal Operating', value: normalCount, color: RISK_DISTRIBUTION_COLORS.normal },
    { name: 'Predicted At Risk', value: atRiskCount, color: RISK_DISTRIBUTION_COLORS.atRisk },
  ];

  const svmMetrics = modelCard?.svm?.test_metrics;
  const confMatrix = modelCard?.svm?.confusion_matrix;
  const bestParams = modelCard?.svm?.best_params;
  const latestReading = inspectedDetail?.latest;

  return (
    <div className="p-6 space-y-6 font-sans">
      {/* Header with AI Model Sub-Navigation Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <Brain size={24} className="text-blue-500" />
            <span>SVM Risk Classification & Model Diagnostics</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Supervised Support Vector Machine pipeline evaluating telecommunications risk scores and SLA degradation boundaries.
          </p>
        </div>

        {/* Model Switcher Tabs */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => navigate('/svm')}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white shadow-sm transition-all flex items-center gap-2"
          >
            <Brain size={14} />
            <span>SVM Risk Prediction</span>
          </button>
          <button
            onClick={() => navigate('/dbscan')}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-all flex items-center gap-2"
          >
            <Activity size={14} />
            <span>DBSCAN Anomaly Detection</span>
          </button>
        </div>
      </div>

      {/* Model Architecture & Baseline Metadata Banner */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs shadow-sm">
        <div>
          <div className="text-slate-500 text-[11px]">Deployed Model Version</div>
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5 font-mono">
            {modelCard?.model_version || config?.version || '2.0.0'}
          </div>
        </div>
        <div>
          <div className="text-slate-500 text-[11px]">Classification Target</div>
          <div className="text-sm font-bold text-blue-500 mt-0.5">
            {config?.label?.name ? `${config.label.name} (Normal vs At Risk)` : 'Normal vs At Risk'}
          </div>
        </div>
        <div>
          <div className="text-slate-500 text-[11px]">Test Accuracy (Held-Out)</div>
          <div className="text-sm font-bold text-emerald-500 mt-0.5">
            {svmMetrics ? `${(svmMetrics.accuracy * 100).toFixed(2)}%` : 'Loading...'}
          </div>
        </div>
        <div>
          <div className="text-slate-500 text-[11px]">Total Dataset Population</div>
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5 font-mono">
            {stats ? `${stats.total_assets.toLocaleString()} records` : '6,000 records'}
          </div>
        </div>
      </div>

      {/* Main Grid: Per-Asset Inspector + Donut Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Selected Asset Diagnostic Assessment */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-4 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-xs font-semibold">
                  Asset Diagnostic Assessment
                </span>
                <span className="text-xs text-slate-500">
                  {inspectedDetail?.asset.city ? `${inspectedDetail.asset.city}, ` : ''}
                  {inspectedDetail?.asset.country || ''}
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
                {inspectedAssetId} ({inspectedDetail?.asset.asset_type || 'Asset'})
              </h2>
            </div>

            {/* Asset Search Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                loadAsset(assetSearchInput);
              }}
              className="flex items-center gap-2"
            >
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={assetSearchInput}
                  onChange={(e) => setAssetSearchInput(e.target.value)}
                  placeholder="Inspect Asset ID..."
                  className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 w-44"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors"
              >
                Inspect
              </button>
            </form>
          </div>

          {loadingAsset ? (
            <div className="p-8 text-center text-slate-500">
              <RefreshCw size={20} className="animate-spin inline-block mr-2" />
              Loading telemetry diagnostic for {inspectedAssetId}...
            </div>
          ) : assetError ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>{assetError}</span>
            </div>
          ) : latestReading ? (
            <>
              {/* Output Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <div className="text-slate-500 text-[11px]">SVM Predicted Class</div>
                  <div
                    className={`text-base font-bold mt-1 flex items-center gap-1.5 ${
                      latestReading.is_at_risk ? 'text-red-500' : 'text-emerald-500'
                    }`}
                  >
                    {latestReading.is_at_risk ? <ShieldAlert size={16} /> : <CheckCircle2 size={16} />}
                    <span>{latestReading.risk_label}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <div className="text-slate-500 text-[11px]">Risk Score (Probability)</div>
                  <div
                    className={`text-base font-bold mt-1 font-mono ${
                      latestReading.is_at_risk ? 'text-red-500' : 'text-emerald-500'
                    }`}
                  >
                    {(latestReading.risk_score * 100).toFixed(1)}%
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <div className="text-slate-500 text-[11px]">Network Stress Index</div>
                  <div className="text-base font-bold mt-1 text-slate-900 dark:text-slate-100 font-mono">
                    {latestReading.network_stress_index?.toFixed(1) ?? 'N/A'}%
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <div className="text-slate-500 text-[11px]">Signal Quality Score</div>
                  <div className="text-base font-bold mt-1 text-blue-500 font-mono">
                    {latestReading.signal_quality_score?.toFixed(1) ?? 'N/A'}
                  </div>
                </div>
              </div>

              {/* Threshold breaches (rule-based) */}
              <div className="space-y-2 pt-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                  Threshold Breaches (Rule-Based Definition):
                </span>
                {latestReading.threshold_breaches?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {latestReading.threshold_breaches.map((b, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-mono"
                      >
                        <div className="font-semibold">{b.message}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Limit: {b.limit} {b.operator} Observed: {b.value}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs">
                    ✓ All operational metrics within compliant bounds. No threshold breaches detected.
                  </div>
                )}
              </div>

              {/* Telemetry Inputs */}
              <div className="space-y-2 pt-1">
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Evaluated Telemetry Inputs
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] text-slate-500 block">Latency</span>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
                      {latestReading.latency_ms.toFixed(1)} ms
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] text-slate-500 block">Packet Loss</span>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
                      {latestReading.packet_loss_pct.toFixed(2)}%
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] text-slate-500 block">Traffic Load</span>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
                      {latestReading.traffic_load_pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] text-slate-500 block">Throughput</span>
                    <span className="text-xs font-bold text-blue-500 font-mono">
                      {latestReading.throughput_mbps.toFixed(1)} Mbps
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] text-slate-500 block">Connected Users</span>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
                      {latestReading.connected_users.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] text-slate-500 block">Signal Strength</span>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
                      {latestReading.signal_strength_dbm.toFixed(1)} dBm
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => navigate(`/map?asset=${encodeURIComponent(latestReading.asset_id)}`)}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <MapPin size={14} />
                  <span>Locate Node on Map</span>
                </button>
                <button
                  onClick={() => navigate('/dbscan')}
                  className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors flex items-center gap-1.5 border border-slate-300 dark:border-slate-700"
                >
                  <span>DBSCAN Anomaly View</span>
                  <ArrowRight size={14} />
                </button>
                {latestReading.is_at_risk && (
                  <button
                    disabled={!isOnline}
                    onClick={async () => {
                      await createIncident(latestReading.asset_id);
                      navigate('/incidents');
                    }}
                    className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <ShieldAlert size={14} />
                    <span>Create Incident</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-slate-400">Search for an asset ID above to view its SVM diagnostic.</div>
          )}
        </div>

        {/* Right Col: Donut Distribution Card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-0.5">
              Dataset Risk Prevalence
            </h3>
            <p className="text-xs text-slate-500">
              Evaluated across {totalCount.toLocaleString()} total network assets
            </p>
          </div>

          <div className="h-48 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskDonutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {riskDonutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                  itemStyle={{ color: '#f8fafc', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-700 dark:text-slate-300">Normal Class</span>
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {normalCount.toLocaleString()} ({normalPct}%)
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-slate-700 dark:text-slate-300">At Risk Class</span>
              </span>
              <span className="font-bold text-red-600 dark:text-red-400 font-mono">
                {atRiskCount.toLocaleString()} ({atRiskPct}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Model Performance Metrics & Confusion Matrix (from Model Card) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Test Evaluation Metrics */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                SVM Test Evaluation Metrics
              </h3>
              <p className="text-xs text-slate-500">
                Evaluated on 1,200 held-out test records (stratified 80/20 train/test split)
              </p>
            </div>
            <span className="text-[11px] font-mono px-2 py-1 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30">
              Kernel: {bestParams?.kernel || 'rbf'} &bull; C: {bestParams?.C || 10}
            </span>
          </div>

          {svmMetrics ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 text-[11px] block">Accuracy</span>
                <span className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
                  {(svmMetrics.accuracy * 100).toFixed(2)}%
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 text-[11px] block">Precision</span>
                <span className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
                  {(svmMetrics.precision * 100).toFixed(2)}%
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 text-[11px] block">Recall</span>
                <span className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
                  {(svmMetrics.recall * 100).toFixed(2)}%
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 text-[11px] block">F1 Score</span>
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  {(svmMetrics.f1 * 100).toFixed(2)}%
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 text-[11px] block">ROC-AUC</span>
                <span className="text-lg font-bold text-blue-500 font-mono">
                  {svmMetrics.roc_auc.toFixed(4)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 text-[11px] block">Brier Calibration Score</span>
                <span className="text-lg font-bold text-purple-500 font-mono">
                  {svmMetrics.brier_score.toFixed(4)}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-slate-400 text-xs">Loading metrics...</div>
          )}
        </div>

        {/* Confusion Matrix Table */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="border-b border-slate-200 dark:border-slate-700 pb-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Confusion Matrix (Test Split)
            </h3>
            <p className="text-xs text-slate-500">
              True Negative, False Positive, False Negative, True Positive breakdown
            </p>
          </div>

          {confMatrix ? (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                  True Negatives (TN)
                </div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                  {confMatrix.tn}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Actual Normal &bull; Predicted Normal</div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <div className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
                  False Positives (FP)
                </div>
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono mt-1">
                  {confMatrix.fp}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Actual Normal &bull; Predicted At Risk</div>
              </div>

              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30">
                <div className="text-[11px] text-red-700 dark:text-red-400 font-semibold">
                  False Negatives (FN)
                </div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400 font-mono mt-1">
                  {confMatrix.fn}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Actual At Risk &bull; Predicted Normal</div>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30">
                <div className="text-[11px] text-blue-700 dark:text-blue-400 font-semibold">
                  True Positives (TP)
                </div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 font-mono mt-1">
                  {confMatrix.tp}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Actual At Risk &bull; Predicted At Risk</div>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-slate-400 text-xs">Loading confusion matrix...</div>
          )}
        </div>
      </div>

      {/* Evaluated At-Risk Network Assets Table */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Identified At-Risk Assets ({atRiskTotal} nodes)
            </h2>
            <p className="text-xs text-slate-500">
              Click &quot;Inspect&quot; on any asset to load its detailed diagnostic above.
            </p>
          </div>
          <button
            onClick={() => loadAtRiskAssets()}
            disabled={loadingTable}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            title="Refresh list"
          >
            <RefreshCw size={14} className={loadingTable ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 bg-slate-50 dark:bg-slate-900">
                <th className="p-3 font-semibold">Asset ID</th>
                <th className="p-3 font-semibold">Type</th>
                <th className="p-3 font-semibold">Location</th>
                <th className="p-3 font-semibold">Risk Score</th>
                <th className="p-3 font-semibold">Latency</th>
                <th className="p-3 font-semibold">Packet Loss</th>
                <th className="p-3 font-semibold">Breaches</th>
                <th className="p-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-800">
              {loadingTable ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    <RefreshCw size={18} className="animate-spin inline-block mr-2" />
                    Loading at-risk records...
                  </td>
                </tr>
              ) : atRiskList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No at-risk records found.
                  </td>
                </tr>
              ) : (
                atRiskList.map((asset) => (
                  <tr
                    key={asset.asset_id}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors ${
                      asset.asset_id === inspectedAssetId ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <td className="p-3 font-bold text-blue-500 font-mono">{asset.asset_id}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">{asset.asset_type}</td>
                    <td className="p-3 text-slate-500 font-mono text-[11px]">
                      {asset.city ? `${asset.city}, ` : ''}{asset.country || 'N/A'}
                    </td>
                    <td className="p-3 font-bold text-red-500 font-mono">
                      {(asset.risk_score * 100).toFixed(1)}%
                    </td>
                    <td className="p-3 font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {asset.latency_ms.toFixed(1)} ms
                    </td>
                    <td className="p-3 font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {asset.packet_loss_pct.toFixed(2)}%
                    </td>
                    <td className="p-3 text-[11px] text-amber-600 dark:text-amber-400">
                      {asset.threshold_breaches?.length || 0} breaches
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => loadAsset(asset.asset_id)}
                        className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-900 hover:bg-blue-600 hover:text-white text-slate-700 dark:text-slate-300 font-medium text-[11px] transition-colors border border-slate-300 dark:border-slate-700"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paging */}
        {atRiskTotal > 6 && (
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span>
              Showing {((atRiskPage - 1) * 6) + 1} to {Math.min(atRiskPage * 6, atRiskTotal)} of {atRiskTotal} at-risk assets
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={atRiskPage <= 1}
                onClick={() => setAtRiskPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                Page {atRiskPage} of {Math.ceil(atRiskTotal / 6)}
              </span>
              <button
                disabled={atRiskPage >= Math.ceil(atRiskTotal / 6)}
                onClick={() => setAtRiskPage((p) => p + 1)}
                className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
