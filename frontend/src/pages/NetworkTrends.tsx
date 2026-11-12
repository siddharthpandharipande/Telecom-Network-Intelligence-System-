import React, { useEffect, useState, useCallback } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from 'recharts';
import {
  getTrendFilterOptions,
  getTrendsPriority,
  getTrendsByAssetType,
  getTrendsByLocation,
  getTrendsCommonIssues,
} from '../api/client';
import {
  TrendFilterOptions,
  PriorityTrendsData,
  AssetTypeTrendsData,
  LocationTrendsData,
  CommonIssuesTrendsData,
} from '../types/api';

export const NetworkTrends: React.FC = () => {
  // Filter states
  const [filterOptions, setFilterOptions] = useState<TrendFilterOptions>({
    asset_types: [],
    countries_and_regions: [],
    priorities: [],
  });
  const [selectedAssetType, setSelectedAssetType] = useState<string>('All');
  const [selectedCountryOrRegion, setSelectedCountryOrRegion] = useState<string>('All');
  const [selectedPriority, setSelectedPriority] = useState<string>('All');

  // Trend data states
  const [priorityData, setPriorityData] = useState<PriorityTrendsData | null>(null);
  const [assetTypeData, setAssetTypeData] = useState<AssetTypeTrendsData | null>(null);
  const [locationData, setLocationData] = useState<LocationTrendsData | null>(null);
  const [issuesData, setIssuesData] = useState<CommonIssuesTrendsData | null>(null);

  // Loading & Error states
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load filter options once on mount
  useEffect(() => {
    let isMounted = true;
    getTrendFilterOptions()
      .then((opts) => {
        if (isMounted) {
          setFilterOptions(opts);
        }
      })
      .catch((err) => {
        console.error('Failed to load trend filter options:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch all 4 trend endpoints whenever filters change
  const fetchTrendData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        asset_type: selectedAssetType !== 'All' ? selectedAssetType : undefined,
        country_or_region: selectedCountryOrRegion !== 'All' ? selectedCountryOrRegion : undefined,
        priority: selectedPriority !== 'All' ? selectedPriority : undefined,
      };

      const [prioRes, typeRes, locRes, issueRes] = await Promise.all([
        getTrendsPriority(params),
        getTrendsByAssetType(params),
        getTrendsByLocation(params),
        getTrendsCommonIssues(params),
      ]);

      setPriorityData(prioRes);
      setAssetTypeData(typeRes);
      setLocationData(locRes);
      setIssuesData(issueRes);
    } catch (err: any) {
      console.error('Failed to fetch network trends data:', err);
      setError(err?.message || 'Unable to connect to backend server. Please verify backend service.');
    } finally {
      setLoading(false);
    }
  }, [selectedAssetType, selectedCountryOrRegion, selectedPriority]);

  useEffect(() => {
    fetchTrendData();
  }, [fetchTrendData]);

  // Listen for manual telemetry analysis events to auto-refresh trends
  useEffect(() => {
    const handleTelemetryAnalyzed = () => {
      fetchTrendData();
    };
    window.addEventListener('nexusnet_telemetry_analyzed', handleTelemetryAnalyzed);
    return () => {
      window.removeEventListener('nexusnet_telemetry_analyzed', handleTelemetryAnalyzed);
    };
  }, [fetchTrendData]);

  // Priority color map
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return '#EF4444'; // Red
      case 'Medium':
        return '#F59E0B'; // Amber
      case 'Routine':
        return '#10B981'; // Green
      default:
        return '#64748B';
    }
  };

  const handleResetFilters = () => {
    setSelectedAssetType('All');
    setSelectedCountryOrRegion('All');
    setSelectedPriority('All');
  };

  const hasActiveFilters =
    selectedAssetType !== 'All' ||
    selectedCountryOrRegion !== 'All' ||
    selectedPriority !== 'All';

  return (
    <div className="w-full flex flex-col gap-6 animate-page-transition pb-8">
      {/* Top Filter Bar */}
      <section className="bg-white rounded-[28px] p-6 border border-slate-200/80 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider">
                <span className="material-symbols-outlined text-[14px]">query_stats</span>
                <span>Network Trends & Fleet Analytics</span>
              </div>
              {priorityData?.has_manual_analysis && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold shadow-xs animate-in fade-in duration-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Includes latest manual analysis</span>
                </div>
              )}
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Operational Health & Performance Trends
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {priorityData?.has_manual_analysis && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                <span className="material-symbols-outlined text-[13px] text-emerald-600">check_circle</span>
                <span>Includes latest manual analysis</span>
              </span>
            )}
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer w-fit"
              >
                <span className="material-symbols-outlined text-[15px]">restart_alt</span>
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Filters Form */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
          {/* Filter 1: Asset Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-slate-400">devices</span>
              <span>Asset Type</span>
            </label>
            <select
              value={selectedAssetType}
              onChange={(e) => setSelectedAssetType(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all cursor-pointer"
            >
              <option value="All">All Asset Types</option>
              {filterOptions.asset_types.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 2: Country or Region */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-slate-400">public</span>
              <span>Country or Region</span>
            </label>
            <select
              value={selectedCountryOrRegion}
              onChange={(e) => setSelectedCountryOrRegion(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all cursor-pointer"
            >
              <option value="All">All Countries & Regions</option>
              {filterOptions.countries_and_regions.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 3: Investigation Priority */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-slate-400">flag</span>
              <span>Investigation Priority</span>
            </label>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all cursor-pointer"
            >
              <option value="All">All Priorities</option>
              {filterOptions.priorities.map((prio) => (
                <option key={prio} value={prio}>
                  {prio}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Error State Banner */}
      {error && (
        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-rose-600 text-[24px]">error</span>
            <div>
              <h4 className="text-sm font-bold text-rose-900">Backend Communication Error</h4>
              <p className="text-xs text-rose-700">{error}</p>
            </div>
          </div>
          <button
            onClick={() => fetchTrendData()}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Primary Visualizations: Exactly Four Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ========================================================================= */}
        {/* SECTION 1: Priority distribution */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-[28px] p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-slate-900">Priority Distribution</h2>
              <div className="flex items-center gap-2">
                {priorityData?.has_manual_analysis && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px] font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Includes latest manual analysis</span>
                  </span>
                )}
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold">
                  Section 1
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Breakdown of Routine, Medium, and High triage status across filtered assets
            </p>

            {loading ? (
              <div className="h-60 w-full flex flex-col items-center justify-center gap-2 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <div className="w-7 h-7 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-slate-400 font-medium">Loading priority trends...</span>
              </div>
            ) : priorityData ? (
              <div>
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-3 gap-2.5 mb-4">
                  {priorityData.items.map((item) => {
                    const color = getPriorityColor(item.priority);
                    return (
                      <div
                        key={item.priority}
                        className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex flex-col items-center text-center"
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-xs font-semibold text-slate-600">{item.priority}</span>
                        </div>
                        <span className="text-lg font-black text-slate-900">
                          {item.count.toLocaleString()}
                        </span>
                        <span className="text-[11px] font-bold" style={{ color }}>
                          {item.percentage}%
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Recharts Bar Visualization */}
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={priorityData.items}
                      margin={{ top: 10, right: 15, left: -15, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis
                        dataKey="priority"
                        tick={{ fontSize: 11, fill: '#64748B' }}
                        tickLine={false}
                        axisLine={{ stroke: '#E2E8F0' }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#64748B' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          borderColor: '#334155',
                          borderRadius: '12px',
                          color: '#F8FAFC',
                          fontSize: '12px',
                        }}
                        formatter={(value: any, _name: any, item: any) => [
                          `${Number(value).toLocaleString()} assets (${item.payload.percentage}%)`,
                          'Asset Count',
                        ]}
                      />
                      <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                        {priorityData.items.map((entry) => (
                          <Cell key={`cell-${entry.priority}`} fill={getPriorityColor(entry.priority)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : null}
          </div>

          {/* Section 1 Dynamic Suggestion */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-start gap-2.5 text-xs bg-slate-50/90 rounded-2xl p-3 border border-slate-200/60">
            <span className="material-symbols-outlined text-indigo-600 text-[18px] shrink-0 mt-0.5">
              lightbulb
            </span>
            <p className="font-semibold text-slate-800 leading-snug">
              {loading ? 'Evaluating operational priorities...' : priorityData?.suggestion}
            </p>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 2: Issues by asset type */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-[28px] p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-slate-900">Issues by Asset Type</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold">
                Section 2
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Percentage of High-priority assets for Router, Network Gateway, Cell Tower, and Base Station
            </p>

            {loading ? (
              <div className="h-52 w-full flex flex-col items-center justify-center gap-2 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <div className="w-7 h-7 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-slate-400 font-medium">Loading hardware vulnerability trends...</span>
              </div>
            ) : assetTypeData ? (
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={assetTypeData.items}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                    <XAxis
                      type="number"
                      domain={[0, 'dataMax + 5']}
                      unit="%"
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickLine={false}
                      axisLine={{ stroke: '#E2E8F0' }}
                    />
                    <YAxis
                      dataKey="asset_type"
                      type="category"
                      width={100}
                      tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        color: '#F8FAFC',
                        fontSize: '12px',
                      }}
                      formatter={(val: any, _name: any, item: any) => [
                        `${val}% High-Priority (${item.payload.high_priority_count} / ${item.payload.total_count} assets)`,
                        'Severity Rate',
                      ]}
                    />
                    <Bar dataKey="high_priority_pct" fill="#8B5CF6" radius={[0, 8, 8, 0]}>
                      {assetTypeData.items.map((entry) => {
                        const isTop = entry.asset_type === assetTypeData.highest_asset_type;
                        return (
                          <Cell
                            key={`bar-${entry.asset_type}`}
                            fill={isTop ? '#7C3AED' : '#A78BFA'}
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </div>

          {/* Section 2 Dynamic Suggestion */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-start gap-2.5 text-xs bg-slate-50/90 rounded-2xl p-3 border border-slate-200/60">
            <span className="material-symbols-outlined text-purple-600 text-[18px] shrink-0 mt-0.5">
              lightbulb
            </span>
            <p className="font-semibold text-slate-800 leading-snug">
              {loading ? 'Evaluating asset type vulnerability...' : assetTypeData?.suggestion}
            </p>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 3: Issues by location */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-[28px] p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-slate-900">Issues by Location</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold">
                Section 3
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Top cities or regions by high-priority operational asset count
            </p>

            {loading ? (
              <div className="h-52 w-full flex flex-col items-center justify-center gap-2 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <div className="w-7 h-7 border-3 border-rose-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-slate-400 font-medium">Loading regional distribution...</span>
              </div>
            ) : locationData ? (
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={locationData.items}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickLine={false}
                      axisLine={{ stroke: '#E2E8F0' }}
                    />
                    <YAxis
                      dataKey="location"
                      type="category"
                      width={100}
                      tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        color: '#F8FAFC',
                        fontSize: '12px',
                      }}
                      formatter={(val: any, _name: any, item: any) => [
                        `${val} High-Priority (${item.payload.total_count} total assets)`,
                        'Critical Assets',
                      ]}
                    />
                    <Bar dataKey="high_priority_count" fill="#E11D48" radius={[0, 8, 8, 0]}>
                      {locationData.items.map((entry) => {
                        const isTop = entry.location === locationData.top_location;
                        return (
                          <Cell
                            key={`loc-${entry.location}`}
                            fill={isTop ? '#E11D48' : '#FB7185'}
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </div>

          {/* Section 3 Dynamic Suggestion */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-start gap-2.5 text-xs bg-slate-50/90 rounded-2xl p-3 border border-slate-200/60">
            <span className="material-symbols-outlined text-rose-600 text-[18px] shrink-0 mt-0.5">
              lightbulb
            </span>
            <p className="font-semibold text-slate-800 leading-snug">
              {loading ? 'Analyzing geographical concentrations...' : locationData?.suggestion}
            </p>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 4: Most common breached measurements */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-[28px] p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-slate-900">Most Common Breached Measurements</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold">
                Section 4
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Number of assets breaching each applicable telemetry measurement
            </p>

            {loading ? (
              <div className="h-52 w-full flex flex-col items-center justify-center gap-2 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <div className="w-7 h-7 border-3 border-amber-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-slate-400 font-medium">Aggregating telemetry breaches...</span>
              </div>
            ) : issuesData ? (
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={issuesData.items}
                    margin={{ top: 5, right: 30, left: 30, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickLine={false}
                      axisLine={{ stroke: '#E2E8F0' }}
                    />
                    <YAxis
                      dataKey="measurement"
                      type="category"
                      width={120}
                      tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        color: '#F8FAFC',
                        fontSize: '12px',
                      }}
                      formatter={(val: any, _name: any, item: any) => [
                        `${Number(val).toLocaleString()} assets (${item.payload.percentage}%)`,
                        'Breached Assets',
                      ]}
                    />
                    <Bar dataKey="count" fill="#F59E0B" radius={[0, 8, 8, 0]}>
                      {issuesData.items.map((entry) => {
                        const isTop = entry.measurement === issuesData.top_measurement;
                        return (
                          <Cell
                            key={`meas-${entry.measurement}`}
                            fill={isTop ? '#D97706' : '#FBBF24'}
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </div>

          {/* Section 4 Dynamic Suggestion */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-start gap-2.5 text-xs bg-slate-50/90 rounded-2xl p-3 border border-slate-200/60">
            <span className="material-symbols-outlined text-amber-600 text-[18px] shrink-0 mt-0.5">
              lightbulb
            </span>
            <p className="font-semibold text-slate-800 leading-snug">
              {loading ? 'Evaluating telemetry threshold breaches...' : issuesData?.suggestion}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};
