import React, { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { BarChart3, TrendingUp, Calendar, Zap, Activity } from 'lucide-react';

const ANALYTICS_TRENDS = [
  { day: 'Mon', latency: 42, packetLoss: 1.4, throughput: 8.9, svmRiskCount: 18, dbscanAnomalies: 8, resolvedIncidents: 38 },
  { day: 'Tue', latency: 38, packetLoss: 1.1, throughput: 9.4, svmRiskCount: 14, dbscanAnomalies: 6, resolvedIncidents: 42 },
  { day: 'Wed', latency: 45, packetLoss: 1.8, throughput: 8.2, svmRiskCount: 22, dbscanAnomalies: 11, resolvedIncidents: 35 },
  { day: 'Thu', latency: 52, packetLoss: 2.3, throughput: 7.9, svmRiskCount: 28, dbscanAnomalies: 15, resolvedIncidents: 49 },
  { day: 'Fri', latency: 68, packetLoss: 3.8, throughput: 6.8, svmRiskCount: 34, dbscanAnomalies: 19, resolvedIncidents: 56 },
  { day: 'Sat', latency: 84, packetLoss: 5.4, throughput: 5.9, svmRiskCount: 41, dbscanAnomalies: 24, resolvedIncidents: 62 },
  { day: 'Sun', latency: 42, packetLoss: 1.8, throughput: 8.4, svmRiskCount: 27, dbscanAnomalies: 14, resolvedIncidents: 42 },
];

export const Analytics: React.FC = () => {
  const [timeframe, setTimeframe] = useState<'24H' | '7D' | '30D' | '90D'>('7D');

  return (
    <div className="p-6 space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
            <BarChart3 className="text-blue-400" size={26} />
            <span>Telecom Network Historical Analytics</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Multi-metric performance telemetry, AI risk degradation trends, and incident resolution velocity over time.
          </p>
        </div>

        {/* Timeframe selector */}
        <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
          {(['24H', '7D', '30D', '90D'] as const).map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 text-xs rounded-md font-semibold transition-all ${
                timeframe === tf
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Analytics Chart Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latency & Packet Loss Chart */}
        <div className="p-6 rounded-xl bg-slate-800/80 border border-slate-700 space-y-4">
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Activity size={18} className="text-red-400" />
            <span>Latency (ms) & Packet Loss (%) Trends</span>
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ANALYTICS_TRENDS}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="day" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }} />
                <Legend />
                <Line type="monotone" dataKey="latency" name="Latency (ms)" stroke="#ef4444" strokeWidth={2} />
                <Line type="monotone" dataKey="packetLoss" name="Packet Loss (%)" stroke="#f59e0b" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Risk & Anomaly Detection Trends */}
        <div className="p-6 rounded-xl bg-slate-800/80 border border-slate-700 space-y-4">
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <TrendingUp size={18} className="text-purple-400" />
            <span>SVM Risk & DBSCAN Anomaly Detection Trends</span>
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ANALYTICS_TRENDS}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="day" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }} />
                <Legend />
                <Bar dataKey="svmRiskCount" name="SVM High Risk Cells" fill="#a855f7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="dbscanAnomalies" name="DBSCAN Outliers" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Throughput Utilization */}
        <div className="p-6 rounded-xl bg-slate-800/80 border border-slate-700 space-y-4">
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Zap size={18} className="text-blue-400" />
            <span>Average Network Throughput (Gbps)</span>
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ANALYTICS_TRENDS}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="day" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }} />
                <Line type="monotone" dataKey="throughput" name="Throughput (Gbps)" stroke="#3b82f6" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Resolved Incidents Volume */}
        <div className="p-6 rounded-xl bg-slate-800/80 border border-slate-700 space-y-4">
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Calendar size={18} className="text-emerald-400" />
            <span>Daily Incident Resolution Volume</span>
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ANALYTICS_TRENDS}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="day" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }} />
                <Bar dataKey="resolvedIncidents" name="Incidents Resolved" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

