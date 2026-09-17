import React, { useState } from 'react';
import { Settings as SettingsIcon, Sliders, Bell, User, Cpu, Radio, Save, Check } from 'lucide-react';
import { useTelemetry } from '../context/TelemetryContext';

export const Settings: React.FC = () => {
  const { isLive, setIsLive } = useTelemetry();
  const [saved, setSaved] = useState(false);

  // Settings State
  const [telemetryFrequency, setTelemetryFrequency] = useState(3);
  const [svmConfidence, setSvmConfidence] = useState(90);
  const [dbscanEpsilon, setDbscanEpsilon] = useState(0.45);
  const [criticalAlerts, setCriticalAlerts] = useState(true);
  const [anomalyNotify, setAnomalyNotify] = useState(true);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 space-y-6 font-mono max-w-5xl">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
            <SettingsIcon className="text-cyan-400" size={28} />
            <span>NEXUSNET System Settings</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure telemetry frequencies, AI model threshold parameters, alert webhooks & operator credentials
          </p>
        </div>

        <button
          onClick={handleSave}
          className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs transition-colors flex items-center gap-2 shadow-noc-cyan"
        >
          {saved ? <Check size={16} /> : <Save size={16} />}
          <span>{saved ? 'SETTINGS SAVED' : 'SAVE CONFIGURATION'}</span>
        </button>
      </div>

      {/* Section 1: Network Monitoring */}
      <div className="p-6 rounded-xl bg-[#0c1322] border border-[#1e2d4a] space-y-4">
        <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 border-b border-[#1e2d4a] pb-3">
          <Radio size={18} className="text-cyan-400" />
          <span>NETWORK MONITORING TELEMETRY CONFIGURATION</span>
        </h2>

        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-200">Auto Refresh Real-Time Telemetry Stream</div>
              <div className="text-[11px] text-slate-400">Periodic telemetry polling engine</div>
            </div>
            <button
              onClick={() => setIsLive(!isLive)}
              className={`w-12 h-6 rounded-full transition-colors p-1 flex items-center ${
                isLive ? 'bg-cyan-500 justify-end' : 'bg-slate-700 justify-start'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-black"></span>
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between font-bold text-slate-200">
              <span>Telemetry Polling Frequency ({telemetryFrequency}s)</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={telemetryFrequency}
              onChange={e => setTelemetryFrequency(Number(e.target.value))}
              className="w-full accent-cyan-400 bg-slate-800"
            />
          </div>
        </div>
      </div>

      {/* Section 2: AI Models Parameter Tuning */}
      <div className="p-6 rounded-xl bg-[#0c1322] border border-[#1e2d4a] space-y-4">
        <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 border-b border-[#1e2d4a] pb-3">
          <Cpu size={18} className="text-purple-400" />
          <span>AI MODEL ENGINE PARAMETER TUNING</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div className="space-y-3 p-4 rounded-lg bg-[#080d19] border border-purple-500/30">
            <div className="font-bold text-purple-300">SVM Risk Model Classification Threshold</div>
            <div className="text-[11px] text-slate-400">Minimum confidence required for High Risk trigger: {svmConfidence}%</div>
            <input
              type="range"
              min={70}
              max={99}
              value={svmConfidence}
              onChange={e => setSvmConfidence(Number(e.target.value))}
              className="w-full accent-purple-400"
            />
          </div>

          <div className="space-y-3 p-4 rounded-lg bg-[#080d19] border border-indigo-500/30">
            <div className="font-bold text-indigo-300">DBSCAN Clustering Epsilon Parameter</div>
            <div className="text-[11px] text-slate-400">Maximum spatial cluster distance threshold: {dbscanEpsilon}</div>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.05}
              value={dbscanEpsilon}
              onChange={e => setDbscanEpsilon(Number(e.target.value))}
              className="w-full accent-indigo-400"
            />
          </div>
        </div>
      </div>

      {/* Section 3: Operator Account Profile */}
      <div className="p-6 rounded-xl bg-[#0c1322] border border-[#1e2d4a] space-y-4">
        <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 border-b border-[#1e2d4a] pb-3">
          <User size={18} className="text-cyan-400" />
          <span>OPERATOR CREDENTIALS & SESSION</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="text-slate-400 text-[10px]">OPERATOR NAME</label>
            <input type="text" readOnly value="NOC Operator 04" className="w-full mt-1 p-2 rounded bg-[#080d19] border border-[#1e2d4a] text-slate-200" />
          </div>
          <div>
            <label className="text-slate-400 text-[10px]">ROLE LEVEL</label>
            <input type="text" readOnly value="Tier-2 Senior NOC Specialist" className="w-full mt-1 p-2 rounded bg-[#080d19] border border-[#1e2d4a] text-cyan-400 font-bold" />
          </div>
          <div>
            <label className="text-slate-400 text-[10px]">SESSION EXPIRY</label>
            <input type="text" readOnly value="07 Hours 42 Mins Remaining" className="w-full mt-1 p-2 rounded bg-[#080d19] border border-[#1e2d4a] text-emerald-400" />
          </div>
        </div>
      </div>
    </div>
  );
};
