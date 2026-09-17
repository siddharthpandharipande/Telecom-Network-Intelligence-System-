import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Cell as RechartsCell, ResponsiveContainer } from 'recharts';
import { ScatterChart as ScatterIcon, ShieldAlert, ArrowRight, Activity, Sparkles, Database, CheckCircle2 } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';
import { useTelemetry } from '../context/TelemetryContext';
import { DBSCAN_POINTS } from '../data/mockTelecomData';
import { DBSCANPoint } from '../types/telecom';

export const DBSCANAnomaly: React.FC = () => {
  const navigate = useNavigate();
  const { cells, submittedCell, setSelectedCell, createIncident } = useTelemetry();

  // Active processed asset (submittedCell if available, or selectedCell/default)
  const activeCell = submittedCell || cells.find(c => c.id === 'MH-PN-102') || cells[0];

  // Dynamic scatter data including active cell
  const activePoint: DBSCANPoint = {
    cellId: activeCell.id,
    region: activeCell.region,
    latency: activeCell.latency,
    packetLoss: activeCell.packetLoss,
    trafficLoad: activeCell.trafficLoad,
    cluster: activeCell.dbscanClassification === 'Anomaly' ? -1 : 0,
    clusterName: activeCell.dbscanClassification === 'Anomaly' ? 'Outlier (Severe Anomalous)' : 'Normal Cluster A',
    isOutlier: activeCell.dbscanClassification === 'Anomaly',
    anomalyScore: activeCell.dbscanAnomalyScore
  };

  const scatterData: DBSCANPoint[] = [
    activePoint,
    ...DBSCAN_POINTS.filter(p => p.cellId !== activeCell.id)
  ];

  const outlierPoints = cells.filter(c => c.dbscanClassification === 'Anomaly');

  return (
    <div className="p-6 space-y-6 font-mono">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-indigo-400 font-bold uppercase tracking-widest mb-1">
            <ScatterIcon size={16} />
            <span>STEP 2: UNSUPERVISED ANOMALY CLUSTERING ENGINE</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
            <span>DBSCAN Network Anomaly Detection Results</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Unsupervised density-based spatial clustering classifying company telemetry data into normal density clusters or spatial outliers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/health')}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-black font-extrabold text-xs tracking-wider flex items-center gap-2 shadow-noc-cyan transition-all"
          >
            <span>NEXT: VIEW NETWORK HEALTH →</span>
          </button>
        </div>
      </div>

      {/* Model Metadata Status Banner */}
      <div className="p-4 rounded-xl bg-[#0c1322] border border-[#1e2d4a] grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div>
          <div className="text-slate-400 text-[10px]">ALGORITHM</div>
          <div className="text-sm font-bold text-slate-100">DBSCAN (Density Clustering)</div>
        </div>
        <div>
          <div className="text-slate-400 text-[10px]">HYPERPARAMETERS</div>
          <div className="text-sm font-bold text-slate-100">Eps = 0.45, MinPts = 5</div>
        </div>
        <div>
          <div className="text-slate-400 text-[10px]">DENSITY CLUSTERS</div>
          <div className="text-sm font-bold text-cyan-400">18 Clusters Identified</div>
        </div>
        <div>
          <div className="text-slate-400 text-[10px]">PROCESSED ASSET</div>
          <div className="text-sm font-bold text-[#a855f7]">{activeCell.assetType.toUpperCase()} {activeCell.id}</div>
        </div>
      </div>

      {/* AUTOMATICALLY DISPLAYED SUBMITTED CELL & DBSCAN CLUSTERING RESULT */}
      <div className="p-6 rounded-2xl bg-[#0c1322] border-2 border-indigo-500/60 bg-gradient-to-br from-indigo-950/20 via-[#0c1322] to-[#0c1322] shadow-noc-purple space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-indigo-500/30 pb-4 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/50 text-xs font-extrabold uppercase tracking-widest flex items-center gap-1.5 shadow-noc-purple">
                <Database size={14} className="text-indigo-400 animate-pulse" />
                AUTOMATICALLY PROCESSED COMPANY TELEMETRY
              </span>
              <span className="text-xs text-cyan-400 font-bold">Source: Company Data Input</span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-100 font-mono mt-2">
              ASSET {activeCell.id} — {activeCell.name}
            </h2>
            <p className="text-xs text-slate-400">
              Asset Type: <strong className="text-cyan-300 uppercase">{activeCell.assetType}</strong> | Location: {activeCell.region} | Coords: ({activeCell.lat.toFixed(4)}, {activeCell.lng.toFixed(4)})
            </p>
          </div>
          <StatusBadge status={activeCell.dbscanClassification} size="lg" />
        </div>

        {/* Evaluation Output Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-xl bg-[#080d19] border border-indigo-500/30">
            <div className="text-[10px] text-slate-400">DBSCAN CLASSIFICATION</div>
            <div className={`text-xl font-extrabold mt-0.5 flex items-center gap-1.5 ${
              activeCell.dbscanClassification === 'Anomaly' ? 'text-purple-400' : 'text-emerald-400'
            }`}>
              {activeCell.dbscanClassification === 'Anomaly' ? <ShieldAlert size={20} /> : <CheckCircle2 size={20} />}
              <span>{activeCell.dbscanClassification.toUpperCase()}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#080d19] border border-indigo-500/30">
            <div className="text-[10px] text-slate-400">ANOMALY OUTLIER SCORE</div>
            <div className={`text-xl font-extrabold mt-0.5 ${
              activeCell.dbscanAnomalyScore > 0.7 ? 'text-purple-400' : 'text-emerald-400'
            }`}>
              {activeCell.dbscanAnomalyScore} / 1.00
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#080d19] border border-indigo-500/30">
            <div className="text-[10px] text-slate-400">CLUSTER ASSIGNMENT</div>
            <div className="text-sm font-bold text-slate-200 mt-1">
              {activeCell.dbscanClassification === 'Anomaly' ? 'Outlier (-1)' : 'Normal Cluster 0'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#080d19] border border-indigo-500/30">
            <div className="text-[10px] text-slate-400">SVM COMPANION RESULT</div>
            <div className="text-sm font-bold text-red-400 mt-1">
              {activeCell.svmRiskCategory.toUpperCase()} ({activeCell.svmRiskScore}%)
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={() => {
              setSelectedCell(activeCell);
              navigate('/map');
            }}
            className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs transition-colors shadow-noc-cyan"
          >
            LOCATE ASSET ON LIVE MAP
          </button>
          <button
            onClick={() => navigate('/health')}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs transition-colors flex items-center gap-2"
          >
            <span>VIEW NETWORK HEALTH DASHBOARD</span>
            <ArrowRight size={16} />
          </button>
          {activeCell.dbscanClassification === 'Anomaly' && (
            <button
              onClick={() => {
                createIncident(activeCell.id);
                navigate('/incidents');
              }}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs transition-colors flex items-center gap-2"
            >
              <ShieldAlert size={16} />
              <span>DISPATCH INCIDENT</span>
            </button>
          )}
        </div>
      </div>

      {/* Cluster Scatter Plot & Outlier Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scatter Plot */}
        <div className="lg:col-span-2 p-6 rounded-xl bg-[#0c1322] border border-indigo-500/40 shadow-noc-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-100">SPATIAL DENSITY CLUSTER VISUALIZATION</h2>
              <p className="text-xs text-slate-400">Latency vs Traffic Load projection with submitted asset highlighted</p>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1 text-emerald-400">🟢 Normal Cluster</span>
              <span className="flex items-center gap-1 text-blue-400">🔵 High Traffic Cluster</span>
              <span className="flex items-center gap-1 text-purple-400 font-bold">🟣 Outliers / Anomalies</span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
                <XAxis type="number" dataKey="latency" name="Latency (ms)" unit="ms" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis type="number" dataKey="trafficLoad" name="Traffic Load (%)" unit="%" stroke="#64748b" tick={{ fontSize: 11 }} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ backgroundColor: '#0c1322', borderColor: '#1e2d4a', borderRadius: '8px' }}
                  formatter={(val: any, name: any) => [val, name]}
                />
                <Scatter name="Network Assets" data={scatterData} fill="#8884d8">
                  {scatterData.map((entry, index) => {
                    let fillColor = '#10b981';
                    if (entry.isOutlier || entry.cellId === activeCell.id) fillColor = '#a855f7';
                    else if (entry.cluster === 1) fillColor = '#3b82f6';
                    return <RechartsCell key={`cell-${index}`} fill={fillColor} />;
                  })}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Outliers Summary Table */}
        <div className="p-6 rounded-xl bg-[#0c1322] border border-[#1e2d4a] flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 mb-1">DETECTED ANOMALOUS ASSETS ({outlierPoints.length})</h3>
            <p className="text-xs text-slate-400">DBSCAN Outlier Classifications</p>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1 text-xs">
            {outlierPoints.map(c => (
              <div key={c.id} className="p-2.5 rounded bg-[#080d19] border border-purple-500/30 flex items-center justify-between">
                <div>
                  <div className="font-bold text-purple-400">{c.id} ({c.assetType.toUpperCase()})</div>
                  <div className="text-[10px] text-slate-400">Latency {c.latency}ms | Packet Loss {c.packetLoss}%</div>
                </div>
                <div className="text-right">
                  <div className="font-extrabold text-indigo-300">{c.dbscanAnomalyScore}</div>
                  <StatusBadge status="Anomaly" size="sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
