import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  BarChart3,
  Layers,
  Activity,
  Globe,
  Grid,
  Info,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import {
  getCorrelation,
  getDistributions,
  getCitiesAnalytics,
  getRiskAnomalyMatrix,
} from '../api/client';
import {
  CorrelationData,
  DistributionsData,
  CityRisk,
  RiskAnomalyMatrix,
} from '../types/api';
import { useTheme } from '../context/ThemeContext';

const METRIC_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'latency_ms', label: 'Latency (ms)' },
  { key: 'packet_loss_pct', label: 'Packet Loss (%)' },
  { key: 'traffic_load_pct', label: 'Traffic Load (%)' },
  { key: 'throughput_mbps', label: 'Throughput (Mbps)' },
  { key: 'connected_users', label: 'Connected Users' },
  { key: 'signal_strength_dbm', label: 'Signal Strength (dBm)' },
  { key: 'call_drop_rate_pct', label: 'Call Drop Rate (%)' },
  { key: 'resource_utilization_pct', label: 'Resource Utilization (%)' },
];

export const Analytics: React.FC = () => {
  const { theme } = useTheme();

  // Correlation Heatmap State
  const [correlation, setCorrelation] = useState<CorrelationData | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ row: string; col: string; val: number } | null>(null);

  // Risk x Anomaly Matrix State
  const [matrix, setMatrix] = useState<RiskAnomalyMatrix | null>(null);

  // Top Cities State
  const [cities, setCities] = useState<CityRisk[]>([]);

  // Metric Distribution State
  const [distMetric, setDistMetric] = useState<string>('latency_ms');
  const [distributions, setDistributions] = useState<DistributionsData | null>(null);

  // Loading States
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingDist, setLoadingDist] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load Main Analytics Data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [corrData, matrixData, citiesData] = await Promise.all([
        getCorrelation(),
        getRiskAnomalyMatrix(),
        getCitiesAnalytics(10, 10),
      ]);
      setCorrelation(corrData);
      setMatrix(matrixData);
      setCities(citiesData);
    } catch (err: any) {
      setError(err.message || 'Failed to load backend analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load Distribution Data on metric change
  const loadDistribution = useCallback(async (metric: string) => {
    setLoadingDist(true);
    try {
      const data = await getDistributions(metric, 'asset_type', 6);
      setDistributions(data);
    } catch (err: any) {
      console.error('Failed to load metric distributions:', err);
    } finally {
      setLoadingDist(false);
    }
  }, []);

  useEffect(() => {
    loadDistribution(distMetric);
  }, [distMetric, loadDistribution]);

  // Transform Distribution data for Recharts BarChart
  const distributionChartData = useMemo(() => {
    if (!distributions) return [];
    return distributions.bins.map((binLabel, binIdx) => {
      const item: Record<string, any> = { bin: binLabel };
      Object.keys(distributions.groups).forEach((groupName) => {
        item[groupName] = distributions.groups[groupName][binIdx] || 0;
      });
      return item;
    });
  }, [distributions]);

  // Heatmap Color Helper: returns background color and text color based on Pearson r (-1.0 to +1.0)
  const getCorrelationColor = (val: number) => {
    if (val === 1.0) return 'bg-blue-600 text-white font-bold';
    if (val >= 0.7) return 'bg-blue-500/80 text-white font-medium';
    if (val >= 0.4) return 'bg-blue-500/40 text-blue-900 dark:text-blue-100';
    if (val >= 0.15) return 'bg-blue-500/20 text-slate-700 dark:text-slate-300';
    if (val <= -0.7) return 'bg-red-500/80 text-white font-medium';
    if (val <= -0.4) return 'bg-red-500/40 text-red-900 dark:text-red-100';
    if (val <= -0.15) return 'bg-red-500/20 text-slate-700 dark:text-slate-300';
    return 'bg-slate-100 dark:bg-slate-800 text-slate-500';
  };

  const GROUP_COLORS: Record<string, string> = {
    'Cell Tower': '#3b82f6',
    'Base Station': '#6366f1',
    'Network Gateway': '#10b981',
    Router: '#f59e0b',
  };

  return (
    <div className="p-6 space-y-6 font-sans">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <BarChart3 className="text-blue-500" size={26} />
            <span>Statistical & Analytical Intelligence</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Multivariate feature correlations, distribution density profiles, geographic risk concentrations, and the 2x2 Risk-Anomaly matrix.
          </p>
        </div>

        <button
          onClick={() => {
            loadData();
            loadDistribution(distMetric);
          }}
          disabled={loading}
          className="px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 self-start md:self-auto"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Analytics</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs flex items-center gap-2">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Row 1: 2x2 Risk-Anomaly Matrix & Geographic Risk Concentration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* At-Risk x Anomaly 2x2 Matrix */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Grid size={18} className="text-purple-500" />
                  <span>SVM Risk &times; DBSCAN Anomaly (2&times;2 Matrix)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cross-model joint classification of all {matrix?.total || 6000} infrastructure nodes
                </p>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                Joint Density
              </span>
            </div>

            {matrix ? (
              <div className="grid grid-cols-2 gap-3 pt-4 text-xs">
                {/* Normal + Inlier */}
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">Normal & Inlier</span>
                    <ShieldCheck size={16} className="text-emerald-500" />
                  </div>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {matrix.normal_inlier.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {((matrix.normal_inlier / matrix.total) * 100).toFixed(1)}% &bull; Compliant baseline operation
                  </div>
                </div>

                {/* Normal + Anomaly */}
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-purple-700 dark:text-purple-400">Anomalous (Not at Risk)</span>
                    <Activity size={16} className="text-purple-500" />
                  </div>
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 font-mono">
                    {matrix.normal_anomaly.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-purple-700 dark:text-purple-300 font-medium">
                    Anomalous but not at risk: unusual combinations worth inspecting
                  </div>
                </div>

                {/* At-Risk + Inlier */}
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-700 dark:text-amber-400">At Risk (Not Anomalous)</span>
                    <AlertTriangle size={16} className="text-amber-500" />
                  </div>
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono">
                    {matrix.at_risk_inlier.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                    At risk but not anomalous: ordinary congestion/degradation
                  </div>
                </div>

                {/* At-Risk + Anomaly */}
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-red-700 dark:text-red-400">Dual Alert (Risk + Anomaly)</span>
                    <ShieldAlert size={16} className="text-red-500" />
                  </div>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400 font-mono">
                    {matrix.at_risk_anomaly.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {((matrix.at_risk_anomaly / matrix.total) * 100).toFixed(1)}% &bull; Severe dual degradation signatures
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">Loading matrix...</div>
            )}
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-500">
            💡 <strong>Interpretation:</strong> Nodes in the off-diagonal cells highlight where Supervised SLA classification and Unsupervised clustering provide complementary perspectives.
          </div>
        </div>

        {/* Top Cities by At-Risk Concentration */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Globe size={18} className="text-blue-500" />
                <span>Top Metropolitan Areas by At-Risk Share</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cities with highest concentration of nodes predicted at elevated degradation risk (min N=10)
              </p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            {cities.map((city, idx) => (
              <div
                key={city.city}
                className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-[140px]">
                  <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-mono font-bold text-[10px] text-slate-600 dark:text-slate-300">
                    {idx + 1}
                  </span>
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{city.city}</span>
                    <span className="text-[10px] text-slate-400 block">{city.total_assets} nodes</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="flex-1 max-w-xs bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full"
                    style={{ width: `${Math.min(100, city.at_risk_pct)}%` }}
                  />
                </div>

                <div className="text-right min-w-[80px]">
                  <span className="font-bold text-red-500 font-mono">{city.at_risk_pct.toFixed(1)}%</span>
                  <span className="text-[10px] text-slate-400 block">{city.at_risk_count} at risk</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Metric Distribution Profiles by Asset Type */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers size={18} className="text-emerald-500" />
              <span>Metric Distribution Density by Infrastructure Category</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Empirical histogram bins across Cell Towers, Base Stations, Gateways, and Routers
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Metric:</span>
            <select
              value={distMetric}
              onChange={(e) => setDistMetric(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-medium text-xs"
            >
              {METRIC_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="h-72 w-full">
          {loadingDist ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              <RefreshCw size={20} className="animate-spin mr-2" />
              Computing distribution histograms...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionChartData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} opacity={0.5} />
                <XAxis dataKey="bin" stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} tick={{ fontSize: 10 }} />
                <YAxis stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                    borderColor: theme === 'dark' ? '#334155' : '#cbd5e1',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                {distributions &&
                  Object.keys(distributions.groups).map((groupName) => (
                    <Bar
                      key={groupName}
                      dataKey={groupName}
                      fill={GROUP_COLORS[groupName] || '#3b82f6'}
                      radius={[3, 3, 0, 0]}
                    />
                  ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 3: Feature Correlation Heatmap (CSS Grid Component) */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Grid size={18} className="text-blue-500" />
              <span>Feature Correlation Matrix (Pearson r)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pairwise linear correlation across all 12 operational and engineered telemetry parameters
            </p>
          </div>

          {hoveredCell && (
            <div className="text-xs font-mono px-3 py-1 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30">
              {hoveredCell.row} &times; {hoveredCell.col}: <strong>{hoveredCell.val.toFixed(3)}</strong>
            </div>
          )}
        </div>

        {correlation ? (
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[700px]">
              {/* Header Row */}
              <div className="grid grid-cols-13 gap-1 mb-1 text-[10px] font-mono text-slate-400 text-center">
                <div className="text-left font-semibold truncate pr-1">Feature</div>
                {correlation.labels.map((lbl, idx) => (
                  <div key={idx} className="truncate" title={lbl}>
                    {lbl.replace('_pct', '%').replace('_ms', 'ms').replace('_mbps', 'M').substring(0, 5)}
                  </div>
                ))}
              </div>

              {/* Data Rows */}
              {correlation.values.map((rowVals, rowIdx) => {
                const rowLabel = correlation.labels[rowIdx];
                return (
                  <div key={rowIdx} className="grid grid-cols-13 gap-1 mb-1 items-center text-center">
                    {/* Row Label */}
                    <div
                      className="text-left text-[10px] font-mono font-medium text-slate-600 dark:text-slate-400 truncate pr-1"
                      title={rowLabel}
                    >
                      {rowLabel}
                    </div>

                    {/* Cells */}
                    {rowVals.map((val, colIdx) => {
                      const colLabel = correlation.labels[colIdx];
                      return (
                        <div
                          key={colIdx}
                          onMouseEnter={() => setHoveredCell({ row: rowLabel, col: colLabel, val })}
                          onMouseLeave={() => setHoveredCell(null)}
                          className={`h-7 rounded flex items-center justify-center font-mono text-[10px] cursor-pointer transition-transform hover:scale-110 ${getCorrelationColor(
                            val
                          )}`}
                          title={`${rowLabel} vs ${colLabel}: ${val.toFixed(3)}`}
                        >
                          {val === 1 ? '1.0' : val.toFixed(2)}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs">Loading correlation matrix...</div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-blue-600" />
              <span>Positive (+1.0)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-slate-300 dark:bg-slate-700" />
              <span>Neutral (0.0)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-red-600" />
              <span>Negative (-1.0)</span>
            </span>
          </div>
          <span className="text-[11px]">Hover over any cell for full feature names and exact r-value</span>
        </div>
      </div>
    </div>
  );
};
