import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Cpu, ShieldAlert, ArrowRight, HelpCircle, Activity, Sparkles, CheckCircle2, Database } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';
import { useTelemetry } from '../context/TelemetryContext';
import { SVM_INPUT_FACTORS } from '../data/mockTelecomData';

const RISK_DISTRIBUTION = [
  { name: 'Normal (Low Risk)', value: 2102, color: '#10b981' },
  { name: 'At Risk (High Confidence)', value: 384, color: '#ef4444' }
];

export const SVMPrediction: React.FC = () => {
  const navigate = useNavigate();
  const { cells, submittedCell, setSelectedCell, createIncident } = useTelemetry();

  // Active target cell (uses submittedCell if present, or selectedCell/main demo cell)
  const activeCell = submittedCell || cells.find(c => c.id === 'MH-PN-102') || cells[0];
  const highRiskCells = cells.filter(c => c.svmRiskCategory === 'At Risk');

  return (
    <div className="p-6 space-y-6 font-mono">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-purple-400 font-bold uppercase tracking-widest mb-1">
            <Cpu size={16} />
            <span>STEP 2: SUPERVISED AI RISK MODEL</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
            <span>SVM Network Risk Prediction Results</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Supervised Machine Learning classification evaluating company network telemetry data for service degradation risk
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/dbscan')}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs tracking-wider flex items-center gap-2 shadow-noc-purple transition-all"
          >
            <span>NEXT: VIEW DBSCAN ANOMALY →</span>
          </button>
        </div>
      </div>

      {/* Model Metadata Banner */}
      <div className="p-4 rounded-xl bg-[#0c1322] border border-[#1e2d4a] grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div>
          <div className="text-slate-400 text-[10px]">MODEL ARCHITECTURE</div>
          <div className="text-sm font-bold text-slate-100">Support Vector Machine (SVM RBF)</div>
        </div>
        <div>
          <div className="text-slate-400 text-[10px]">CLASSIFICATION OUTPUT</div>
          <div className="text-sm font-bold text-purple-400">NORMAL vs AT RISK</div>
        </div>
        <div>
          <div className="text-slate-400 text-[10px]">MODEL ACCURACY</div>
          <div className="text-sm font-bold text-emerald-400">94.7% F1-Score</div>
        </div>
        <div>
          <div className="text-slate-400 text-[10px]">PROCESSED ASSET</div>
          <div className="text-sm font-bold text-cyan-400">{activeCell.assetType.toUpperCase()} {activeCell.id}</div>
        </div>
      </div>

      {/* AUTOMATICALLY DISPLAYED SUBMITTED CELL & SVM RESULT */}
      <div className="p-6 rounded-2xl bg-[#0c1322] border-2 border-purple-500/60 bg-gradient-to-br from-purple-950/20 via-[#0c1322] to-[#0c1322] shadow-noc-purple space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-purple-500/30 pb-4 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/50 text-xs font-extrabold uppercase tracking-widest flex items-center gap-1.5 shadow-noc-purple">
                <Database size={14} className="text-purple-400 animate-pulse" />
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
          <StatusBadge status={activeCell.svmRiskCategory} size="lg" />
        </div>

        {/* Prediction Metrics Output Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-xl bg-[#080d19] border border-purple-500/30">
            <div className="text-[10px] text-slate-400">SVM PREDICTED RESULT</div>
            <div className={`text-xl font-extrabold mt-0.5 flex items-center gap-1.5 ${
              activeCell.svmRiskCategory === 'At Risk' ? 'text-red-400' : 'text-emerald-400'
            }`}>
              {activeCell.svmRiskCategory === 'At Risk' ? <ShieldAlert size={20} /> : <CheckCircle2 size={20} />}
              <span>{activeCell.svmRiskCategory.toUpperCase()}</span>
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#080d19] border border-purple-500/30">
            <div className="text-[10px] text-slate-400">RISK SCORE</div>
            <div className={`text-xl font-extrabold mt-0.5 ${
              activeCell.svmRiskCategory === 'At Risk' ? 'text-red-400' : 'text-emerald-400'
            }`}>
              {activeCell.svmRiskScore}%
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#080d19] border border-purple-500/30">
            <div className="text-[10px] text-slate-400">CONFIDENCE LEVEL</div>
            <div className="text-xl font-extrabold text-purple-400 mt-0.5">94.7%</div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#080d19] border border-purple-500/30">
            <div className="text-[10px] text-slate-400">MAIN RISK FACTOR</div>
            <div className="text-xs font-bold text-amber-300 mt-1 truncate">{activeCell.svmMainFactor}</div>
          </div>
        </div>

        {/* Analyzed Telemetry Parameter Matrix */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">ANALYZED TELEMETRY PARAMETERS</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-[#080d19] border border-[#1e2d4a]">
              <div className="text-[10px] text-slate-400">LATENCY</div>
              <div className={`text-base font-extrabold ${activeCell.latency > 100 ? 'text-red-400' : 'text-slate-100'}`}>
                {activeCell.latency} ms
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#080d19] border border-[#1e2d4a]">
              <div className="text-[10px] text-slate-400">PACKET LOSS</div>
              <div className={`text-base font-extrabold ${activeCell.packetLoss > 5 ? 'text-red-400' : 'text-slate-100'}`}>
                {activeCell.packetLoss}%
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#080d19] border border-[#1e2d4a]">
              <div className="text-[10px] text-slate-400">TRAFFIC LOAD</div>
              <div className={`text-base font-extrabold ${activeCell.trafficLoad > 90 ? 'text-red-400' : 'text-slate-100'}`}>
                {activeCell.trafficLoad}%
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#080d19] border border-[#1e2d4a]">
              <div className="text-[10px] text-slate-400">THROUGHPUT</div>
              <div className="text-base font-extrabold text-cyan-400">{activeCell.throughput} Mbps</div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#080d19] border border-[#1e2d4a]">
              <div className="text-[10px] text-slate-400">CONNECTED USERS</div>
              <div className="text-base font-extrabold text-slate-100">{activeCell.users.toLocaleString()}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#080d19] border border-[#1e2d4a]">
              <div className="text-[10px] text-slate-400">SIGNAL STRENGTH</div>
              <div className="text-base font-extrabold text-slate-100">{activeCell.signalStrength} dBm</div>
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
            className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs transition-colors shadow-noc-cyan"
          >
            LOCATE ASSET ON LIVE MAP
          </button>
          <button
            onClick={() => navigate('/dbscan')}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs transition-colors flex items-center gap-2"
          >
            <span>VIEW DBSCAN ANOMALY RESULT</span>
            <ArrowRight size={16} />
          </button>
          {activeCell.svmRiskCategory === 'At Risk' && (
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

      {/* Risk Distribution Donut & All Evaluated Cells Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* At Risk Assets List Table */}
        <div className="lg:col-span-2 p-6 rounded-xl bg-[#0c1322] border border-[#1e2d4a] space-y-4">
          <h2 className="text-base font-bold text-slate-100">EVALUATED AT-RISK TELECOM ASSETS</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#1e2d4a] text-slate-400 bg-[#080d19]">
                  <th className="p-3">ASSET ID</th>
                  <th className="p-3">TYPE</th>
                  <th className="p-3">REGION</th>
                  <th className="p-3">RISK SCORE</th>
                  <th className="p-3">PRIMARY DRIVER</th>
                  <th className="p-3">RESULT</th>
                  <th className="p-3 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2d4a]">
                {highRiskCells.map(cell => (
                  <tr key={cell.id} className="hover:bg-[#111b30] transition-colors">
                    <td className="p-3 font-bold text-cyan-400">{cell.id}</td>
                    <td className="p-3 uppercase text-slate-300 font-bold">{cell.assetType}</td>
                    <td className="p-3 text-slate-300">{cell.region}</td>
                    <td className="p-3 font-bold text-purple-400">{cell.svmRiskScore}%</td>
                    <td className="p-3 text-slate-300">{cell.svmMainFactor}</td>
                    <td className="p-3"><StatusBadge status={cell.svmRiskCategory} size="sm" /></td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedCell(cell);
                          navigate('/map');
                        }}
                        className="px-2.5 py-1 rounded bg-[#1e2d4a] hover:bg-cyan-600 text-slate-200 hover:text-black font-bold text-[11px]"
                      >
                        VIEW ON MAP
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Risk Distribution Donut Chart */}
        <div className="p-6 rounded-xl bg-[#0c1322] border border-[#1e2d4a] flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 mb-1">SVM NETWORK RISK DISTRIBUTION</h3>
            <p className="text-xs text-slate-400">Total Classified Assets: {cells.length}</p>
          </div>

          <div className="h-56 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={RISK_DISTRIBUTION}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {RISK_DISTRIBUTION.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0c1322', borderColor: '#1e2d4a', borderRadius: '8px', fontFamily: 'monospace' }}
                  itemStyle={{ color: '#f1f5f9', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded bg-[#080d19]">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span className="text-slate-300">Normal Class</span>
              </span>
              <span className="font-extrabold text-emerald-400">2,102 (84.5%)</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-[#080d19]">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                <span className="text-slate-300">At Risk Class</span>
              </span>
              <span className="font-extrabold text-red-400">384 (15.5%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
