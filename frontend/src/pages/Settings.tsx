import React, { useState } from 'react';
import { Settings as SettingsIcon, Sliders, Bell, User, Cpu, Radio, Save, Check, Sun, Moon, Palette } from 'lucide-react';
import { useTelemetry } from '../context/TelemetryContext';
import { useTheme } from '../context/ThemeContext';

export const Settings: React.FC = () => {
  const { isLive, setIsLive } = useTelemetry();
  const { theme, setTheme } = useTheme();
  const [saved, setSaved] = useState(false);

  // Settings State
  const [telemetryFrequency, setTelemetryFrequency] = useState(3);
  const [svmConfidence, setSvmConfidence] = useState(90);
  const [dbscanEpsilon, setDbscanEpsilon] = useState(0.45);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <SettingsIcon className="text-blue-600 dark:text-blue-400" size={26} />
            <span>System Settings</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure theme mode, telemetry frequencies, AI model threshold parameters, and operator preferences.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center gap-2 shadow-sm"
        >
          {saved ? <Check size={16} /> : <Save size={16} />}
          <span>{saved ? 'Settings Saved' : 'Save Configuration'}</span>
        </button>
      </div>

      {/* Section 0: Theme Preference */}
      <div className="p-6 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
          <Palette size={18} className="text-blue-600 dark:text-blue-400" />
          <span>Appearance & Theme Settings</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4 ${
              theme === 'light'
                ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 shadow-sm'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <Sun size={24} />
            </div>
            <div>
              <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Light Mode</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Clean, crisp high-contrast daylight theme</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4 ${
              theme === 'dark'
                ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 shadow-sm'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <div className="p-3 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
              <Moon size={24} />
            </div>
            <div>
              <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Dark Slate Mode</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Low-glare night NOC control room theme</div>
            </div>
          </button>
        </div>
      </div>

      {/* Section 1: Network Monitoring */}
      <div className="p-6 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
          <Radio size={18} className="text-blue-600 dark:text-blue-400" />
          <span>Network Monitoring & Telemetry Configuration</span>
        </h2>

        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Auto-Refresh Real-Time Telemetry Stream</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Periodic telemetry background polling engine</div>
            </div>
            <button
              onClick={() => setIsLive(!isLive)}
              className={`w-12 h-6 rounded-full transition-colors p-1 flex items-center ${
                isLive ? 'bg-blue-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white shadow"></span>
            </button>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex justify-between font-medium text-slate-800 dark:text-slate-200">
              <span>Telemetry Polling Frequency ({telemetryFrequency}s)</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={telemetryFrequency}
              onChange={e => setTelemetryFrequency(Number(e.target.value))}
              className="w-full accent-blue-600 bg-slate-200 dark:bg-slate-900"
            />
          </div>
        </div>
      </div>

      {/* Section 2: AI Models Parameter Tuning */}
      <div className="p-6 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
          <Cpu size={18} className="text-purple-600 dark:text-purple-400" />
          <span>AI Model Engine Parameter Tuning</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div className="space-y-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <div className="font-semibold text-purple-700 dark:text-purple-300 text-sm">SVM Risk Model Classification Threshold</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Minimum confidence required for High Risk trigger: <span className="text-purple-600 dark:text-purple-300 font-bold">{svmConfidence}%</span></div>
            <input
              type="range"
              min={70}
              max={99}
              value={svmConfidence}
              onChange={e => setSvmConfidence(Number(e.target.value))}
              className="w-full accent-purple-600 dark:accent-purple-500"
            />
          </div>

          <div className="space-y-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <div className="font-semibold text-indigo-700 dark:text-indigo-300 text-sm">DBSCAN Clustering Epsilon Parameter</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Maximum spatial cluster distance threshold: <span className="text-indigo-600 dark:text-indigo-300 font-bold">{dbscanEpsilon}</span></div>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.05}
              value={dbscanEpsilon}
              onChange={e => setDbscanEpsilon(Number(e.target.value))}
              className="w-full accent-indigo-600 dark:accent-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Section 3: Operator Account Profile */}
      <div className="p-6 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
          <User size={18} className="text-blue-600 dark:text-blue-400" />
          <span>Operator Credentials & Session</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">Operator Name</label>
            <input type="text" readOnly value="NOC Administrator" className="w-full mt-1.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs" />
          </div>
          <div>
            <label className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">Role Level</label>
            <input type="text" readOnly value="Senior Network Specialist" className="w-full mt-1.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 font-semibold text-xs" />
          </div>
          <div>
            <label className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">Session Status</label>
            <input type="text" readOnly value="Active Session" className="w-full mt-1.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 font-semibold text-xs" />
          </div>
        </div>
      </div>
    </div>
  );
};


