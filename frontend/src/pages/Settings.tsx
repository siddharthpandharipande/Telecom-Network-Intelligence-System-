import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings as SettingsIcon,
  Sliders,
  User,
  Cpu,
  Radio,
  Sun,
  Moon,
  Palette,
  Activity,
  Info,
  RefreshCw,
  Shield,
  Layers,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useConfig } from '../api/hooks';
import { getDbscanExplore } from '../api/client';
import { DbscanExploreResponse } from '../types/api';

export const Settings: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { config } = useConfig();

  // DBSCAN Exploration State (explore-only preview)
  const [exploreEps, setExploreEps] = useState<number>(1.6);
  const [exploreMinSamples, setExploreMinSamples] = useState<number>(16);
  const [exploreResult, setExploreResult] = useState<DbscanExploreResponse | null>(null);
  const [loadingExplore, setLoadingExplore] = useState<boolean>(false);

  const runExplore = useCallback(async (eps: number, minSamples: number) => {
    setLoadingExplore(true);
    try {
      const res = await getDbscanExplore(eps, minSamples);
      setExploreResult(res);
    } catch (err: any) {
      console.error('Failed to run DBSCAN explore:', err);
    } finally {
      setLoadingExplore(false);
    }
  }, []);

  useEffect(() => {
    runExplore(exploreEps, exploreMinSamples);
  }, [exploreEps, exploreMinSamples, runExplore]);

  return (
    <div className="p-6 space-y-6 max-w-4xl font-sans">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <SettingsIcon className="text-blue-600 dark:text-blue-400" size={26} />
            <span>Prototype Settings & Model Tuning</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Display preferences, deployed model hyperparameter specifications, and DBSCAN parameter space exploration.
          </p>
        </div>
      </div>

      {/* Section 1: Theme Preference */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
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

      {/* Section 2: DBSCAN Hyperparameter Exploration (/api/dbscan/explore preview) */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Sliders size={18} className="text-purple-600 dark:text-purple-400" />
            <span>DBSCAN Sensitivity Explorer (Preview)</span>
          </h2>
          <span className="text-[11px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30 font-medium">
            Preview, does not change the deployed model
          </span>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Interactively test how changing clustering radius (eps) and density threshold (min_samples) affects noise outlier detection across all 6,000 dataset rows via the <code>/api/dbscan/explore</code> endpoint.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 text-xs">
          {/* Eps Slider */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Epsilon Radius (eps): <span className="text-purple-600 dark:text-purple-400 font-mono text-sm">{exploreEps.toFixed(2)}</span>
              </span>
              <span className="text-[10px] text-slate-500">Shipped: 1.60</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={2.5}
              step={0.05}
              value={exploreEps}
              onChange={(e) => setExploreEps(parseFloat(e.target.value))}
              className="w-full accent-purple-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>0.50 (Dense / Strict)</span>
              <span>1.60 (Shipped)</span>
              <span>2.50 (Loose)</span>
            </div>
          </div>

          {/* Min Samples Slider */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Minimum Samples (min_samples): <span className="text-purple-600 dark:text-purple-400 font-mono text-sm">{exploreMinSamples}</span>
              </span>
              <span className="text-[10px] text-slate-500">Shipped: 16</span>
            </div>
            <input
              type="range"
              min={5}
              max={30}
              step={1}
              value={exploreMinSamples}
              onChange={(e) => setExploreMinSamples(parseInt(e.target.value))}
              className="w-full accent-purple-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>5 samples</span>
              <span>16 (Shipped)</span>
              <span>30 samples</span>
            </div>
          </div>
        </div>

        {/* Exploration Results Box */}
        {exploreResult && (
          <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Tested Parameters</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                eps={exploreResult.eps}, min={exploreResult.min_samples}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Formed Clusters</span>
              <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                {exploreResult.n_clusters} clusters
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Outlier / Noise Count</span>
              <span className="font-mono font-bold text-red-500">
                {exploreResult.noise_count} assets
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Noise Percentage</span>
              <span className="font-mono font-bold text-red-500">
                {exploreResult.noise_pct.toFixed(2)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Section 3: Deployed Model Parameters (Read-Only) */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
          <Cpu size={18} className="text-blue-600 dark:text-blue-400" />
          <span>Deployed Production Model Configuration (/api/config)</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2">
            <span className="font-semibold text-blue-600 dark:text-blue-400 block">SVM Classifier Specification</span>
            <div className="space-y-1 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
              <div>Kernel: RBF (Radial Basis Function)</div>
              <div>C: 10 &bull; Gamma: 0.10 &bull; class_weight: balanced</div>
              <div>Numeric Features: {config?.svm_features?.numeric?.length || 9} dimensions</div>
              <div>Label Policy: {config?.label?.name || 'Legacy5'}</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2">
            <span className="font-semibold text-purple-600 dark:text-purple-400 block">DBSCAN Anomaly Detector Specification</span>
            <div className="space-y-1 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
              <div>Epsilon (eps): {config?.dbscan?.eps || 1.6}</div>
              <div>Min Samples: {config?.dbscan?.min_samples || 16}</div>
              <div>Features: {config?.dbscan?.features?.length || 8} standardized dimensions</div>
              <div>Distance Metric: Euclidean on StandardScaler features</div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Authentication & Security Note */}
      <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 space-y-1.5">
        <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
          <Shield size={16} className="text-blue-500" />
          <span>Authentication Notice</span>
        </div>
        <p>
          No user authentication or session management is implemented in this academic college prototype. All NOC operator actions (acknowledgement, investigation, assignment, resolution) are executed in unauthenticated local operator mode against the FastAPI SQLite persistence backend.
        </p>
      </div>
    </div>
  );
};
