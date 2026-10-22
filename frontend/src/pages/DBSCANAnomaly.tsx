import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell as RechartsCell,
  ResponsiveContainer,
} from 'recharts';
import {
  Brain,
  Activity,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  MapPin,
  RefreshCw,
  Sliders,
  AlertTriangle,
  Search,
  Compass,
} from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';
import { useTelemetry } from '../context/TelemetryContext';
import { useApiStatus } from '../api/hooks';
import { getScatterData, getModelCard, getAssets, getAssetDetail } from '../api/client';
import { ScatterPoint, ModelCard, Reading, AssetDetail } from '../types/api';

const METRIC_OPTIONS: Array<{ key: string; label: string; unit: string }> = [
  { key: 'latency_ms', label: 'Latency', unit: 'ms' },
  { key: 'traffic_load_pct', label: 'Traffic Load', unit: '%' },
  { key: 'packet_loss_pct', label: 'Packet Loss', unit: '%' },
  { key: 'throughput_mbps', label: 'Throughput', unit: 'Mbps' },
  { key: 'connected_users', label: 'Connected Users', unit: 'users' },
  { key: 'signal_strength_dbm', label: 'Signal Strength', unit: 'dBm' },
  { key: 'call_drop_rate_pct', label: 'Call Drop Rate', unit: '%' },
  { key: 'resource_utilization_pct', label: 'Resource Utilization', unit: '%' },
];

