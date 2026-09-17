import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Database, CheckCircle2, FileSpreadsheet, ArrowRight, Cpu, ScatterChart, ShieldAlert, Sparkles, MapPin, Radio, Layers, Play, RefreshCw } from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';
import { TelemetryFormInput, AssetType } from '../../types/telecom';

export const CompanyDataInputPanel: React.FC = () => {
  const navigate = useNavigate();
  const { submitCompanyData, runAiAnalysis, submittedCell, submittedState, cells, setSelectedCell } = useTelemetry();

  const [activeTab, setActiveTab] = useState<'manual' | 'csv'>('manual');
  const [analyzing, setAnalyzing] = useState<boolean>(false);

  // Manual Form State with exact 13 requested fields
  const [formData, setFormData] = useState<TelemetryFormInput>({
    cellId: 'MH-PN-999',
    assetType: 'cell',
    latitude: 18.5204,
    longitude: 73.8567,
    location: 'Pune',
    signalStrength: -104,
    latency: 182,
    packetLoss: 11.8,
    throughput: 4.2,
    connectedUsers: 1820,
    trafficLoad: 95,
    callDropRate: 6.2,
    resourceUtil: 96,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
  });

  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  const handleInputChange = (field: keyof TelemetryFormInput, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitCompanyData(formData);
  };

  const handleTriggerAiAnalysis = () => {
    setAnalyzing(true);
    setTimeout(() => {
      setAnalyzing(false);
      runAiAnalysis();
      navigate('/svm');
    }, 800);
  };

  const handleCsvUploadSim = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFileName(file.name);
      setUploading(true);
      setTimeout(() => {
        setUploading(false);
        submitCompanyData({
          cellId: 'MH-MB-888',
          assetType: 'tower',
          latitude: 19.0760,
          longitude: 72.8777,
          location: 'Mumbai',
          signalStrength: -102,
          latency: 168,
          packetLoss: 10.2,
          throughput: 3.8,
          connectedUsers: 1940,
          trafficLoad: 96,
          callDropRate: 6.1,
          resourceUtil: 97,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
        });
      }, 1000);
    }
  };

  const companyIngestedCells = cells.filter(c => c.isCompanyIngested || c.id === 'MH-PN-102');

  return (
    <div className="p-6 rounded-2xl bg-[#0c1322] border-2 border-cyan-500/60 bg-gradient-to-b from-[#0c1322] via-[#0e172a] to-[#0c1322] shadow-noc-cyan space-y-6 font-mono relative overflow-hidden">
      {/* Top Banner Gradient */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-400 via-purple-500 to-emerald-400"></div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#1e2d4a] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 text-xs font-extrabold uppercase tracking-widest flex items-center gap-1.5 shadow-noc-cyan">
              <Database size={14} className="text-cyan-400 animate-pulse" />
              COMPANY NETWORK DATA INPUT (STEP 1)
            </span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-100 mt-2">
            Company Telecom Telemetry Ingestion Hub
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Submit network telemetry data once, then run AI analysis to propagate results to SVM, DBSCAN, Health & Live Map.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 bg-[#080d19] p-1.5 rounded-xl border border-[#1e2d4a]">
          <button
            onClick={() => setActiveTab('manual')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'manual'
                ? 'bg-cyan-500 text-black shadow-noc-cyan'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            MANUAL FORM
          </button>
          <button
            onClick={() => setActiveTab('csv')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'csv'
                ? 'bg-cyan-500 text-black shadow-noc-cyan'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            CSV / EXCEL UPLOAD
          </button>
        </div>
      </div>

      {/* State Banner: Data Submitted Successfully & Prominent RUN AI ANALYSIS button */}
      {(submittedState === 'submitted' || submittedState === 'analyzed') && (
        <div className="p-4 rounded-xl bg-cyan-950/40 border-2 border-cyan-500/60 text-cyan-300 text-xs font-mono font-bold flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in duration-300 shadow-noc-cyan">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={24} className="text-emerald-400 animate-bounce flex-shrink-0" />
            <div>
              <div className="text-sm font-extrabold text-emerald-400 uppercase">DATA SUBMITTED SUCCESSFULLY!</div>
              <div className="text-xs text-slate-200 mt-0.5">
                Record for <strong>{submittedCell?.assetType.toUpperCase()} {submittedCell?.id}</strong> saved. Ready for SVM + DBSCAN AI processing.
              </div>
            </div>
          </div>

          <button
            onClick={handleTriggerAiAnalysis}
            disabled={analyzing}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white font-extrabold text-xs tracking-wider shadow-noc-purple transition-all flex items-center justify-center gap-2 flex-shrink-0"
          >
            {analyzing ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>PROCESSING SVM + DBSCAN...</span>
              </>
            ) : (
              <>
                <Cpu size={16} />
                <span>RUN AI ANALYSIS →</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Manual Input Form */}
      {activeTab === 'manual' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
            <span>ENTER TELEMETRY PARAMETERS (EXACT 13 FIELDS)</span>
            <span className="text-cyan-400 text-[10px]">* Required fields</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {/* 1. Cell/Tower ID */}
            <div>
              <label className="text-[11px] text-cyan-400 font-bold block mb-1">Cell/Tower ID *</label>
              <input
                type="text"
                required
                value={formData.cellId}
                onChange={e => handleInputChange('cellId', e.target.value)}
                placeholder="e.g. MH-PN-999"
                className="w-full p-2 rounded-lg bg-[#080d19] border border-[#1e2d4a] focus:border-cyan-400 text-xs text-slate-100 font-bold focus:outline-none"
              />
            </div>

            {/* 2. Asset Type */}
            <div>
              <label className="text-[11px] text-cyan-400 font-bold block mb-1">Asset Type *</label>
              <select
                value={formData.assetType}
                onChange={e => handleInputChange('assetType', e.target.value as AssetType)}
                className="w-full p-2 rounded-lg bg-[#080d19] border border-[#1e2d4a] focus:border-cyan-400 text-xs text-slate-100 font-bold focus:outline-none"
              >
                <option value="cell">Cell ◉</option>
                <option value="tower">Tower 📡</option>
                <option value="basestation">Base Station ▣</option>
                <option value="router">Router ◇</option>
              </select>
            </div>

            {/* 3. Latitude */}
            <div>
              <label className="text-[11px] text-cyan-400 font-bold block mb-1">Latitude *</label>
              <input
                type="number"
                step="0.0001"
                required
                value={formData.latitude}
                onChange={e => handleInputChange('latitude', Number(e.target.value))}
                className="w-full p-2 rounded-lg bg-[#080d19] border border-[#1e2d4a] focus:border-cyan-400 text-xs text-slate-100 font-bold focus:outline-none"
              />
            </div>

            {/* 4. Longitude */}
            <div>
              <label className="text-[11px] text-cyan-400 font-bold block mb-1">Longitude *</label>
              <input
                type="number"
                step="0.0001"
                required
                value={formData.longitude}
                onChange={e => handleInputChange('longitude', Number(e.target.value))}
                className="w-full p-2 rounded-lg bg-[#080d19] border border-[#1e2d4a] focus:border-cyan-400 text-xs text-slate-100 font-bold focus:outline-none"
              />
            </div>

            {/* 5. Signal Strength */}
            <div>
              <label className="text-[11px] text-slate-300 font-bold block mb-1">Signal Strength (dBm)</label>
              <input
                type="number"
                value={formData.signalStrength}
                onChange={e => handleInputChange('signalStrength', Number(e.target.value))}
                className="w-full p-2 rounded-lg bg-[#080d19] border border-[#1e2d4a] focus:border-cyan-400 text-xs text-slate-100 focus:outline-none"
              />
            </div>

            {/* 6. Latency */}
            <div>
              <label className="text-[11px] text-red-400 font-bold block mb-1">Latency (ms) *</label>
              <input
                type="number"
                required
                value={formData.latency}
                onChange={e => handleInputChange('latency', Number(e.target.value))}
                className="w-full p-2 rounded-lg bg-[#080d19] border border-red-500/40 focus:border-red-400 text-xs text-red-400 font-bold focus:outline-none"
              />
            </div>

            {/* 7. Packet Loss */}
            <div>
              <label className="text-[11px] text-red-400 font-bold block mb-1">Packet Loss (%) *</label>
              <input
                type="number"
                step="0.1"
                required
                value={formData.packetLoss}
                onChange={e => handleInputChange('packetLoss', Number(e.target.value))}
                className="w-full p-2 rounded-lg bg-[#080d19] border border-red-500/40 focus:border-red-400 text-xs text-red-400 font-bold focus:outline-none"
              />
            </div>

            {/* 8. Throughput */}
            <div>
              <label className="text-[11px] text-slate-300 font-bold block mb-1">Throughput (Mbps)</label>
              <input
                type="number"
                step="0.1"
                value={formData.throughput}
                onChange={e => handleInputChange('throughput', Number(e.target.value))}
                className="w-full p-2 rounded-lg bg-[#080d19] border border-[#1e2d4a] focus:border-cyan-400 text-xs text-slate-100 focus:outline-none"
              />
            </div>

            {/* 9. Connected Users */}
            <div>
              <label className="text-[11px] text-slate-300 font-bold block mb-1">Connected Users</label>
              <input
                type="number"
                value={formData.connectedUsers}
                onChange={e => handleInputChange('connectedUsers', Number(e.target.value))}
                className="w-full p-2 rounded-lg bg-[#080d19] border border-[#1e2d4a] focus:border-cyan-400 text-xs text-slate-100 focus:outline-none"
              />
            </div>

            {/* 10. Traffic Load */}
            <div>
              <label className="text-[11px] text-amber-400 font-bold block mb-1">Traffic Load (%) *</label>
              <input
                type="number"
                required
                value={formData.trafficLoad}
                onChange={e => handleInputChange('trafficLoad', Number(e.target.value))}
                className="w-full p-2 rounded-lg bg-[#080d19] border border-amber-500/40 focus:border-amber-400 text-xs text-amber-400 font-bold focus:outline-none"
              />
            </div>

            {/* 11. Call Drop Rate */}
            <div>
              <label className="text-[11px] text-slate-300 font-bold block mb-1">Call Drop Rate (%)</label>
              <input
                type="number"
                step="0.1"
                value={formData.callDropRate}
                onChange={e => handleInputChange('callDropRate', Number(e.target.value))}
                className="w-full p-2 rounded-lg bg-[#080d19] border border-[#1e2d4a] focus:border-cyan-400 text-xs text-slate-100 focus:outline-none"
              />
            </div>

            {/* 12. Resource Utilization */}
            <div>
              <label className="text-[11px] text-slate-300 font-bold block mb-1">Resource Util (%)</label>
              <input
                type="number"
                value={formData.resourceUtil}
                onChange={e => handleInputChange('resourceUtil', Number(e.target.value))}
                className="w-full p-2 rounded-lg bg-[#080d19] border border-[#1e2d4a] focus:border-cyan-400 text-xs text-slate-100 focus:outline-none"
              />
            </div>

            {/* 13. Timestamp */}
            <div className="col-span-2">
              <label className="text-[11px] text-slate-300 font-bold block mb-1">Timestamp *</label>
              <input
                type="text"
                required
                value={formData.timestamp}
                onChange={e => handleInputChange('timestamp', e.target.value)}
                className="w-full p-2 rounded-lg bg-[#080d19] border border-[#1e2d4a] focus:border-cyan-400 text-xs text-slate-100 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-[11px] text-slate-400">
              Clicking submit saves telemetry data to the session store.
            </div>
            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs font-mono tracking-wider shadow-noc-cyan transition-all flex items-center gap-2"
            >
              <span>SUBMIT NETWORK DATA</span>
              <CheckCircle2 size={16} />
            </button>
          </div>
        </form>
      )}

      {/* CSV/Excel Tab */}
      {activeTab === 'csv' && (
        <div className="p-8 rounded-xl bg-[#080d19] border-2 border-dashed border-[#1e2d4a] hover:border-cyan-400/80 transition-all text-center space-y-4 font-mono">
          <div className="w-14 h-14 rounded-full bg-cyan-500/10 border border-cyan-400/40 flex items-center justify-center mx-auto text-cyan-400 shadow-noc-cyan">
            <FileSpreadsheet size={28} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Upload Company Telecom Telemetry Dataset (.CSV / .XLSX)</h3>
            <p className="text-xs text-slate-400 mt-1">
              File must contain columns: Cell/Tower ID, Asset Type, Latitude, Longitude, Signal Strength, Latency, Packet Loss, Throughput, Connected Users, Traffic Load, Call Drop Rate, Resource Utilization, Timestamp.
            </p>
          </div>

          <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs font-mono cursor-pointer transition-colors shadow-noc-cyan">
            <Upload size={16} />
            <span>{uploading ? 'INGESTING TELEMETRY DATA...' : 'SELECT CSV / EXCEL FILE'}</span>
            <input type="file" accept=".csv, .xlsx" onChange={handleCsvUploadSim} className="hidden" />
          </label>

          {csvFileName && (
            <div className="text-xs text-cyan-300 font-mono">
              Uploaded File: <strong>{csvFileName}</strong>
            </div>
          )}
        </div>
      )}

      {/* Submitted Company Data Table */}
      <div className="space-y-3 pt-3 border-t border-[#1e2d4a]">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2 font-mono">
            <span>SUBMITTED COMPANY NETWORK TELEMETRY RECORDS</span>
            <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px]">
              {companyIngestedCells.length} ASSETS IN AI PIPELINE
            </span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="border-b border-[#1e2d4a] text-slate-400 bg-[#080d19]">
                <th className="p-2.5">ASSET ID</th>
                <th className="p-2.5">TYPE</th>
                <th className="p-2.5">LAT / LNG</th>
                <th className="p-2.5">LATENCY</th>
                <th className="p-2.5">PACKET LOSS</th>
                <th className="p-2.5">TRAFFIC LOAD</th>
                <th className="p-2.5 text-purple-300">SVM RISK</th>
                <th className="p-2.5 text-indigo-300">DBSCAN ANOMALY</th>
                <th className="p-2.5">TIMESTAMP</th>
                <th className="p-2.5 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2d4a]">
              {companyIngestedCells.map(cell => (
                <tr key={cell.id} className="hover:bg-[#111b30] transition-colors">
                  <td className="p-2.5 font-bold text-cyan-400">{cell.id}</td>
                  <td className="p-2.5 uppercase font-bold text-slate-300">{cell.assetType}</td>
                  <td className="p-2.5 text-slate-400">{cell.lat.toFixed(4)}, {cell.lng.toFixed(4)}</td>
                  <td className={`p-2.5 font-bold ${cell.latency > 100 ? 'text-red-400' : 'text-slate-200'}`}>{cell.latency} ms</td>
                  <td className={`p-2.5 font-bold ${cell.packetLoss > 5 ? 'text-red-400' : 'text-slate-200'}`}>{cell.packetLoss}%</td>
                  <td className={`p-2.5 font-bold ${cell.trafficLoad > 90 ? 'text-red-400' : 'text-slate-200'}`}>{cell.trafficLoad}%</td>
                  <td className="p-2.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      cell.svmRiskCategory === 'At Risk' ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {cell.svmRiskCategory} ({cell.svmRiskScore}%)
                    </span>
                  </td>
                  <td className="p-2.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      cell.dbscanClassification === 'Anomaly' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {cell.dbscanClassification} ({cell.dbscanAnomalyScore})
                    </span>
                  </td>
                  <td className="p-2.5 text-slate-400">{cell.timestamp || cell.lastUpdated}</td>
                  <td className="p-2.5 text-right">
                    <button
                      onClick={() => {
                        setSelectedCell(cell);
                        navigate('/map');
                      }}
                      className="px-2 py-1 rounded bg-[#1e2d4a] hover:bg-cyan-500 hover:text-black font-bold text-[10px] transition-colors"
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
    </div>
  );
};
