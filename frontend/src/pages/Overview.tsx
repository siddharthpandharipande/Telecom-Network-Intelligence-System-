import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Brain, ShieldAlert, Radio, Activity, AlertTriangle, ArrowRight, CheckCircle2, MapPin, Database, Server } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';
import { useTelemetry } from '../context/TelemetryContext';
import { useTheme } from '../context/ThemeContext';

const PERFORMANCE_DATA = [
  { time: '10:00', latency: 38, packetLoss: 1.2, throughput: 9.8, load: 64 },
  { time: '11:00', latency: 42, packetLoss: 1.5, throughput: 9.2, load: 68 },
  { time: '12:00', latency: 48, packetLoss: 1.8, throughput: 8.9, load: 74 },
  { time: '13:00', latency: 54, packetLoss: 2.4, throughput: 8.1, load: 81 },
  { time: '14:00', latency: 72, packetLoss: 4.1, throughput: 7.2, load: 88 },
  { time: '15:00', latency: 118, packetLoss: 8.5, throughput: 5.4, load: 94 },
  { time: '15:42', latency: 182, packetLoss: 11.8, throughput: 4.2, load: 95 },
];

export const Overview: React.FC = () => {
  const navigate = useNavigate();
  const { cells, incidents, alerts, setSelectedCell } = useTelemetry();
  const { theme } = useTheme();
  const [timeFilter, setTimeFilter] = useState<'1H' | '6H' | '12H' | '24H' | '7D'>('24H');

  const atRiskCellsCount = cells.filter(c => c.svmRiskCategory === 'At Risk').length;
  const anomalyCellsCount = cells.filter(c => c.dbscanClassification === 'Anomaly').length;
  const activeAlertsCount = alerts.filter(a => a.status !== 'Resolved').length;
  const criticalIncidentsCount = incidents.filter(i => i.status !== 'RESOLVED').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Network Intelligence Overview
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time telemetry monitoring, SVM risk degradation prediction, and DBSCAN anomaly detection.
          </p>
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
            <span>View Live Map</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>Total Nodes</span>
            <Radio size={16} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{cells.length.toLocaleString()}</div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">98.6% Operational</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>Active Operational</span>
            <CheckCircle2 size={16} className="text-emerald-500 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">2,451</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">Normal status</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>SVM At-Risk Nodes</span>
            <Brain size={16} className="text-red-500 dark:text-red-400" />
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{atRiskCellsCount}</div>
          <div className="text-[11px] text-red-600 dark:text-red-300">Degradation predicted</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-500/30 bg-purple-50/50 dark:bg-purple-500/5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>DBSCAN Anomalies</span>
            <Activity size={16} className="text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{anomalyCellsCount}</div>
          <div className="text-[11px] text-purple-600 dark:text-purple-300">Density spatial outliers</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>Active Incidents</span>
            <ShieldAlert size={16} className="text-amber-500 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{criticalIncidentsCount}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">{activeAlertsCount} alerts active</div>
        </div>
      </div>

      {/* Main Performance Chart */}
      <div className="p-6 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Activity size={18} className="text-blue-600 dark:text-blue-400" />
              <span>Network Performance Trends</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Latency & Traffic Load over time</p>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
            {(['1H', '6H', '12H', '24H', '7D'] as const).map(tf => (
              <button
                key={tf}
                onClick={() => setTimeFilter(tf)}
                className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-colors ${
                  timeFilter === tf
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={PERFORMANCE_DATA} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
              <XAxis dataKey="time" stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} tick={{ fontSize: 11 }} />
              <YAxis stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                  borderColor: theme === 'dark' ? '#334155' : '#cbd5e1',
                  borderRadius: '8px',
                  color: theme === 'dark' ? '#f8fafc' : '#0f172a'
                }}
              />
              <Area type="monotone" dataKey="latency" name="Latency (ms)" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorLatency)" />
              <Area type="monotone" dataKey="load" name="Traffic Load (%)" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorLoad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AI Intelligence Cards & Recent Alerts Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SVM Risk Summary */}
        <div className="p-6 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30 text-xs font-semibold flex items-center gap-1.5">
                <Brain size={14} />
                SVM Risk Classifier
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">95.5% Accuracy</span>
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Supervised Risk Model</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Predicts potential network degradation using RBF Kernel classification on latency, packet loss, and utilization metrics.
            </p>

            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">At-Risk Nodes</div>
                <div className="text-xl font-bold text-red-600 dark:text-red-400">{atRiskCellsCount} Nodes</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Avg Confidence</div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">94.7%</div>
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
        <div className="p-6 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30 text-xs font-semibold flex items-center gap-1.5">
                <Activity size={14} />
                DBSCAN Clustering
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">Unsupervised</span>
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Density Anomaly Model</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Discovers unexpected traffic spikes and spatial density outliers across geographical cell sites.
            </p>

            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Identified Outliers</div>
                <div className="text-xl font-bold text-purple-600 dark:text-purple-400">{anomalyCellsCount} Outliers</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Clusters Found</div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">18 Clusters</div>
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

        {/* Live Telemetry Events Stream */}
        <div className="p-6 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3 mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Recent Network Events</span>
              </h3>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Live Stream</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div
                onClick={() => {
                  const target = cells.find(c => c.id === 'MH-PN-102');
                  if (target) setSelectedCell(target);
                  navigate('/map');
                }}
                className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 cursor-pointer transition-colors space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-red-600 dark:text-red-400 font-semibold">MH-PN-102 — SVM High Risk</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">15:38</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">Pune Central: Latency 182ms | Packet Loss 11.8%</p>
              </div>

              <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 cursor-pointer transition-colors space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-purple-600 dark:text-purple-400 font-semibold">MH-DL-201 — DBSCAN Anomaly</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">15:34</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">Delhi Hub: Spatial cluster distance score 0.88 outlier</p>
              </div>

              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 cursor-pointer transition-colors space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">MH-MB-417 — High Traffic</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">15:29</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">Mumbai Marine Drive: 1,420 users (88% load)</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/incidents')}
            className="w-full py-2 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors mt-2"
          >
            View All Incidents
          </button>
        </div>
      </div>
    </div>
  );
};