export const DBSCANAnomaly: React.FC = () => {
  const navigate = useNavigate();
  const { isOnline } = useApiStatus();
  const { createIncident } = useTelemetry();

  // Model Card
  const [modelCard, setModelCard] = useState<ModelCard | null>(null);
  const [loadingModel, setLoadingModel] = useState<boolean>(true);

  // Scatter Axes & Data
  const [xMetric, setXMetric] = useState<string>('latency_ms');
  const [yMetric, setYMetric] = useState<string>('traffic_load_pct');
  const [scatterPoints, setScatterPoints] = useState<ScatterPoint[]>([]);
  const [loadingScatter, setLoadingScatter] = useState<boolean>(true);
  const [scatterError, setScatterError] = useState<string | null>(null);

  // Anomalous Assets List
  const [anomalyList, setAnomalyList] = useState<Reading[]>([]);
  const [anomalyTotal, setAnomalyTotal] = useState<number>(0);
  const [anomalyPage, setAnomalyPage] = useState<number>(1);
  const [loadingAnomalies, setLoadingAnomalies] = useState<boolean>(false);

  // Inspected Asset Detail
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [inspectedDetail, setInspectedDetail] = useState<AssetDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Load Model Card
  useEffect(() => {
    let active = true;
    getModelCard()
      .then((data) => {
        if (active) setModelCard(data);
      })
      .catch((err) => console.error('Failed to load model card for DBSCAN:', err))
      .finally(() => {
        if (active) setLoadingModel(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Fetch Scatter Points
  const fetchScatter = useCallback(async () => {
    setLoadingScatter(true);
    setScatterError(null);
    try {
      const data = await getScatterData(xMetric, yMetric, 1500);
      setScatterPoints(data);
    } catch (err: any) {
      setScatterError(err.message || 'Failed to load scatter data from backend');
    } finally {
      setLoadingScatter(false);
    }
  }, [xMetric, yMetric]);

  useEffect(() => {
    fetchScatter();
  }, [fetchScatter]);

  // Fetch Anomalous Assets List
  const fetchAnomalies = useCallback(async () => {
    setLoadingAnomalies(true);
    try {
      const res = await getAssets({ is_anomaly: true, page: anomalyPage, page_size: 8 });
      setAnomalyList(res.items);
      setAnomalyTotal(res.total);
      if (!selectedAssetId && res.items.length > 0) {
        setSelectedAssetId(res.items[0].asset_id);
      }
    } catch (err: any) {
      console.error('Failed to load anomalous assets:', err);
    } finally {
      setLoadingAnomalies(false);
    }
  }, [anomalyPage]);

  useEffect(() => {
    fetchAnomalies();
  }, [fetchAnomalies]);

  // Fetch Asset Detail when selected
  useEffect(() => {
    if (!selectedAssetId) return;
    let active = true;
    setLoadingDetail(true);
    getAssetDetail(selectedAssetId)
      .then((data) => {
        if (active) setInspectedDetail(data);
      })
      .catch((err) => console.error(`Failed to load asset detail for ${selectedAssetId}:`, err))
      .finally(() => {
        if (active) setLoadingDetail(false);
      });
    return () => {
      active = false;
    };
  }, [selectedAssetId]);

  // Search state
  const [assetSearchInput, setAssetSearchInput] = useState<string>('');
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleAssetSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = assetSearchInput.trim();
    if (!query) return;
    setSearchError(null);
    setLoadingDetail(true);
    try {
      const data = await getAssetDetail(query);
      setInspectedDetail(data);
      setSelectedAssetId(data.asset.asset_id);
    } catch (err: any) {
      setSearchError(err.message || `Asset '${query}' was not found in the database.`);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleQuickSelect = (aid: string) => {
    setAssetSearchInput(aid);
    setSearchError(null);
    setSelectedAssetId(aid);
  };


  const xOption = useMemo(
    () => METRIC_OPTIONS.find((m) => m.key === xMetric) || METRIC_OPTIONS[0],
    [xMetric]
  );
  const yOption = useMemo(
    () => METRIC_OPTIONS.find((m) => m.key === yMetric) || METRIC_OPTIONS[1],
    [yMetric]
  );

  const dbscanMeta = modelCard?.dbscan;
  const latestReading = inspectedDetail?.latest;

  return (
    <div className="p-6 space-y-6 font-sans">
      {/* Header with Sub-Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <Activity size={24} className="text-purple-500" />
            <span>DBSCAN Anomaly Detection Diagnostics</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Unsupervised density-based spatial clustering (DBSCAN) isolating multivariate operational outliers and anomalous telemetry patterns.
          </p>
        </div>

        {/* Model Switcher Tabs */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => navigate('/svm')}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-all flex items-center gap-2"
          >
            <Brain size={14} />
            <span>SVM Risk Prediction</span>
          </button>
          <button
            onClick={() => navigate('/dbscan')}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-purple-600 text-white shadow-sm transition-all flex items-center gap-2"
          >
            <Activity size={14} />
            <span>DBSCAN Anomaly Detection</span>
          </button>
        </div>
      </div>

      {/* Model Hyperparameters Banner from Model Card */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs shadow-sm">
        <div>
          <div className="text-slate-500 text-[11px]">Clustering Algorithm</div>
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">DBSCAN (Standardized)</div>
        </div>
        <div>
          <div className="text-slate-500 text-[11px]">Operational Hyperparameters</div>
          <div className="text-sm font-bold text-purple-600 dark:text-purple-400 mt-0.5 font-mono">
            eps = {dbscanMeta?.eps ?? 1.6}, min_samples = {dbscanMeta?.min_samples ?? 16}
          </div>
        </div>
        <div>
          <div className="text-slate-500 text-[11px]">Identified Dense Clusters</div>
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5 font-mono">
            {dbscanMeta?.n_clusters ?? 2} Clusters
          </div>
        </div>
        <div>
          <div className="text-slate-500 text-[11px]">Noise / Anomaly Ratio</div>
          <div className="text-sm font-bold text-red-500 mt-0.5 font-mono">
            {dbscanMeta?.noise_count ?? 244} nodes ({dbscanMeta?.noise_pct?.toFixed(2) ?? '4.07'}%)
          </div>
        </div>
        <div>
          <div className="text-slate-500 text-[11px]">Clustering Features</div>
          <div className="text-sm font-bold text-blue-500 mt-0.5">8 Telemetry Dimensions</div>
        </div>
      </div>

      {/* Asset ID Search & Anomaly Inspector Input Bar */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Search size={16} className="text-purple-500" />
              <span>Inspect Anomaly Status by Asset ID</span>
            </h2>
            <p className="text-[11px] text-slate-500">
              Input any telecom Asset ID to display its DBSCAN density cluster, nearest core distance, and anomaly classification.
            </p>
          </div>
          {loadingDetail && (
            <span className="text-xs text-purple-500 flex items-center gap-1.5 animate-pulse">
              <RefreshCw size={12} className="animate-spin" /> Fetching asset details...
            </span>
          )}
        </div>

        <form onSubmit={handleAssetSearch} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={assetSearchInput}
              onChange={(e) => {
                setAssetSearchInput(e.target.value);
                if (searchError) setSearchError(null);
              }}
              placeholder="Enter Asset ID (e.g., SA-COL-BOG-DC-BS-00378, AS-IND-MUM-MH-BS-09999, MH-PN-999)..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={!assetSearchInput.trim() || loadingDetail}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 flex-shrink-0"
          >
            <Activity size={14} />
            <span>Inspect Anomaly</span>
          </button>
        </form>

        {searchError && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertTriangle size={14} className="flex-shrink-0" />
            <span>{searchError}</span>
          </div>
        )}

        {/* Quick sample chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-slate-500">
          <span className="font-medium mr-1">Quick Samples:</span>
          {[
            'SA-COL-BOG-DC-BS-00378',
            'AS-IND-MUM-MH-BS-09999',
            'NA-USA-NYC-NY-RT-01200',
            'EU-FRA-PAR-ID-BS-00140',
            'AF-ZAF-JNB-GT-RT-00088',
          ].map((sampleId) => (
            <button
              key={sampleId}
              type="button"
              onClick={() => handleQuickSelect(sampleId)}
              className={`px-2 py-0.5 rounded-md font-mono text-[10px] transition-colors border ${
                selectedAssetId === sampleId
                  ? 'bg-purple-500/20 text-purple-600 dark:text-purple-300 border-purple-500/50 font-bold'
                  : 'bg-slate-100 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-purple-400'
              }`}
            >
              {sampleId}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Asset Diagnostic Box */}
      {latestReading && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-4 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30 text-xs font-semibold">
                  Cluster Diagnostic
                </span>
                <span className="text-xs text-slate-500">
                  {inspectedDetail?.asset.city ? `${inspectedDetail.asset.city}, ` : ''}
                  {inspectedDetail?.asset.country || ''}
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
                Asset {latestReading.asset_id} ({inspectedDetail?.asset.asset_type || 'Node'})
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  latestReading.is_anomaly
                    ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/40'
                    : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40'
                }`}
              >
                {latestReading.is_anomaly ? 'Multivariate Anomaly' : 'Normal Cluster Inlier'}
              </span>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <div className="text-slate-500 text-[11px]">DBSCAN Cluster</div>
              <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
                {latestReading.dbscan_cluster === -1 ? 'Noise Outlier (-1)' : `Cluster ${latestReading.dbscan_cluster}`}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <div className="text-slate-500 text-[11px]">Distance to Core Node</div>
              <div className="text-base font-bold text-purple-600 dark:text-purple-400 mt-1 font-mono">
                {latestReading.nearest_core_distance?.toFixed(3) ?? 'N/A'} (eps=1.6)
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <div className="text-slate-500 text-[11px]">SVM Risk Classification</div>
              <div
                className={`text-base font-bold mt-1 font-mono ${
                  latestReading.is_at_risk ? 'text-red-500' : 'text-emerald-500'
                }`}
              >
                {latestReading.risk_label} ({(latestReading.risk_score * 100).toFixed(1)}%)
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <div className="text-slate-500 text-[11px]">Threshold Breaches</div>
              <div className="text-base font-bold text-amber-500 mt-1 font-mono">
                {latestReading.threshold_breaches?.length || 0} breaches
              </div>
            </div>
          </div>

          {/* 8-Dimensional Telemetry Telemetry Breakdown */}
          <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-between">
              <span>Underlying 8-Dimensional Telemetry Profile</span>
              <span className="font-mono text-purple-500 font-semibold lowercase">
                sampled at {latestReading.timestamp.replace('T', ' ')}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 text-center text-[11px]">
              <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60">
                <div className="text-slate-400 text-[10px]">Signal (RSRP)</div>
                <div className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                  {latestReading.signal_strength_dbm} dBm
                </div>
              </div>
              <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60">
                <div className="text-slate-400 text-[10px]">Latency</div>
                <div className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                  {latestReading.latency_ms} ms
                </div>
              </div>
              <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60">
                <div className="text-slate-400 text-[10px]">Packet Loss</div>
                <div className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                  {latestReading.packet_loss_pct}%
                </div>
              </div>
              <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60">
                <div className="text-slate-400 text-[10px]">Throughput</div>
                <div className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                  {latestReading.throughput_mbps} Mbps
                </div>
              </div>
              <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60">
                <div className="text-slate-400 text-[10px]">Users</div>
                <div className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                  {latestReading.connected_users}
                </div>
              </div>
              <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60">
                <div className="text-slate-400 text-[10px]">Traffic Load</div>
                <div className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                  {latestReading.traffic_load_pct}%
                </div>
              </div>
              <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60">
                <div className="text-slate-400 text-[10px]">Call Drop Rate</div>
                <div className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                  {latestReading.call_drop_rate_pct}%
                </div>
              </div>
              <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60">
                <div className="text-slate-400 text-[10px]">Resource Util</div>
                <div className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                  {latestReading.resource_utilization_pct}%
                </div>
              </div>
            </div>
          </div>


          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={() => navigate(`/map?asset=${encodeURIComponent(latestReading.asset_id)}&locate_distance=1`)}
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
              title="Locate distance connecting this anomalous asset with its nearest Core Node on the live map"
            >
              <Compass size={14} />
              <span>Locate Distance</span>
            </button>
            <button
              onClick={() => navigate(`/map?asset=${encodeURIComponent(latestReading.asset_id)}`)}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <MapPin size={14} />
              <span>Locate on Map</span>
            </button>
            <button
              onClick={() => navigate('/svm')}
              className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors flex items-center gap-1.5 border border-slate-300 dark:border-slate-700"
            >
              <span>View SVM Classifier</span>
              <ArrowRight size={14} />
            </button>
            {latestReading.is_anomaly && (
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
        </div>
      )}

      {/* Cluster Scatter Plot & Outliers Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scatter Plot (2 cols) */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Multivariate Feature Projection (DBSCAN Space)
              </h2>
              <p className="text-xs text-slate-500">
                Visualizing {scatterPoints.length} assets with selected axes: {xOption.label} vs {yOption.label}
              </p>
            </div>

            {/* Axis Selectors */}
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1">
                <span className="text-slate-500 font-medium">X:</span>
                <select
                  value={xMetric}
                  onChange={(e) => setXMetric(e.target.value)}
                  className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded px-2 py-1 text-xs focus:outline-none"
                >
                  {METRIC_OPTIONS.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-slate-500 font-medium">Y:</span>
                <select
                  value={yMetric}
                  onChange={(e) => setYMetric(e.target.value)}
                  className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded px-2 py-1 text-xs focus:outline-none"
                >
                  {METRIC_OPTIONS.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Scatter Chart */}
          <div className="h-80 w-full">
            {loadingScatter ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                <RefreshCw size={20} className="animate-spin mr-2" />
                Loading scatter points from backend...
              </div>
            ) : scatterError ? (
              <div className="h-full flex items-center justify-center text-red-400 text-xs">
                <AlertTriangle size={16} className="mr-2" />
                {scatterError}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name={xOption.label}
                    unit={` ${xOption.unit}`}
                    stroke="#94a3b8"
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name={yOption.label}
                    unit={` ${yOption.unit}`}
                    stroke="#94a3b8"
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                    itemStyle={{ color: '#f8fafc', fontSize: '11px' }}
                    formatter={(val: any, name: any) => [val, name]}
                  />
                  <Scatter
                    name="Network Assets"
                    data={scatterPoints}
                    onClick={(entry) => {
                      if (entry?.asset_id) setSelectedAssetId(entry.asset_id);
                    }}
                  >
                    {scatterPoints.map((entry, index) => {
                      const isSelected = entry.asset_id === selectedAssetId;
                      let fill = '#10b981'; // Inlier Normal
                      if (entry.is_anomaly) fill = '#a855f7'; // Anomaly
                      else if (entry.is_at_risk) fill = '#ef4444'; // At Risk
                      return (
                        <RechartsCell
                          key={`cell-${index}`}
                          fill={fill}
                          stroke={isSelected ? '#ffffff' : undefined}
                          strokeWidth={isSelected ? 2 : 0}
                          r={isSelected ? 7 : entry.is_anomaly ? 5 : 3.5}
                        />
                      );
                    })}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Normal Inlier</span>
              </span>
              <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                <span>DBSCAN Outlier Anomaly</span>
              </span>
              <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span>At Risk</span>
              </span>
            </div>
            <span className="text-[11px]">Click any point to inspect its diagnostics</span>
          </div>
        </div>

        {/* Detected Outliers Table (1 col) */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Detected Anomalies ({anomalyTotal})
              </h3>
              <button
                onClick={() => fetchAnomalies()}
                className="p-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                title="Refresh anomalies"
              >
                <RefreshCw size={13} className={loadingAnomalies ? 'animate-spin' : ''} />
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Nodes classified as noise outliers (cluster -1)
            </p>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1 text-xs">
            {loadingAnomalies ? (
              <div className="p-6 text-center text-slate-400">Loading anomalies...</div>
            ) : anomalyList.length === 0 ? (
              <div className="p-6 text-center text-slate-400">No anomalous nodes detected.</div>
            ) : (
              anomalyList.map((c) => (
                <div
                  key={c.asset_id}
                  onClick={() => setSelectedAssetId(c.asset_id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    c.asset_id === selectedAssetId
                      ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-400'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-600 dark:text-purple-400 font-mono">
                      {c.asset_id}
                    </span>
                    <span className="text-[10px] uppercase font-semibold text-slate-400">
                      {c.asset_type}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Latency: {c.latency_ms.toFixed(0)}ms &bull; Loss: {c.packet_loss_pct.toFixed(1)}% &bull; Load: {c.traffic_load_pct.toFixed(0)}%
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200 dark:border-slate-800 text-[11px]">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/map?asset=${encodeURIComponent(c.asset_id)}&locate_distance=1`);
                      }}
                      className="text-purple-600 dark:text-purple-400 hover:text-purple-500 font-semibold font-mono flex items-center gap-1 hover:underline"
                      title="Measure distance to core node on network map"
                    >
                      <Compass size={11} />
                      <span>Dist: {c.nearest_core_distance?.toFixed(2) ?? 'N/A'}</span>
                    </button>
                    <span
                      className={`font-semibold ${
                        c.is_at_risk ? 'text-red-500' : 'text-emerald-500'
                      }`}
                    >
                      {c.risk_label} ({(c.risk_score * 100).toFixed(0)}%)
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Paging */}
          {anomalyTotal > 8 && (
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-200 dark:border-slate-700">
              <button
                disabled={anomalyPage <= 1}
                onClick={() => setAnomalyPage((p) => Math.max(1, p - 1))}
                className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                Page {anomalyPage} of {Math.ceil(anomalyTotal / 8)}
              </span>
              <button
                disabled={anomalyPage >= Math.ceil(anomalyTotal / 8)}
                onClick={() => setAnomalyPage((p) => p + 1)}
                className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
