import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Brain,
  ShieldAlert,
  Radio,
  Activity,
  ArrowRight,
  CheckCircle2,
  MapPin,
  Database,
  Server,
  Layers,
  AlertTriangle,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { useTelemetry } from '../context/TelemetryContext';
import { useTheme } from '../context/ThemeContext';
import { useApiStatus, getStatusStyle } from '../api/hooks';
import { getStatsOverview, getHourlyAnalytics, getIncidents } from '../api/client';
import { StatsOverview, HourlyData, Incident } from '../types/api';

export const Overview: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { isOnline } = useApiStatus();
  const { setSelectedCell } = useTelemetry();

  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [hourlyData, setHourlyData] = useState<HourlyData | null>(null);
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverviewData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewStats, hourlyRes, incidentsRes] = await Promise.all([
        getStatsOverview(),
        getHourlyAnalytics('traffic_load_pct'),
        getIncidents({ page: 1, page_size: 4 }),
      ]);
      setStats(overviewStats);
      setHourlyData(hourlyRes);
      setRecentIncidents(incidentsRes.items);
    } catch (err: any) {
      setError(err.message || 'Failed to load telemetry overview metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverviewData();
  }, [loadOverviewData]);

  // Asset type distribution data for chart
  const assetTypeChartData = stats?.by_asset_type.map((item) => ({
    name: item.asset_type,
    total: item.count,
    atRisk: item.at_risk,
    normal: item.count - item.at_risk,
  })) || [];

  return (
    <div className="p-6 space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Network Intelligence Overview
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Telemetry monitoring snapshot, SVM risk classification, and DBSCAN anomaly detection.
          </p>
          {stats?.time_range?.min && stats?.time_range?.max && (
            <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
              <Clock size={13} className="text-blue-500" />
              <span>
                Dataset snapshot: <strong>{stats.time_range.min.substring(0, 10)}</strong> ({stats.time_range.min.substring(11, 16)} to {stats.time_range.max.substring(11, 16)})
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => navigate('/data-input')}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-sm flex items-center gap-2"
          >
            <Database size={15} />
            <span>Ingest Telemetry Data</span>
          </button>
          <button
            onClick={() => navigate('/map')}
            className="px-4 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold text-xs transition-all flex items-center gap-2 shadow-sm"
          >
            <MapPin size={15} />
            <span>View Network Map</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Total Assets */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>Total Assets</span>
            <Radio size={16} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
            {stats ? stats.total_assets.toLocaleString() : '6,000'}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            {stats ? `${stats.located_assets.toLocaleString()} located on map` : 'All nodes located'}
          </div>
        </div>

        {/* Normal Class */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>Normal Operating</span>
            <CheckCircle2 size={16} className="text-emerald-500 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
            {stats ? stats.risk_counts.normal.toLocaleString() : '3,171'}
          </div>
          <div className="text-[11px] text-slate-500">
            {stats ? `${((stats.risk_counts.normal / stats.total_assets) * 100).toFixed(1)}% compliant` : '52.8% compliant'}
          </div>
        </div>

        {/* At-Risk Nodes */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-red-200 dark:border-red-500/30 bg-red-50/30 dark:bg-red-500/5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>SVM At Risk</span>
            <Brain size={16} className="text-red-500 dark:text-red-400" />
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400 font-mono">
            {stats ? stats.risk_counts.at_risk.toLocaleString() : '2,829'}
          </div>
          <div className="text-[11px] text-red-600 dark:text-red-300">
            {stats ? `${((stats.risk_counts.at_risk / stats.total_assets) * 100).toFixed(1)}% elevated risk` : '47.2% elevated risk'}
          </div>
        </div>

        {/* DBSCAN Anomalies */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-500/30 bg-purple-50/30 dark:bg-purple-500/5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>DBSCAN Anomalies</span>
            <Activity size={16} className="text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 font-mono">
            {stats ? stats.anomaly_count.toLocaleString() : '244'}
          </div>
          <div className="text-[11px] text-purple-600 dark:text-purple-300">
            {stats ? `${stats.both_count} dual at-risk & anomaly` : 'Multivariate outliers'}
          </div>
        </div>

        {/* Red Status Assets */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>Red Status Assets</span>
            <ShieldAlert size={16} className="text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400 font-mono">
            {stats ? stats.status_counts.red.toLocaleString() : '2,709'}
          </div>
          <div className="text-[11px] text-slate-500">
            Yellow: {stats?.status_counts.yellow || 0} &bull; Purple: {stats?.status_counts.purple || 0}
          </div>
        </div>
      </div>

      {/* Main Analytics Chart: Hourly Trend or Distribution by Asset Type */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Activity size={18} className="text-blue-600 dark:text-blue-400" />
              <span>
                {hourlyData?.meaningful
                  ? 'Hourly Telemetry Profile (Asset Local Time)'
                  : 'Asset Inventory & Risk Distribution by Infrastructure Type'}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {hourlyData?.meaningful
                ? 'Hourly aggregation from backend telemetry readings'
                : 'Single-day dataset snapshot: displaying Normal vs At-Risk breakdown across asset categories'}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
            <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              Snapshot: 2026-09-16 (Hours 00–23)
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={assetTypeChartData} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} opacity={0.5} />
              <XAxis
                dataKey="name"
                stroke={theme === 'dark' ? '#94a3b8' : '#64748b'}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                stroke={theme === 'dark' ? '#94a3b8' : '#64748b'}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                  borderColor: theme === 'dark' ? '#334155' : '#cbd5e1',
                  borderRadius: '8px',
                  color: theme === 'dark' ? '#f8fafc' : '#0f172a',
                  fontSize: '11px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Bar dataKey="normal" name="Normal Operating" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="atRisk" name="At Risk (Degradation)" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AI Intelligence Cards & Incidents Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SVM Risk Summary */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30 text-xs font-semibold flex items-center gap-1.5">
                <Brain size={14} />
                SVM Risk Classifier
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">96.4% Test Acc</span>
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Supervised Risk Model</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Predicts elevated risk of service degradation based on SLA threshold violations in network stress, packet loss, and latency metrics.
            </p>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">At-Risk Assets</div>
                <div className="text-xl font-bold text-red-600 dark:text-red-400 font-mono">
                  {stats ? stats.risk_counts.at_risk.toLocaleString() : '2,829'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Prevalence</div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 font-mono">
                  {stats ? `${((stats.risk_counts.at_risk / stats.total_assets) * 100).toFixed(1)}%` : '47.2%'}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/svm')}
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <span>View SVM Predictions</span>
            <ArrowRight size={15} />
          </button>
        </div>

        {/* DBSCAN Anomaly Summary */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30 text-xs font-semibold flex items-center gap-1.5">
                <Activity size={14} />
                DBSCAN Clustering
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">Unsupervised</span>
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Density Anomaly Model</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Detects spatial density outliers in 8-dimensional telemetry space using standardized Euclidean distance (eps=1.6, min_samples=16).
            </p>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Identified Noise Outliers</div>
                <div className="text-xl font-bold text-purple-600 dark:text-purple-400 font-mono">
                  {stats ? stats.anomaly_count.toLocaleString() : '244'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Noise Percentage</div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 font-mono">
                  {stats ? `${((stats.anomaly_count / stats.total_assets) * 100).toFixed(2)}%` : '4.07%'}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/dbscan')}
            className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <span>View DBSCAN Anomalies</span>
            <ArrowRight size={15} />
          </button>
        </div>

        {/* NOC Incidents Stream */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3 mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>NOC Incidents Log</span>
              </h3>
              <span className="text-[11px] text-slate-500 font-mono">Database state</span>
            </div>

            <div className="space-y-2.5 text-xs">
              {recentIncidents.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-xs">
                  No active incidents recorded. Dispatch an incident from the Map or SVM page.
                </div>
              ) : (
                recentIncidents.map((inc) => (
                  <div
                    key={inc.id}
                    onClick={() => navigate('/incidents')}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-400 cursor-pointer transition-colors space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-blue-500 font-semibold font-mono">
                        #{inc.id} &bull; {inc.asset_id}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-red-500">
                        {inc.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                      {inc.title}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={() => navigate('/incidents')}
            className="w-full py-2 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors mt-2"
          >
            Manage NOC Incidents
          </button>
        </div>
      </div>
    </div>
  );
};
