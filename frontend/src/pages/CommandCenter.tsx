import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getLatestAnalysis } from '../api/client';
import { TelemetryAnalysisResponse } from '../types/api';

export const CommandCenter: React.FC = () => {
  const navigate = useNavigate();

  const [analysis, setAnalysis] = useState<TelemetryAnalysisResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. First check backend for latest manual telemetry analysis
      const backendLatest = await getLatestAnalysis();
      if (backendLatest) {
        setAnalysis(backendLatest);
        localStorage.setItem('nexusnet_latest_analysis', JSON.stringify(backendLatest));
      } else {
        // 2. Fall back to localStorage if available
        const localSaved = localStorage.getItem('nexusnet_latest_analysis');
        if (localSaved) {
          try {
            setAnalysis(JSON.parse(localSaved));
          } catch {
            setAnalysis(null);
          }
        } else {
          setAnalysis(null);
        }
      }
    } catch (err: any) {
      console.error('Failed to load telemetry analysis from backend:', err);
      // Attempt local recovery
      const localSaved = localStorage.getItem('nexusnet_latest_analysis');
      if (localSaved) {
        try {
          setAnalysis(JSON.parse(localSaved));
        } catch {
          setError(
            err?.message ||
              'Failed to connect to backend telemetry service. Ensure backend is running at http://127.0.0.1:8000.'
          );
        }
      } else {
        setError(
          err?.message ||
            'Failed to connect to backend telemetry service. Ensure backend is running at http://127.0.0.1:8000.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalysis();

    // Listen for manual analysis submissions from other pages or tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'nexusnet_latest_analysis' && e.newValue) {
        try {
          setAnalysis(JSON.parse(e.newValue));
        } catch {}
      }
    };
    const handleCustomEvent = () => {
      fetchAnalysis();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('nexusnet_telemetry_analyzed', handleCustomEvent);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('nexusnet_telemetry_analyzed', handleCustomEvent);
    };
  }, [fetchAnalysis]);

  // Priority color styling helper
  const getPriorityBadgeClass = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'medium':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'routine':
      case 'low':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getFlagBadgeClass = (flag: string) => {
    if (flag.toLowerCase() === 'investigate') {
      return 'bg-rose-600 text-white';
    }
    return 'bg-emerald-700 text-white';
  };

  // --------------------------------------------------------------------------
  // Loading State
  // --------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto flex flex-col gap-8 animate-pulse p-4">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <div className="h-7 w-64 bg-slate-200 rounded-lg mb-2" />
            <div className="h-4 w-96 bg-slate-100 rounded" />
          </div>
          <div className="h-8 w-32 bg-slate-200 rounded-full" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="h-80 bg-slate-100 rounded-[24px] p-6 border border-slate-200" />
          <div className="h-80 bg-slate-100 rounded-[24px] p-6 border border-slate-200" />
        </div>

        <div className="h-80 bg-slate-100 rounded-[24px] p-6 border border-slate-200" />
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Error State (Backend Unavailable)
  // --------------------------------------------------------------------------
  if (error && !analysis) {
    return (
      <div className="w-full max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[500px] p-6">
        <div className="w-full max-w-xl bg-white rounded-[24px] p-8 border border-rose-200 shadow-xl text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[36px]">error</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            NOC Telemetry Service Unavailable
          </h2>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            {error || 'Unable to retrieve telemetry insights from the backend.'}
          </p>
          <button
            onClick={fetchAnalysis}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            <span>Retry Connection</span>
          </button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Empty State: No Manual Analysis Performed Yet
  // --------------------------------------------------------------------------
  if (!analysis) {
    return (
      <div className="w-full max-w-7xl mx-auto flex flex-col gap-8 pb-12 animate-page-transition">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              NOC Command Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal">
              Decision Support for Manual Telemetry Analysis
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Awaiting Manual Input</span>
          </div>
        </div>

        {/* Empty State Banner */}
        <div className="w-full bg-white rounded-[28px] p-10 md:p-14 border border-slate-200/80 shadow-[0_4px_24px_-2px_rgba(15,23,42,0.04)] text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-5">
            <span className="material-symbols-outlined text-[36px]">biotech</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-3">
            No manual analysis has been performed yet. Submit telemetry in Analyze Telemetry to generate insights.
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto mb-8 leading-relaxed">
            Input asset measurements into the manual telemetry engine to evaluate SLA boundaries,
            classify operational risk, identify recommended NOC actions, and pinpoint geographic coordinates.
          </p>
          <Link
            to="/analyze-telemetry"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-slate-900 hover:bg-purple-900 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">play_circle</span>
            <span>Open Analyze Telemetry</span>
          </Link>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Active Manual Analysis Three-Box Layout
  // --------------------------------------------------------------------------
  const hasCoordinates =
    analysis.latitude !== null &&
    analysis.latitude !== undefined &&
    analysis.longitude !== null &&
    analysis.longitude !== undefined;

  const handleLocateOnMap = () => {
    if (!hasCoordinates) return;
    const params = new URLSearchParams({
      asset: analysis.asset_id || 'MANUAL-INPUT',
      lat: String(analysis.latitude),
      lng: String(analysis.longitude),
      type: analysis.asset_type,
      priority: analysis.investigation_priority,
      flag: analysis.final_decision_support_flag,
      city: analysis.city || '',
      region: analysis.region || '',
    });
    navigate(`/network-map?${params.toString()}`);
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-8 pb-12 animate-page-transition">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            NOC Command Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal">
            Operational Decision Support from Manual Telemetry Input
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/analyze-telemetry"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">edit</span>
            <span>Change Telemetry</span>
          </Link>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Manual Telemetry Evaluated</span>
          </div>
        </div>
      </div>

      {/* Grid: Box 1 & Box 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* ================================================================= */}
        {/* Box 1: What did this manual input reveal? */}
        {/* ================================================================= */}
        <div className="flex flex-col gap-3">
          <div className="bg-white rounded-[24px] p-6 md:p-8 border border-slate-200/80 shadow-[0_4px_24px_-2px_rgba(15,23,42,0.04)] flex flex-col justify-between min-h-[380px]">
            <div>
              {/* Question Eyebrow & Title */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold tracking-wider text-indigo-600 uppercase bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
                  Manual Telemetry Analysis
                </span>
                <span className="text-xs text-slate-400 font-medium">Question 1 of 3</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-5">
                1. What did this manual input reveal?
              </h2>

              {/* Data Items */}
              <div className="space-y-3">
                {/* Asset ID & Type */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-200/70 text-slate-700 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">router</span>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500">Analyzed Asset ID</div>
                      <div className="text-sm sm:text-base font-bold font-mono text-slate-900">
                        {analysis.asset_id || 'Manual Input'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-slate-500">Asset Type</div>
                    <div className="text-xs sm:text-sm font-bold text-slate-800">
                      {analysis.asset_type}
                    </div>
                  </div>
                </div>

                {/* Final Decision & Priority */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Final Decision */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
                    <div className="text-xs font-semibold text-slate-500 mb-1">Final Decision</div>
                    <div>
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${getFlagBadgeClass(
                          analysis.final_decision_support_flag
                        )}`}
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {analysis.final_decision_support_flag === 'Investigate'
                            ? 'warning'
                            : 'check_circle'}
                        </span>
                        <span>{analysis.final_decision_support_flag}</span>
                      </span>
                    </div>
                  </div>

                  {/* Investigation Priority */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
                    <div className="text-xs font-semibold text-slate-500 mb-1">
                      Investigation Priority
                    </div>
                    <div>
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold border ${getPriorityBadgeClass(
                          analysis.investigation_priority
                        )}`}
                      >
                        <span className="w-2 h-2 rounded-full bg-current" />
                        <span>{analysis.investigation_priority} Priority</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Main Issue / Main Breached Measurement */}
                <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-100 flex flex-col gap-1">
                  <div className="text-xs font-bold text-rose-800 uppercase tracking-wide">
                    Main Issue / Breached Measurement
                  </div>
                  <div className="text-xs font-semibold text-rose-950 leading-relaxed">
                    {analysis.main_issue}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic Suggestion Line below Box 1 */}
          <div className="flex items-start sm:items-center gap-2.5 px-4 py-3 rounded-2xl bg-indigo-50/80 border border-indigo-100 text-xs text-indigo-950 font-medium shadow-xs">
            <span className="material-symbols-outlined text-[18px] text-indigo-600 shrink-0 mt-0.5 sm:mt-0">
              lightbulb
            </span>
            <span className="leading-snug">{analysis.box1_suggestion}</span>
          </div>
        </div>

        {/* ================================================================= */}
        {/* Box 2: What should the NOC check next? */}
        {/* ================================================================= */}
        <div className="flex flex-col gap-3">
          <div className="bg-white rounded-[24px] p-6 md:p-8 border border-slate-200/80 shadow-[0_4px_24px_-2px_rgba(15,23,42,0.04)] flex flex-col justify-between min-h-[380px]">
            <div>
              {/* Question Eyebrow & Title */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold tracking-wider text-purple-600 uppercase bg-purple-50 px-2.5 py-1 rounded-md border border-purple-100">
                  Recommended NOC Actions
                </span>
                <span className="text-xs text-slate-400 font-medium">Question 2 of 3</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-5">
                2. What should the NOC check next?
              </h2>

              {/* Action List */}
              <div className="space-y-2.5">
                {analysis.recommended_actions.map((act, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-slate-50 hover:bg-purple-50/50 border border-slate-200/80 transition-colors flex items-start gap-3"
                  >
                    <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                      {idx + 1}
                    </div>
                    <div className="text-xs font-semibold text-slate-800 leading-relaxed">
                      {act}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Dynamic Suggestion Line below Box 2 */}
          <div className="flex items-start sm:items-center gap-2.5 px-4 py-3 rounded-2xl bg-purple-50/80 border border-purple-100 text-xs text-purple-950 font-medium shadow-xs">
            <span className="material-symbols-outlined text-[18px] text-purple-600 shrink-0 mt-0.5 sm:mt-0">
              lightbulb
            </span>
            <span className="leading-snug">{analysis.box2_suggestion}</span>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* Box 3: Location */}
      {/* =================================================================== */}
      <div className="flex flex-col gap-3">
        <div className="bg-white rounded-[24px] p-6 md:p-8 border border-slate-200/80 shadow-[0_4px_24px_-2px_rgba(15,23,42,0.04)]">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold tracking-wider text-emerald-600 uppercase bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
              Geographic & Topology Pinpoint
            </span>
            <span className="text-xs text-slate-400 font-medium">Question 3 of 3</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                3. Location
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Geographic coordinates and administrative boundary details associated with the analyzed asset.
              </p>
            </div>

            {/* [ Locate on Live Geo Map ] Button */}
            {hasCoordinates ? (
              <button
                type="button"
                onClick={handleLocateOnMap}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold text-xs shadow-md shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shrink-0 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">location_on</span>
                <span>Locate on Live Geo Map</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-slate-400 text-xs font-semibold shrink-0 cursor-not-allowed">
                <span className="material-symbols-outlined text-[16px]">location_off</span>
                <span>Location Unavailable</span>
              </div>
            )}
          </div>

          {/* Location Content */}
          {hasCoordinates ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
              {/* City */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] font-semibold text-slate-500 mb-1">City</div>
                <div className="text-sm font-bold text-slate-900">{analysis.city || 'N/A'}</div>
              </div>

              {/* Region */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] font-semibold text-slate-500 mb-1">Region</div>
                <div className="text-sm font-bold text-slate-900">{analysis.region || 'N/A'}</div>
              </div>

              {/* Country */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] font-semibold text-slate-500 mb-1">Country</div>
                <div className="text-sm font-bold text-slate-900">{analysis.country || 'N/A'}</div>
              </div>

              {/* Continent */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] font-semibold text-slate-500 mb-1">Continent</div>
                <div className="text-sm font-bold text-slate-900">
                  {analysis.continent || 'N/A'}
                </div>
              </div>

              {/* Latitude */}
              <div className="p-3.5 rounded-2xl bg-purple-50/50 border border-purple-100 font-mono">
                <div className="text-[11px] font-semibold text-purple-700 mb-1">Latitude</div>
                <div className="text-sm font-bold text-purple-950">
                  {analysis.latitude !== null && analysis.latitude !== undefined
                    ? analysis.latitude.toFixed(6)
                    : 'N/A'}
                </div>
              </div>

              {/* Longitude */}
              <div className="p-3.5 rounded-2xl bg-purple-50/50 border border-purple-100 font-mono">
                <div className="text-[11px] font-semibold text-purple-700 mb-1">Longitude</div>
                <div className="text-sm font-bold text-purple-950">
                  {analysis.longitude !== null && analysis.longitude !== undefined
                    ? analysis.longitude.toFixed(6)
                    : 'N/A'}
                </div>
              </div>
            </div>
          ) : (
            /* Clear Missing Location State */
            <div className="p-6 rounded-2xl bg-amber-50/70 border border-amber-200 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[26px]">fmd_bad</span>
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-amber-950 mb-1">
                  Location cannot be shown unless an Asset ID or coordinates are provided.
                </div>
                <div className="text-xs text-amber-800 leading-relaxed">
                  {analysis.location_message ||
                    'This analysis was generated from raw measurements without an associated Asset ID or coordinates. To locate this asset on the map, provide an existing Asset ID or enter latitude/longitude in Analyze Telemetry.'}
                </div>
              </div>
              <Link
                to="/analyze-telemetry"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-900 text-white font-bold text-xs hover:bg-amber-950 transition-colors shrink-0"
              >
                <span>Add Location Info</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
            </div>
          )}
        </div>

        {/* Dynamic Suggestion Line below Box 3 */}
        <div className="flex items-start sm:items-center gap-2.5 px-4 py-3 rounded-2xl bg-emerald-50/80 border border-emerald-100 text-xs text-emerald-950 font-medium shadow-xs">
          <span className="material-symbols-outlined text-[18px] text-emerald-600 shrink-0 mt-0.5 sm:mt-0">
            lightbulb
          </span>
          <span className="leading-snug">
            {hasCoordinates
              ? `Asset coordinates are plotted at ${analysis.city || 'Sector'}, ${analysis.region || ''} (${analysis.latitude?.toFixed(4)}, ${analysis.longitude?.toFixed(4)}). Use Locate on Live Geo Map to view geographic context.`
              : 'Location data unavailable. Provide an existing Asset ID or GPS coordinates in Analyze Telemetry to enable interactive map placement.'}
          </span>
        </div>
      </div>
    </div>
  );
};
