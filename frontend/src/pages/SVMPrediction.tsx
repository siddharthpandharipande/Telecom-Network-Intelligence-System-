import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Brain, ShieldAlert, ArrowRight, CheckCircle2, MapPin, Activity, Sliders } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';
import { useTelemetry } from '../context/TelemetryContext';

const RISK_DISTRIBUTION_COLORS = {
  normal: '#10b981',
  atRisk: '#ef4444'
};

export const SVMPrediction: React.FC = () => {
  const navigate = useNavigate();
  const { cells, submittedCell, setSelectedCell, createIncident } = useTelemetry();

  // Active target cell (uses submittedCell if present, or selectedCell/main demo cell)
  const activeCell = submittedCell || cells.find(c => c.id === 'MH-PN-102') || cells[0];
  const highRiskCells = cells.filter(c => c.svmRiskCategory === 'At Risk');

  // Dynamic Risk Distribution Metrics calculated from active telecom cells
  const normalCount = cells.filter(c => c.svmRiskCategory === 'Normal').length;
  const atRiskCount = cells.filter(c => c.svmRiskCategory === 'At Risk').length;
  const totalCount = cells.length;

  const normalPct = totalCount > 0 ? ((normalCount / totalCount) * 100).toFixed(1) : '0';
  const atRiskPct = totalCount > 0 ? ((atRiskCount / totalCount) * 100).toFixed(1) : '0';

  const dynamicRiskDistribution = [
    { name: 'Normal Operating', value: normalCount, color: RISK_DISTRIBUTION_COLORS.normal },
    { name: 'Predicted At Risk', value: atRiskCount, color: RISK_DISTRIBUTION_COLORS.atRisk }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header with AI Model Sub-Navigation Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#334155] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
            <Brain size={24} className="text-blue-400" />
            <span>AI Model Diagnostics & Risk Prediction</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Supervised SVM Classification and Unsupervised DBSCAN Anomaly Detection inference engines.
          </p>
        </div>

        {/* Model Switcher Tabs */}
        <div className="flex items-center p-1 bg-[#0f172a] rounded-xl border border-[#334155]">
          <button
            onClick={() => navigate('/svm')}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white shadow-sm transition-all flex items-center gap-2"
          >
            <Brain size={14} />
            <span>SVM Risk Prediction</span>
          </button>
          <button
            onClick={() => navigate('/dbscan')}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all flex items-center gap-2"
          >
            <Activity size={14} />
            <span>DBSCAN Anomaly Detection</span>
          </button>
        </div>
      </div>

      {/* Model Metadata Summary */}
      <div className="p-4 rounded-xl bg-[#1e293b] border border-[#334155] grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div>
          <div className="text-slate-400 text-[11px]">Model Architecture</div>
          <div className="text-sm font-bold text-slate-100 mt-0.5">Support Vector Machine (RBF)</div>
        </div>
        <div>
          <div className="text-slate-400 text-[11px]">Classification Target</div>
          <div className="text-sm font-bold text-blue-400 mt-0.5">Normal vs. At Risk</div>
        </div>
        <div>
          <div className="text-slate-400 text-[11px]">Validation Accuracy</div>
          <div className="text-sm font-bold text-emerald-400 mt-0.5">95.5% Test Score</div>
        </div>
        <div>
          <div className="text-slate-400 text-[11px]">Active Evaluated Node</div>
          <div className="text-sm font-bold text-indigo-300 mt-0.5">{activeCell.id} ({activeCell.assetType})</div>
        </div>
      </div>

      {/* Primary Ingestion Node Diagnostics Box */}
      <div className="p-6 rounded-2xl bg-[#1e293b] border border-[#334155] shadow-lg space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#334155] pb-4 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 text-xs font-semibold">
                Inference Result
              </span>
              <span className="text-xs text-slate-400">Node: {activeCell.name} ({activeCell.region})</span>
            </div>
            <h2 className="text-xl font-bold text-slate-100 mt-1">
              Asset {activeCell.id} Diagnostic Assessment
            </h2>
          </div>
          <StatusBadge status={activeCell.svmRiskCategory} size="lg" />
        </div>

        {/* Prediction Metrics Output Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#0f172a] border border-[#334155]">
            <div className="text-[11px] text-slate-400">SVM Predicted Output</div>
            <div className={`text-lg font-bold mt-1 flex items-center gap-2 ${
              activeCell.svmRiskCategory === 'At Risk' ? 'text-red-400' : 'text-emerald-400'
            }`}>
              {activeCell.svmRiskCategory === 'At Risk' ? <ShieldAlert size={18} /> : <CheckCircle2 size={18} />}
              <span>{activeCell.svmRiskCategory}</span>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-[#0f172a] border border-[#334155]">
            <div className="text-[11px] text-slate-400">Risk Score</div>
            <div className={`text-lg font-bold mt-1 ${
              activeCell.svmRiskCategory === 'At Risk' ? 'text-red-400' : 'text-emerald-400'
            }`}>
              {activeCell.svmRiskScore}%
            </div>
          </div>
          <div className="p-4 rounded-xl bg-[#0f172a] border border-[#334155]">
            <div className="text-[11px] text-slate-400">Model Confidence</div>
            <div className="text-lg font-bold text-indigo-400 mt-1">94.7%</div>
          </div>
          <div className="p-4 rounded-xl bg-[#0f172a] border border-[#334155]">
            <div className="text-[11px] text-slate-400">Primary Degradation Driver</div>
            <div className="text-xs font-semibold text-amber-300 mt-1.5 truncate">{activeCell.svmMainFactor}</div>
          </div>
        </div>

        {/* Analyzed Telemetry Parameter Grid */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Analyzed Telemetry Inputs</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
            <div className="p-3 rounded-lg bg-[#0f172a] border border-[#334155]">
              <div className="text-[11px] text-slate-400">Latency</div>
              <div className={`text-sm font-bold mt-0.5 ${activeCell.latency > 100 ? 'text-red-400' : 'text-slate-100'}`}>
                {activeCell.latency} ms
              </div>
            </div>
            <div className="p-3 rounded-lg bg-[#0f172a] border border-[#334155]">
              <div className="text-[11px] text-slate-400">Packet Loss</div>
              <div className={`text-sm font-bold mt-0.5 ${activeCell.packetLoss > 5 ? 'text-red-400' : 'text-slate-100'}`}>
                {activeCell.packetLoss}%
              </div>
            </div>
            <div className="p-3 rounded-lg bg-[#0f172a] border border-[#334155]">
              <div className="text-[11px] text-slate-400">Traffic Load</div>
              <div className={`text-sm font-bold mt-0.5 ${activeCell.trafficLoad > 90 ? 'text-red-400' : 'text-slate-100'}`}>
                {activeCell.trafficLoad}%
              </div>
            </div>
            <div className="p-3 rounded-lg bg-[#0f172a] border border-[#334155]">
              <div className="text-[11px] text-slate-400">Throughput</div>
              <div className="text-sm font-bold text-blue-400 mt-0.5">{activeCell.throughput} Mbps</div>
            </div>
            <div className="p-3 rounded-lg bg-[#0f172a] border border-[#334155]">
              <div className="text-[11px] text-slate-400">Connected Users</div>
              <div className="text-sm font-bold text-slate-100 mt-0.5">{activeCell.users.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded-lg bg-[#0f172a] border border-[#334155]">
              <div className="text-[11px] text-slate-400">Signal Strength</div>
              <div className="text-sm font-bold text-slate-100 mt-0.5">{activeCell.signalStrength} dBm</div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
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
            onClick={() => navigate('/dbscan')}
            className="px-5 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-semibold text-xs transition-colors flex items-center gap-2"
          >
            <span>View DBSCAN Anomaly View</span>
            <ArrowRight size={15} />
          </button>
          {activeCell.svmRiskCategory === 'At Risk' && (
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

      {/* Risk Distribution Donut & All Evaluated Cells Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* At Risk Assets List Table */}
        <div className="lg:col-span-2 p-6 rounded-xl bg-[#1e293b] border border-[#334155] shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-100">Evaluated At-Risk Network Assets</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#334155] text-slate-400 bg-[#0f172a]">
                  <th className="p-3 font-semibold">Node ID</th>
                  <th className="p-3 font-semibold">Type</th>
                  <th className="p-3 font-semibold">Region</th>
                  <th className="p-3 font-semibold">Risk Score</th>
                  <th className="p-3 font-semibold">Primary Driver</th>
                  <th className="p-3 font-semibold">Result</th>
                  <th className="p-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]">
                {highRiskCells.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-slate-400">
                      No 'At Risk' nodes detected in current inventory.
                    </td>
                  </tr>
                ) : (
                  highRiskCells.map(cell => (
                    <tr key={cell.id} className="hover:bg-[#0f172a]/60 transition-colors">
                      <td className="p-3 font-bold text-blue-400">{cell.id}</td>
                      <td className="p-3 uppercase text-slate-300 font-medium">{cell.assetType}</td>
                      <td className="p-3 text-slate-300">{cell.region}</td>
                      <td className="p-3 font-bold text-red-400">{cell.svmRiskScore}%</td>
                      <td className="p-3 text-slate-300">{cell.svmMainFactor}</td>
                      <td className="p-3"><StatusBadge status={cell.svmRiskCategory} size="sm" /></td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedCell(cell);
                            navigate('/map');
                          }}
                          className="px-2.5 py-1 rounded bg-[#0f172a] hover:bg-blue-600 text-slate-300 hover:text-white font-medium text-[11px] transition-colors border border-[#334155]"
                        >
                          View on Map
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Risk Distribution Donut Chart */}
        <div className="p-6 rounded-xl bg-[#1e293b] border border-[#334155] shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 mb-1">SVM Risk Distribution</h3>
            <p className="text-xs text-slate-400">Total Evaluated Nodes: {cells.length}</p>
          </div>

          <div className="h-56 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dynamicRiskDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {dynamicRiskDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
                  itemStyle={{ color: '#f8fafc', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0f172a]">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span className="text-slate-300">Normal Class</span>
              </span>
              <span className="font-bold text-emerald-400">{normalCount.toLocaleString()} ({normalPct}%)</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0f172a]">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                <span className="text-slate-300">At Risk Class</span>
              </span>
              <span className="font-bold text-red-400">{atRiskCount.toLocaleString()} ({atRiskPct}%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

