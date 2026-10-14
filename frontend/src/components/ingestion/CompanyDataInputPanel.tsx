import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Database, CheckCircle2, FileSpreadsheet, ArrowRight, Brain, RefreshCw, Zap, ShieldAlert, Check } from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';
import { TelemetryFormInput, AssetType } from '../../types/telecom';

export const CompanyDataInputPanel: React.FC = () => {
  const navigate = useNavigate();
  const { submitCompanyData, runAiAnalysis, submittedCell, submittedState, cells, setSelectedCell } = useTelemetry();

  const [activeTab, setActiveTab] = useState<'manual' | 'csv'>('manual');
  const [analyzing, setAnalyzing] = useState<boolean>(false);

  // Manual Form State with exact 13 requested telemetry parameters
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
    }, 600);
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
      }, 800);
    }
  };

  const companyIngestedCells = cells.filter(c => c.isCompanyIngested || c.id === 'MH-PN-102');

  return (
    <div className="p-6 rounded-2xl bg-[#1e293b] border border-[#334155] shadow-lg space-y-6">
      {/* Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#334155] pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <Database className="text-blue-400" size={22} />
            <span>Telemetry Data Ingestion</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Input company network telemetry to run SVM Risk Classification and DBSCAN Anomaly Detection models.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-[#0f172a] rounded-xl border border-[#334155]">
          <button
            onClick={() => setActiveTab('manual')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'manual'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Manual Entry
          </button>
          <button
            onClick={() => setActiveTab('csv')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'csv'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            CSV / Excel Upload
          </button>
        </div>
      </div>

      {/* Confirmation & AI Trigger Banner */}
      {(submittedState === 'submitted' || submittedState === 'analyzed') && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex flex-col sm:flex-row items-center justify-between gap-4 transition-all">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={22} className="text-emerald-400 flex-shrink-0" />
            <div>
              <div className="text-sm font-bold text-emerald-300">Data Saved Successfully</div>
              <div className="text-xs text-slate-300 mt-0.5">
                Telemetry record for node <strong className="text-white">{submittedCell?.id}</strong> is ready for AI inference.
              </div>
            </div>
          </div>

          <button
            onClick={handleTriggerAiAnalysis}
            disabled={analyzing}
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 flex-shrink-0 shadow-md"
          >
            {analyzing ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                <span>Running AI Models...</span>
              </>
            ) : (
              <>
                <Brain size={15} />
                <span>Run AI Diagnostics & Model Inference →</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Quick Load Test Presets bar */}
      {activeTab === 'manual' && (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
          <span className="text-slate-700 dark:text-slate-300 font-semibold">Real-Life Test Presets (1-Click Fill & Map Trace):</span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFormData({
                cellId: 'MH-PN-SHIV-901',
                assetType: 'tower',
                latitude: 18.5314,
                longitude: 73.8446,
                location: 'Pune Shivajinagar',
                signalStrength: -106,
                latency: 185,
                packetLoss: 12.4,
                throughput: 4.2,
                connectedUsers: 1850,
                trafficLoad: 96,
                callDropRate: 6.8,
                resourceUtil: 98,
                timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
              })}
              className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-300 border border-red-500/30 text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <ShieldAlert size={14} className="text-red-500" />
              <span>🚨 Pune Shivajinagar (High Risk)</span>
            </button>

            <button
              type="button"
              onClick={() => setFormData({
                cellId: 'MH-MB-MAR-802',
                assetType: 'basestation',
                latitude: 18.9220,
                longitude: 72.8223,
                location: 'Mumbai Marine Drive',
                signalStrength: -102,
                latency: 168,
                packetLoss: 10.8,
                throughput: 3.8,
                connectedUsers: 1940,
                trafficLoad: 97,
                callDropRate: 7.2,
                resourceUtil: 96,
                timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
              })}
              className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-300 border border-red-500/30 text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <ShieldAlert size={14} className="text-red-500" />
              <span>🚨 Mumbai Marine Drive (High Risk)</span>
            </button>

            <button
              type="button"
              onClick={() => setFormData({
                cellId: 'DL-DEL-CP-703',
                assetType: 'router',
                latitude: 28.6315,
                longitude: 77.2167,
                location: 'Delhi Connaught Place',
                signalStrength: -108,
                latency: 192,
                packetLoss: 14.2,
                throughput: 2.5,
                connectedUsers: 2100,
                trafficLoad: 98.5,
                callDropRate: 8.5,
                resourceUtil: 99,
                timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
              })}
              className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-300 border border-red-500/30 text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <ShieldAlert size={14} className="text-red-500" />
              <span>🚨 Delhi Connaught Place (High Risk)</span>
            </button>

            <button
              type="button"
              onClick={() => setFormData({
                cellId: 'KA-BL-101',
                assetType: 'router',
                latitude: 12.9716,
                longitude: 77.5946,
                location: 'Bangalore Indiranagar',
                signalStrength: -65,
                latency: 24,
                packetLoss: 0.3,
                throughput: 260.0,
                connectedUsers: 140,
                trafficLoad: 32,
                callDropRate: 0.2,
                resourceUtil: 38,
                timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
              })}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <Check size={14} className="text-emerald-500" />
              <span>🟢 Bangalore Tech Hub (Healthy)</span>
            </button>
          </div>
        </div>
      )}

      {/* Manual Ingestion Form */}
      {activeTab === 'manual' && (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section 1: Node Metadata & Location */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              1. Node Identification & Geographical Location
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Cell / Tower ID *</label>
                <input
                  type="text"
                  required
                  value={formData.cellId}
                  onChange={e => handleInputChange('cellId', e.target.value)}
                  placeholder="e.g. MH-PN-999"
                  className="w-full p-2.5 rounded-lg bg-[#0f172a] border border-[#334155] focus:border-blue-500 text-slate-100 font-medium focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Asset Type *</label>
                <select
                  value={formData.assetType}
                  onChange={e => handleInputChange('assetType', e.target.value as AssetType)}
                  className="w-full p-2.5 rounded-lg bg-[#0f172a] border border-[#334155] focus:border-blue-500 text-slate-100 font-medium focus:outline-none"
                >
                  <option value="cell">Cell Sector</option>
                  <option value="tower">Macro Cell Tower</option>
                  <option value="basestation">Base Station (gNodeB)</option>
                  <option value="router">Edge Router</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Latitude *</label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  value={formData.latitude}
                  onChange={e => handleInputChange('latitude', Number(e.target.value))}
                  className="w-full p-2.5 rounded-lg bg-[#0f172a] border border-[#334155] focus:border-blue-500 text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Longitude *</label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  value={formData.longitude}
                  onChange={e => handleInputChange('longitude', Number(e.target.value))}
                  className="w-full p-2.5 rounded-lg bg-[#0f172a] border border-[#334155] focus:border-blue-500 text-slate-100 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Network Health & Performance */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              2. Health & Performance Telemetry
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Latency (ms) *</label>
                <input
                  type="number"
                  required
                  value={formData.latency}
                  onChange={e => handleInputChange('latency', Number(e.target.value))}
                  className="w-full p-2.5 rounded-lg bg-[#0f172a] border border-[#334155] focus:border-blue-500 text-slate-100 font-semibold focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Packet Loss (%) *</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={formData.packetLoss}
                  onChange={e => handleInputChange('packetLoss', Number(e.target.value))}
                  className="w-full p-2.5 rounded-lg bg-[#0f172a] border border-[#334155] focus:border-blue-500 text-slate-100 font-semibold focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Signal Strength (dBm)</label>
                <input
                  type="number"
                  value={formData.signalStrength}
                  onChange={e => handleInputChange('signalStrength', Number(e.target.value))}
                  className="w-full p-2.5 rounded-lg bg-[#0f172a] border border-[#334155] focus:border-blue-500 text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Throughput (Mbps)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.throughput}
                  onChange={e => handleInputChange('throughput', Number(e.target.value))}
                  className="w-full p-2.5 rounded-lg bg-[#0f172a] border border-[#334155] focus:border-blue-500 text-slate-100 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Traffic & Resource Utilization */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              3. Traffic Load & Capacity Telemetry
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Connected Users</label>
                <input
                  type="number"
                  value={formData.connectedUsers}
                  onChange={e => handleInputChange('connectedUsers', Number(e.target.value))}
                  className="w-full p-2.5 rounded-lg bg-[#0f172a] border border-[#334155] focus:border-blue-500 text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Traffic Load (%) *</label>
                <input
                  type="number"
                  required
                  value={formData.trafficLoad}
                  onChange={e => handleInputChange('trafficLoad', Number(e.target.value))}
                  className="w-full p-2.5 rounded-lg bg-[#0f172a] border border-[#334155] focus:border-blue-500 text-slate-100 font-semibold focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Call Drop Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.callDropRate}
                  onChange={e => handleInputChange('callDropRate', Number(e.target.value))}
                  className="w-full p-2.5 rounded-lg bg-[#0f172a] border border-[#334155] focus:border-blue-500 text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Resource Utilization (%)</label>
                <input
                  type="number"
                  value={formData.resourceUtil}
                  onChange={e => handleInputChange('resourceUtil', Number(e.target.value))}
                  className="w-full p-2.5 rounded-lg bg-[#0f172a] border border-[#334155] focus:border-blue-500 text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Timestamp *</label>
                <input
                  type="text"
                  required
                  value={formData.timestamp}
                  onChange={e => handleInputChange('timestamp', e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-[#0f172a] border border-[#334155] focus:border-blue-500 text-slate-100 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end pt-3">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md transition-all flex items-center gap-2"
            >
              <CheckCircle2 size={16} />
              <span>Save Telemetry Record</span>
            </button>
          </div>
        </form>
      )}

      {/* CSV Upload Tab */}
      {activeTab === 'csv' && (
        <div className="p-8 rounded-xl bg-[#0f172a] border-2 border-dashed border-[#334155] hover:border-blue-500 transition-all text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-400">
            <FileSpreadsheet size={24} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Upload Telemetry File (.CSV or .XLSX)</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-lg mx-auto">
              Required headers: Cell/Tower ID, Asset Type, Latitude, Longitude, Signal Strength, Latency, Packet Loss, Throughput, Connected Users, Traffic Load, Call Drop Rate, Resource Utilization, Timestamp.
            </p>
          </div>

          <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs cursor-pointer transition-colors shadow-sm">
            <Upload size={16} />
            <span>{uploading ? 'Processing File...' : 'Choose File'}</span>
            <input type="file" accept=".csv, .xlsx" onChange={handleCsvUploadSim} className="hidden" />
          </label>

          {csvFileName && (
            <div className="text-xs text-blue-400 font-medium">
              Uploaded: {csvFileName}
            </div>
          )}
        </div>
      )}

      {/* Ingested Records Inventory Table */}
      <div className="space-y-3 pt-4 border-t border-[#334155]">
        <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
          Ingested Telemetry Inventory ({companyIngestedCells.length} Nodes)
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#334155] text-slate-400 bg-[#0f172a]">
                <th className="p-3 font-semibold">Node ID</th>
                <th className="p-3 font-semibold">Type</th>
                <th className="p-3 font-semibold">Coordinates</th>
                <th className="p-3 font-semibold">Latency</th>
                <th className="p-3 font-semibold">Packet Loss</th>
                <th className="p-3 font-semibold">Traffic Load</th>
                <th className="p-3 font-semibold text-indigo-300">SVM Risk</th>
                <th className="p-3 font-semibold text-purple-300">DBSCAN Anomaly</th>
                <th className="p-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155]">
              {companyIngestedCells.map(cell => (
                <tr key={cell.id} className="hover:bg-[#0f172a]/60 transition-colors">
                  <td className="p-3 font-bold text-blue-400">{cell.id}</td>
                  <td className="p-3 uppercase text-slate-300 font-medium">{cell.assetType}</td>
                  <td className="p-3 text-slate-400 font-mono text-[11px]">{cell.lat.toFixed(4)}, {cell.lng.toFixed(4)}</td>
                  <td className={`p-3 font-semibold ${cell.latency > 100 ? 'text-red-400' : 'text-slate-200'}`}>{cell.latency} ms</td>
                  <td className={`p-3 font-semibold ${cell.packetLoss > 5 ? 'text-red-400' : 'text-slate-200'}`}>{cell.packetLoss}%</td>
                  <td className={`p-3 font-semibold ${cell.trafficLoad > 90 ? 'text-red-400' : 'text-slate-200'}`}>{cell.trafficLoad}%</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      cell.svmRiskCategory === 'At Risk' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {cell.svmRiskCategory} ({cell.svmRiskScore}%)
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      cell.dbscanClassification === 'Anomaly' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {cell.dbscanClassification} ({cell.dbscanAnomalyScore})
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => {
                        setSelectedCell(cell);
                        navigate('/map');
                      }}
                      className="px-2.5 py-1 rounded bg-[#0f172a] hover:bg-blue-600 text-slate-300 hover:text-white font-medium text-[11px] transition-colors border border-[#334155]"
                    >
                      Locate on Map
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

