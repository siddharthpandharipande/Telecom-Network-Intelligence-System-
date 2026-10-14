import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Cell as RechartsCell, ResponsiveContainer } from 'recharts';
import { Brain, Activity, ShieldAlert, ArrowRight, CheckCircle2, MapPin, Database } from 'lucide-react';
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
    <div className="p-6 space-y-6">
      {/* Header with Sub-Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#334155] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
            <Activity size={24} className="text-purple-400" />
            <span>AI Model Diagnostics & Risk Prediction</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Unsupervised density-based spatial clustering (DBSCAN) detecting traffic outliers and anomalies.
          </p>
        </div>

        {/* Model Switcher Tabs */}
        <div className="flex items-center p-1 bg-[#0f172a] rounded-xl border border-[#334155]">
          <button
            onClick={() => navigate('/svm')}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all flex items-center gap-2"
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

      {/* Model Metadata Status Banner */}
      <div className="p-4 rounded-xl bg-[#1e293b] border border-[#334155] grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div>
          <div className="text-slate-400 text-[11px]">Algorithm</div>
          <div className="text-sm font-bold text-slate-100 mt-0.5">DBSCAN Density Clustering</div>
        </div>
        <div>
          <div className="text-slate-400 text-[11px]">Hyperparameters</div>
          <div className="text-sm font-bold text-slate-100 mt-0.5">Eps = 0.45, MinPts = 5</div>
        </div>
        <div>
          <div className="text-slate-400 text-[11px]">Density Clusters</div>
          <div className="text-sm font-bold text-purple-400 mt-0.5">18 Clusters Identified</div>
        </div>
        <div>
          <div className="text-slate-400 text-[11px]">Active Evaluated Node</div>
          <div className="text-sm font-bold text-blue-400 mt-0.5">{activeCell.id} ({activeCell.assetType})</div>
        </div>
      </div>

      {/* Primary Diagnostic Assessment Box */}
      <div className="p-6 rounded-2xl bg-[#1e293b] border border-[#334155] shadow-lg space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#334155] pb-4 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30 text-xs font-semibold">
                Cluster Output
              </span>
              <span className="text-xs text-slate-400">Node: {activeCell.name} ({activeCell.region})</span>
            </div>
            <h2 className="text-xl font-bold text-slate-100 mt-1">
              Asset {activeCell.id} Anomaly Clustering
            </h2>
          </div>
          <StatusBadge status={activeCell.dbscanClassification} size="lg" />
        </div>

        {/* Evaluation Output Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-[#0f172a] border border-[#334155]">
            <div className="text-[11px] text-slate-400">DBSCAN Classification</div>
            <div className={`text-lg font-bold mt-1 flex items-center gap-2 ${
              activeCell.dbscanClassification === 'Anomaly' ? 'text-purple-400' : 'text-emerald-400'
            }`}>
              {activeCell.dbscanClassification === 'Anomaly' ? <ShieldAlert size={18} /> : <CheckCircle2 size={18} />}
              <span>{activeCell.dbscanClassification}</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#0f172a] border border-[#334155]">
            <div className="text-[11px] text-slate-400">Anomaly Outlier Score</div>
            <div className={`text-lg font-bold mt-1 ${
              activeCell.dbscanAnomalyScore > 0.7 ? 'text-purple-400' : 'text-emerald-400'
            }`}>
              {activeCell.dbscanAnomalyScore} / 1.00
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#0f172a] border border-[#334155]">
            <div className="text-[11px] text-slate-400">Cluster Assignment</div>
            <div className="text-sm font-semibold text-slate-200 mt-1.5">
              {activeCell.dbscanClassification === 'Anomaly' ? 'Outlier (-1)' : 'Normal Cluster 0'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#0f172a] border border-[#334155]">
            <div className="text-[11px] text-slate-400">SVM Risk Companion</div>
            <div className="text-sm font-semibold text-red-400 mt-1.5">
              {activeCell.svmRiskCategory} ({activeCell.svmRiskScore}%)
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
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center gap-2 shadow-sm"
          >
            <MapPin size={15} />
            <span>Locate Node on Live Map</span>
          </button>
          <button
            onClick={() => navigate('/svm')}
            className="px-5 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-semibold text-xs transition-colors flex items-center gap-2"
          >
            <span>View SVM Risk Classifier</span>
            <ArrowRight size={15} />
          </button>
          {activeCell.dbscanClassification === 'Anomaly' && (
            <button
              onClick={() => {
                createIncident(activeCell.id);
                navigate('/incidents');
              }}
              className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-colors flex items-center gap-2"
            >
              <ShieldAlert size={15} />
              <span>Create Action Incident</span>
            </button>
          )}
        </div>
      </div>

      {/* Cluster Scatter Plot & Outlier Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scatter Plot */}
        <div className="lg:col-span-2 p-6 rounded-xl bg-[#1e293b] border border-[#334155] shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-100">Spatial Density Scatter Cluster Projection</h2>
              <p className="text-xs text-slate-400">Latency vs Traffic Load projection across telecom nodes</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">🟢 Normal Cluster</span>
              <span className="flex items-center gap-1.5 text-blue-400 font-medium">🔵 Dense Traffic Cluster</span>
              <span className="flex items-center gap-1.5 text-purple-400 font-bold">🟣 Outlier Anomalies</span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" dataKey="latency" name="Latency (ms)" unit="ms" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis type="number" dataKey="trafficLoad" name="Traffic Load (%)" unit="%" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
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
        <div className="p-6 rounded-xl bg-[#1e293b] border border-[#334155] shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 mb-1">Detected Outlier Anomalies ({outlierPoints.length})</h3>
            <p className="text-xs text-slate-400">DBSCAN Density Outlier Classifications</p>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1 text-xs">
            {outlierPoints.map(c => (
              <div key={c.id} className="p-3 rounded-lg bg-[#0f172a] border border-[#334155] flex items-center justify-between">
                <div>
                  <div className="font-bold text-purple-400">{c.id} ({c.assetType.toUpperCase()})</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Latency {c.latency}ms | Packet Loss {c.packetLoss}%</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-purple-300">{c.dbscanAnomalyScore}</div>
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

