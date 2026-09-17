import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Cpu, ScatterChart, ShieldAlert, Radio, Activity, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';
import { useTelemetry } from '../context/TelemetryContext';
import { CompanyDataInputPanel } from '../components/ingestion/CompanyDataInputPanel';

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
  const [timeFilter, setTimeFilter] = useState<'1H' | '6H' | '12H' | '24H' | '7D'>('24H');

  const atRiskCellsCount = cells.filter(c => c.svmRiskCategory === 'At Risk').length;
  const anomalyCellsCount = cells.filter(c => c.dbscanClassification === 'Anomaly').length;

  return (
    <div className="p-6 space-y-6">
      {/* Title Header with Pipeline Visualizer */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-cyan-400 font-bold uppercase tracking-widest mb-1">
            <Radio size={16} />
            <span>AI-POWERED TELECOM NOC OPERATIONS ENGINE</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight font-mono">
            Network Command Center
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Ingest company telemetry → Execute SVM + DBSCAN AI Models → Monitor Network Health → Visualize Interactive Live Map
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate('/data-input')}
            className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs font-mono tracking-wider flex items-center gap-2 shadow-noc-cyan transition-all"
          >
            <span>INGEST COMPANY DATA</span>
            <ArrowRight size={16} />
          </button>
          <button
            onClick={() => navigate('/map')}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-extrabold text-xs font-mono tracking-wider flex items-center gap-2 shadow-noc-purple transition-all"
          >
            <span>LAUNCH LIVE MAP</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Complete Data Flow Visualizer Header */}
      <div className="p-3.5 rounded-xl bg-[#0c1322] border-2 border-cyan-500/40 font-mono text-xs flex flex-wrap items-center justify-between gap-2 shadow-noc-card">
        <span className="text-cyan-400 font-extrabold uppercase tracking-wider">COMPLETE DATA PIPELINE FLOW:</span>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span
            onClick={() => navigate('/data-input')}
            className="px-3 py-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 font-extrabold cursor-pointer hover:bg-cyan-500/30 transition-colors"
          >
            1. Company Data Input
          </span>
          <span className="text-slate-400 font-bold">➔</span>
          <span
            onClick={() => navigate('/svm')}
            className="px-3 py-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/50 font-extrabold cursor-pointer hover:bg-purple-500/30 transition-colors"
          >
            2. SVM + DBSCAN AI
          </span>
          <span className="text-slate-400 font-bold">➔</span>
          <span
            onClick={() => navigate('/health')}
            className="px-3 py-1 rounded bg-blue-500/20 text-blue-300 border border-blue-500/50 font-extrabold cursor-pointer hover:bg-blue-500/30 transition-colors"
          >
            3. Health Dashboard
          </span>
          <span className="text-slate-400 font-bold">➔</span>
          <span
            onClick={() => navigate('/map')}
            className="px-3 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 font-extrabold cursor-pointer hover:bg-emerald-500/30 transition-colors"
          >
            4. Live Interactive Map
          </span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="p-4 rounded-xl bg-[#0c1322] border border-[#1e2d4a] shadow-noc-card">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-1">
            <span>TOTAL CELLS</span>
            <Radio size={16} className="text-cyan-400" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-slate-100">2,486</div>
          <div className="text-[10px] text-emerald-400 font-mono mt-1">▲ 12 added</div>
        </div>

        <div className="p-4 rounded-xl bg-[#0c1322] border border-[#1e2d4a] shadow-noc-card">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-1">
            <span>ACTIVE CELLS</span>
            <CheckCircle2 size={16} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-emerald-400">2,451</div>
          <div className="text-[10px] text-slate-400 font-mono mt-1">98.6% Operational</div>
        </div>

        <div className="p-4 rounded-xl bg-[#0c1322] border border-purple-500/40 bg-purple-950/10 shadow-noc-purple">
          <div className="flex items-center justify-between text-purple-300 text-xs font-mono mb-1">
            <span>AT-RISK CELLS</span>
            <Cpu size={16} className="text-purple-400" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-purple-400">27</div>
          <div className="text-[10px] text-purple-300 font-mono mt-1">SVM High Confidence</div>
        </div>

        <div className="p-4 rounded-xl bg-[#0c1322] border border-indigo-500/40 bg-indigo-950/10 shadow-noc-card">
          <div className="flex items-center justify-between text-indigo-300 text-xs font-mono mb-1">
            <span>ANOMALOUS CELLS</span>
            <ScatterChart size={16} className="text-indigo-400" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-indigo-400">14</div>
          <div className="text-[10px] text-indigo-300 font-mono mt-1">DBSCAN Outliers</div>
        </div>

        <div className="p-4 rounded-xl bg-[#0c1322] border border-amber-500/40 bg-amber-950/10">
          <div className="flex items-center justify-between text-amber-300 text-xs font-mono mb-1">
            <span>ACTIVE ALERTS</span>
            <AlertTriangle size={16} className="text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-amber-400">{alerts.filter(a => a.status !== 'Resolved').length}</div>
          <div className="text-[10px] text-amber-300 font-mono mt-1">Telemetry Monitor</div>
        </div>

        <div className="p-4 rounded-xl bg-[#0c1322] border border-red-500/50 bg-red-950/10 shadow-noc-red">
          <div className="flex items-center justify-between text-red-300 text-xs font-mono mb-1">
            <span>CRITICAL INCIDENTS</span>
            <ShieldAlert size={16} className="text-red-400" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-red-400">{incidents.filter(i => i.status !== 'RESOLVED').length}</div>
          <div className="text-[10px] text-red-300 font-mono mt-1">Immediate Action</div>
        </div>
      </div>

      {/* Prominent Telecom Company Network Data Input Panel */}
      <CompanyDataInputPanel />

      {/* Main Performance Chart */}
      <div className="p-6 rounded-xl bg-[#0c1322] border border-[#1e2d4a] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-100 font-mono flex items-center gap-2">
              <Activity size={18} className="text-cyan-400" />
              <span>NETWORK PERFORMANCE TELEMETRY</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono">Live latency, packet loss, traffic load & throughput trends</p>
          </div>

          <div className="flex items-center gap-1 bg-[#080d19] p-1 rounded-lg border border-[#1e2d4a]">
            {(['1H', '6H', '12H', '24H', '7D'] as const).map(tf => (
              <button
                key={tf}
                onClick={() => setTimeFilter(tf)}
                className={`px-2.5 py-1 text-xs font-mono rounded ${
                  timeFilter === tf
                    ? 'bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={PERFORMANCE_DATA} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#00f0ff" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
              <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 11, fontFamily: 'monospace' }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11, fontFamily: 'monospace' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0c1322', borderColor: '#1e2d4a', borderRadius: '8px', fontFamily: 'monospace' }}
                itemStyle={{ color: '#f1f5f9', fontSize: '12px' }}
              />
              <Area type="monotone" dataKey="latency" name="Latency (ms)" stroke="#ef4444" fillOpacity={1} fill="url(#colorLatency)" />
              <Area type="monotone" dataKey="load" name="Traffic Load (%)" stroke="#00f0ff" fillOpacity={1} fill="url(#colorLoad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AI Summary Cards & Live Events */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SVM Card */}
        <div className="p-6 rounded-xl bg-[#0c1322] border border-purple-500/40 bg-gradient-to-b from-purple-950/20 to-[#0c1322] space-y-4 flex flex-col justify-between shadow-noc-purple">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Cpu size={14} />
                SVM MODEL
              </span>
              <StatusBadge status="High" size="sm" />
            </div>

            <h3 className="text-lg font-bold text-slate-100 font-mono">Network Risk Prediction</h3>
            <p className="text-xs text-slate-300 font-mono leading-relaxed">
              Supervised machine learning model classifying cells at risk of network degradation before customer failure occurs.
            </p>

            <div className="p-3 rounded-lg bg-[#080d19] border border-purple-500/30 flex items-center justify-between font-mono">
              <div>
                <div className="text-[10px] text-slate-400">CLASSIFIED AT-RISK</div>
                <div className="text-xl font-extrabold text-purple-400">{atRiskCellsCount} Cells</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400">PREDICTION CONFIDENCE</div>
                <div className="text-base font-extrabold text-slate-200">94.7%</div>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/svm')}
            className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold transition-colors flex items-center justify-center gap-2"
          >
            <span>VIEW SVM ANALYSIS</span>
            <ArrowRight size={16} />
          </button>
        </div>

        {/* DBSCAN Card */}
        <div className="p-6 rounded-xl bg-[#0c1322] border border-indigo-500/40 bg-gradient-to-b from-indigo-950/20 to-[#0c1322] space-y-4 flex flex-col justify-between shadow-noc-card">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                <ScatterChart size={14} />
                DBSCAN MODEL
              </span>
              <StatusBadge status="Outlier" size="sm" />
            </div>

            <h3 className="text-lg font-bold text-slate-100 font-mono">Network Anomaly Detection</h3>
            <p className="text-xs text-slate-300 font-mono leading-relaxed">
              Unsupervised clustering model discovering unexpected traffic behavior and spatial density outliers across the grid.
            </p>

            <div className="p-3 rounded-lg bg-[#080d19] border border-indigo-500/30 flex items-center justify-between font-mono">
              <div>
                <div className="text-[10px] text-slate-400">OUTLIER ANOMALIES</div>
                <div className="text-xl font-extrabold text-indigo-400">{anomalyCellsCount} Anomalies</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400">IDENTIFIED CLUSTERS</div>
                <div className="text-base font-extrabold text-slate-200">18 Clusters</div>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/dbscan')}
            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-bold transition-colors flex items-center justify-center gap-2"
          >
            <span>VIEW DBSCAN ANALYSIS</span>
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Live Events Stream */}
        <div className="p-6 rounded-xl bg-[#0c1322] border border-[#1e2d4a] space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#1e2d4a] pb-3 mb-3">
              <h3 className="text-base font-bold text-slate-100 font-mono flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
                <span>LIVE TELEMETRY EVENTS</span>
              </h3>
              <span className="text-[10px] text-cyan-400 font-mono">● STREAM</span>
            </div>

            <div className="space-y-2.5 font-mono text-xs">
              <div
                onClick={() => {
                  const target = cells.find(c => c.id === 'MH-PN-102');
                  if (target) setSelectedCell(target);
                  navigate('/map');
                }}
                className="p-2.5 rounded bg-red-950/20 border border-red-500/40 hover:bg-red-950/40 cursor-pointer transition-colors space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-red-400 font-bold">🔴 MH-PN-102 — High Network Risk</span>
                  <span className="text-[10px] text-slate-400">15:38</span>
                </div>
                <p className="text-[11px] text-slate-300">Pune Central: Latency 182ms | Packet Loss 11.8%</p>
              </div>

              <div className="p-2.5 rounded bg-purple-950/20 border border-purple-500/40 hover:bg-purple-950/40 cursor-pointer transition-colors space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-purple-400 font-bold">🟣 MH-DL-201 — DBSCAN Anomaly</span>
                  <span className="text-[10px] text-slate-400">15:34</span>
                </div>
                <p className="text-[11px] text-slate-300">Delhi Hub: Spatial cluster distance score 0.88 outlier</p>
              </div>

              <div className="p-2.5 rounded bg-amber-950/20 border border-amber-500/40 hover:bg-amber-950/40 cursor-pointer transition-colors space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-amber-400 font-bold">🟠 MH-MB-417 — Traffic Congestion</span>
                  <span className="text-[10px] text-slate-400">15:29</span>
                </div>
                <p className="text-[11px] text-slate-300">Mumbai Marine Drive: 1,420 users (88% load)</p>
              </div>

              <div className="p-2.5 rounded bg-yellow-950/20 border border-yellow-500/40 hover:bg-yellow-950/40 cursor-pointer transition-colors space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-yellow-400 font-bold">🟡 RT-MH-PN-84 — Elevated Latency</span>
                  <span className="text-[10px] text-slate-400">15:15</span>
                </div>
                <p className="text-[11px] text-slate-300">Pune Edge Router 84: Buffer overflow warning</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/incidents')}
            className="w-full py-2 rounded-lg bg-[#111b30] hover:bg-[#1a2944] border border-[#1e2d4a] text-slate-300 font-mono text-xs font-semibold transition-colors mt-2"
          >
            VIEW ALL INCIDENTS
          </button>
        </div>
      </div>
    </div>
  );
};
