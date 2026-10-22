import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Search,
  Filter,
  RefreshCw,
  Radio,
  Users,
  Gauge,
  Zap,
  PhoneOff,
  Signal,
  Cpu,
  Server,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  ChevronLeft,
  ChevronRight,
  MapPin,
  HelpCircle,
  X,
  ShieldAlert,
  Brain,
  Sliders,
  RotateCcw,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { MetricCard } from '../components/common/MetricCard';
import { getHealth, getHealthDashboard, getAssets, getAssetDetail, getHealthLocations } from '../api/client';
import { getStatusStyle } from '../api/hooks';
import {
  HealthResponse,
  HealthDashboardData,
  HealthLocationsResponse,
  PaginatedAssets,
  Reading,
  AssetDetail,
} from '../types/api';

export const NetworkHealth: React.FC = () => {
  const navigate = useNavigate();

  const [healthData, setHealthData] = useState<HealthDashboardData | null>(null);
  const [locationsData, setLocationsData] = useState<HealthLocationsResponse | null>(null);
  const [coreHealth, setCoreHealth] = useState<HealthResponse | null>(null);
  const [assetData, setAssetData] = useState<PaginatedAssets | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active filters
  const [countryFilter, setCountryFilter] = useState<string>('All');
  const [continentFilter, setContinentFilter] = useState<string>('All');
  const [cityFilter, setCityFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Asset table search & pagination
  const [search, setSearch] = useState<string>('');
  const [activeQuery, setActiveQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  // Asset details drawer
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [assetDetail, setAssetDetail] = useState<AssetDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);

  // Load locations dynamically
  const loadLocations = useCallback(async () => {
    try {
      const locs = await getHealthLocations();
      if (locs) {
        setLocationsData(locs);
      }
    } catch (err: any) {
      console.warn('Failed to load dynamic health locations:', err);
    }
  }, []);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  // Load Dashboard Data & KPIs from backend
  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [hCore, hDash, hLoc] = await Promise.all([
        getHealth().catch(() => null),
        getHealthDashboard({
          country: countryFilter !== 'All' ? countryFilter : undefined,
          continent: continentFilter !== 'All' ? continentFilter : undefined,
          city: cityFilter !== 'All' ? cityFilter : undefined,
          asset_type: typeFilter !== 'All' ? typeFilter : undefined,
          status: statusFilter !== 'All' ? statusFilter : undefined,
        }),
        getHealthLocations().catch(() => null),
      ]);
      setCoreHealth(hCore);
      setHealthData(hDash);
      if (hLoc) {
        setLocationsData(hLoc);
      } else if (hDash?.filter_options) {
        setLocationsData(hDash.filter_options as any);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch network health dashboard');
    } finally {
      setLoading(false);
    }
  }, [countryFilter, continentFilter, cityFilter, typeFilter, statusFilter]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Load Assets Table with pagination and search
  const loadAssetsTable = useCallback(async () => {
    try {
      const params: {
        country?: string;
        continent?: string;
        city?: string;
        asset_type?: string;
        status?: string;
        q?: string;
        page: number;
        page_size: number;
      } = {
        page,
        page_size: 10,
      };
      if (continentFilter !== 'All') params.continent = continentFilter;
      if (countryFilter !== 'All') params.country = countryFilter;
      if (cityFilter !== 'All') params.city = cityFilter;
      if (typeFilter !== 'All') params.asset_type = typeFilter;
      if (statusFilter !== 'All') params.status = statusFilter;
      if (activeQuery.trim()) params.q = activeQuery.trim();

      const data = await getAssets(params);
      setAssetData(data);
    } catch (err: any) {
      console.error('Failed to load asset inventory:', err);
    }
  }, [continentFilter, countryFilter, cityFilter, typeFilter, statusFilter, activeQuery, page]);

  useEffect(() => {
    loadAssetsTable();
  }, [loadAssetsTable]);

  // Handle Asset Click -> Drawer
  const handleSelectAsset = async (assetId: string) => {
    setSelectedAssetId(assetId);
    setLoadingDetail(true);
    try {
      const detail = await getAssetDetail(assetId);
      setAssetDetail(detail);
    } catch (err: any) {
      console.error('Failed to fetch asset detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleResetFilters = () => {
    setCountryFilter('All');
    setContinentFilter('All');
    setCityFilter('All');
    setTypeFilter('All');
    setStatusFilter('All');
    setSearch('');
    setActiveQuery('');
    setPage(1);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveQuery(search);
    setPage(1);
  };

  const kpis = healthData?.kpis;
  const charts = healthData?.charts;
  const doc = healthData?.documentation;
  const filterOptions = healthData?.filter_options;
  const hierarchy = (locationsData?.hierarchy || filterOptions?.hierarchy) as Record<string, Record<string, string[]>> | undefined;

  // Available Continents
  const availableContinents = useMemo<string[]>(() => {
    if (locationsData?.continents && locationsData.continents.length > 0) {
      return locationsData.continents;
    }
    if (filterOptions?.continents && filterOptions.continents.length > 0) {
      return filterOptions.continents;
    }
    return ['Africa', 'Asia', 'Europe', 'North America', 'Oceania', 'South America'];
  }, [locationsData, filterOptions]);

  // Cascading Available Countries based on selected Continent
  const availableCountries = useMemo<string[]>(() => {
    if (continentFilter !== 'All' && hierarchy && hierarchy[continentFilter]) {
      const fromHierarchy = Object.keys(hierarchy[continentFilter]);
      return Array.from(new Set(fromHierarchy)).sort();
    }
    if (locationsData?.countries && locationsData.countries.length > 0) {
      return locationsData.countries;
    }
    if (filterOptions?.countries && filterOptions.countries.length > 0) {
      return filterOptions.countries;
    }
    return [];
  }, [continentFilter, hierarchy, locationsData, filterOptions]);

  // Cascading Available Cities based on selected Country and Continent
  const availableCities = useMemo<string[]>(() => {
    if (countryFilter !== 'All' && hierarchy) {
      if (continentFilter !== 'All' && hierarchy[continentFilter]?.[countryFilter]) {
        return Array.from(new Set(hierarchy[continentFilter][countryFilter])).sort();
      }
      for (const cMap of Object.values(hierarchy)) {
        if (cMap[countryFilter]) {
          return Array.from(new Set(cMap[countryFilter])).sort();
        }
      }
    }
    if (continentFilter !== 'All' && hierarchy && hierarchy[continentFilter]) {
      const citiesList: string[] = [];
      const countryGroup = hierarchy[continentFilter];
      Object.values(countryGroup).forEach((arr: string[]) => {
        arr.forEach((ci: string) => citiesList.push(ci));
      });
      return Array.from(new Set(citiesList)).sort();
    }
    if (locationsData?.cities && locationsData.cities.length > 0) {
      return locationsData.cities;
    }
    if (filterOptions?.cities && filterOptions.cities.length > 0) {
      return filterOptions.cities;
    }
    return [];
  }, [continentFilter, countryFilter, hierarchy, locationsData, filterOptions]);

  const isLocationFiltered = continentFilter !== 'All' || countryFilter !== 'All' || cityFilter !== 'All';

  return (
    <div className="p-6 space-y-6 font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
              <Activity size={24} className="text-blue-500" />
              <span>Network Health Dashboard</span>
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                kpis?.health_category === 'Healthy'
                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : kpis?.health_category === 'Warning'
                  ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                  : kpis?.health_category === 'No Data'
                  ? 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                  : 'bg-red-500/20 text-red-500 border border-red-500/30'
              }`}
            >
              {kpis?.health_category || 'Evaluating'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time aggregate SLA compliance, transparent Network Stress Index (NSI), and SQLite telemetry analytics.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => setShowFormulaModal(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors flex items-center gap-1.5 border border-slate-300 dark:border-slate-700"
          >
            <HelpCircle size={14} className="text-blue-500" />
            <span>NSI & Health Formula</span>
          </button>

          <button
            onClick={() => {
              loadLocations();
              loadDashboardData();
              loadAssetsTable();
            }}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Telemetry</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs flex items-center gap-2">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Graceful notification for 0 assets under current filter */}
      {kpis && kpis.total_assets === 0 && (
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <MapPin size={18} className="text-blue-500 shrink-0" />
            <span>
              <strong>Zero matching records:</strong> No active network assets found matching {countryFilter !== 'All' ? `country "${countryFilter}"` : continentFilter !== 'All' ? `continent "${continentFilter}"` : 'selected filters'}{cityFilter !== 'All' ? ` in city "${cityFilter}"` : ''}. All global dropdown options remain available.
            </span>
          </div>
          <button
            onClick={handleResetFilters}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors shrink-0 flex items-center gap-1 self-start sm:self-auto"
          >
            <RotateCcw size={12} />
            <span>View All Locations</span>
          </button>
        </div>
      )}

      {/* Multi-Parameter Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            <Sliders size={14} className="text-blue-500" />
            <span>Operational Telemetry Filters</span>
            {isLocationFiltered && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-semibold normal-case">
                Filtered: {[continentFilter !== 'All' ? continentFilter : null, countryFilter !== 'All' ? countryFilter : null, cityFilter !== 'All' ? cityFilter : null].filter(Boolean).join(' → ')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isLocationFiltered && (
              <button
                onClick={() => {
                  setContinentFilter('All');
                  setCountryFilter('All');
                  setCityFilter('All');
                  setPage(1);
                }}
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 transition-colors font-medium"
              >
                <MapPin size={12} />
                <span>All Locations (Global)</span>
              </button>
            )}
            <button
              onClick={handleResetFilters}
              className="text-[11px] text-slate-500 hover:text-blue-500 flex items-center gap-1 transition-colors"
            >
              <RotateCcw size={12} />
              <span>Reset All Filters</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
          {/* Continent / Region Filter */}
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Continent</label>
            <select
              value={continentFilter}
              onChange={(e) => {
                const newCont = e.target.value;
                setContinentFilter(newCont);
                if (newCont !== 'All') {
                  if (countryFilter !== 'All') {
                    const countryInNewCont = hierarchy && hierarchy[newCont] && hierarchy[newCont][countryFilter];
                    const mappedCont = locationsData?.country_to_continent?.[countryFilter];
                    if (!countryInNewCont && mappedCont !== newCont) {
                      setCountryFilter('All');
                      setCityFilter('All');
                    }
                  }
                }
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-medium"
            >
              <option value="All">All Locations / Continents</option>
              {availableContinents.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Country Filter */}
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
              Country {availableCountries.length > 0 ? `(${availableCountries.length})` : ''}
            </label>
            <select
              value={countryFilter}
              onChange={(e) => {
                const newCountry = e.target.value;
                setCountryFilter(newCountry);
                if (newCountry !== 'All') {
                  const mappedCont = locationsData?.country_to_continent?.[newCountry];
                  if (mappedCont && (continentFilter === 'All' || continentFilter !== mappedCont)) {
                    setContinentFilter(mappedCont);
                  }
                  if (hierarchy) {
                    let cityValid = false;
                    for (const cMap of Object.values(hierarchy)) {
                      if (cMap[newCountry] && cMap[newCountry].includes(cityFilter)) {
                        cityValid = true;
                        break;
                      }
                    }
                    if (!cityValid) {
                      setCityFilter('All');
                    }
                  }
                } else {
                  setCityFilter('All');
                }
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-medium"
            >
              <option value="All">All Countries</option>
              {availableCountries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* City Filter */}
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
              City Hub {availableCities.length > 0 ? `(${availableCities.length})` : ''}
            </label>
            <select
              value={cityFilter}
              onChange={(e) => {
                const newCity = e.target.value;
                setCityFilter(newCity);
                if (newCity !== 'All' && hierarchy && countryFilter === 'All') {
                  let matchedCountry: string | null = null;
                  let matchedCont: string | null = null;
                  if (continentFilter !== 'All' && hierarchy[continentFilter]) {
                    for (const [cName, cityList] of Object.entries(hierarchy[continentFilter])) {
                      if (cityList.includes(newCity)) {
                        matchedCountry = cName;
                        matchedCont = continentFilter;
                        break;
                      }
                    }
                  }
                  if (!matchedCountry) {
                    for (const [contName, cMap] of Object.entries(hierarchy)) {
                      for (const [cName, cityList] of Object.entries(cMap)) {
                        if (cityList.includes(newCity)) {
                          matchedCountry = cName;
                          matchedCont = contName;
                          break;
                        }
                      }
                      if (matchedCountry) break;
                    }
                  }
                  if (matchedCountry) {
                    setCountryFilter(matchedCountry);
                    if (matchedCont && continentFilter === 'All') {
                      setContinentFilter(matchedCont);
                    }
                  }
                }
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-medium"
            >
              <option value="All">All Cities</option>
              {availableCities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Asset Type Filter */}
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Asset Type</label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="All">All Asset Types</option>
              <option value="Base Station">Base Station</option>
              <option value="Cell Tower">Cell Tower</option>
              <option value="Network Gateway">Network Gateway</option>
              <option value="Router">Router</option>
            </select>
          </div>

          {/* Status Policy Filter */}
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Status Tier</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="All">All Statuses</option>
              <option value="green">Green (Normal / Optimal)</option>
              <option value="yellow">Yellow (Near Threshold)</option>
              <option value="purple">Purple (DBSCAN Anomaly)</option>
              <option value="red">Red (At Risk)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 12 Backend-Calculated KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <MetricCard
          title="TOTAL ASSETS"
          value={kpis?.total_assets.toLocaleString() || '0'}
          unit=""
          trend={countryFilter !== 'All' ? `Filtered (${countryFilter})` : 'Active database nodes'}
          trendDirection="neutral"
          status="healthy"
          subtext="SQLite Master Records"
          icon={<Server size={15} />}
        />
        <MetricCard
          title="AGGREGATE HEALTH"
          value={kpis ? kpis.aggregate_health_score.toFixed(1) : '0.0'}
          unit="/100"
          trend={`Category: ${kpis?.health_category || 'N/A'}`}
          trendDirection="neutral"
          status={kpis && kpis.aggregate_health_score >= 70 ? 'healthy' : kpis && kpis.aggregate_health_score >= 45 ? 'warning' : 'critical'}
          subtext="Documented Composite Score"
          icon={<Activity size={15} />}
        />
        <MetricCard
          title="AT-RISK ASSETS"
          value={kpis?.at_risk_assets.toLocaleString() || '0'}
          unit={`(${kpis?.at_risk_pct.toFixed(1)}%)`}
          trend="SVM Classifier Prediction"
          trendDirection="down"
          status={kpis && kpis.at_risk_pct > 30 ? 'critical' : 'warning'}
          subtext="Degradation Risk Flagged"
          icon={<ShieldAlert size={15} />}
        />
        <MetricCard
          title="DBSCAN ANOMALIES"
          value={kpis?.anomaly_count.toLocaleString() || '0'}
          unit={`(${kpis?.anomaly_pct.toFixed(1)}%)`}
          trend="Density Noise Outliers"
          trendDirection="neutral"
          status="warning"
          subtext="Unsupervised Cluster -1"
          icon={<Brain size={15} />}
        />
        <MetricCard
          title="OPERATIONAL SLA"
          value={kpis?.availability_pct.toFixed(1) || '99.0'}
          unit="%"
          trend="Non-critical asset ratio"
          trendDirection="neutral"
          status="healthy"
          subtext="Snapshot Uptime Metric"
          icon={<CheckCircle2 size={15} />}
        />
        <MetricCard
          title="AVG STRESS INDEX (NSI)"
          value={kpis?.avg_nsi.toFixed(1) || '0.0'}
          unit="/100"
          trend="4-Factor Operational Stress"
          trendDirection="neutral"
          status={kpis && kpis.avg_nsi > 50 ? 'warning' : 'healthy'}
          subtext="SLA Threshold: < 50"
          icon={<Gauge size={15} />}
        />
        <MetricCard
          title="AVG LATENCY"
          value={kpis?.avg_latency_ms.toFixed(1) || '0.0'}
          unit="ms"
          trend="Round-trip transmission"
          trendDirection="neutral"
          status={kpis && kpis.avg_latency_ms > 100 ? 'critical' : 'healthy'}
          subtext="Target SLA: < 100 ms"
          icon={<Zap size={15} />}
        />
        <MetricCard
          title="AVG PACKET LOSS"
          value={kpis?.avg_packet_loss_pct.toFixed(2) || '0.00'}
          unit="%"
          trend="Drop ratio mean"
          trendDirection="neutral"
          status={kpis && kpis.avg_packet_loss_pct > 4.5 ? 'critical' : 'healthy'}
          subtext="Threshold SLA: < 4.5%"
          icon={<Activity size={15} />}
        />
        <MetricCard
          title="AVG TRAFFIC LOAD"
          value={kpis?.avg_traffic_load_pct.toFixed(1) || '0.0'}
          unit="%"
          trend="Cell sector utilization"
          trendDirection="neutral"
          status="healthy"
          subtext="Capacity Ceiling: 85%"
          icon={<Radio size={15} />}
        />
        <MetricCard
          title="AVG RESOURCE UTIL"
          value={kpis?.avg_resource_utilization_pct.toFixed(1) || '0.0'}
          unit="%"
          trend="Baseband processing load"
          trendDirection="neutral"
          status="healthy"
          subtext="Hardware Utilization"
          icon={<Cpu size={15} />}
        />
        <MetricCard
          title="AVG SIGNAL STRENGTH"
          value={kpis?.avg_signal_strength_dbm.toFixed(1) || '0.0'}
          unit="dBm"
          trend="RSRP Coverage Mean"
          trendDirection="neutral"
          status="healthy"
          subtext="Compliant Baseline"
          icon={<Signal size={15} />}
        />
        <MetricCard
          title="NORMAL ASSETS"
          value={kpis?.normal_assets.toLocaleString() || '0'}
          unit=""
          trend="Optimal SVM classification"
          trendDirection="neutral"
          status="healthy"
          subtext="Optimal Operation"
          icon={<CheckCircle2 size={15} />}
        />
      </div>

      {/* 7 Recharts Interactive Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Normal vs At-Risk Distribution (SVM) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <ShieldAlert size={16} className="text-red-500" />
                <span>1. Supervised SVM Risk Classification Distribution</span>
              </h3>
              <p className="text-[11px] text-slate-400">Classifies nodes as Optimal Baseline vs At-Risk Degraded</p>
            </div>
          </div>
          <div className="h-60 flex items-center justify-center">
            {charts?.svm_distribution ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.svm_distribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {charts.svm_distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      border: '1px solid #334155',
                      fontSize: '11px',
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-500">No chart data</div>
            )}
          </div>
        </div>

        {/* Chart 2: DBSCAN Anomaly Outlier Distribution (Separate from SVM) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Brain size={16} className="text-purple-500" />
                <span>2. Unsupervised DBSCAN Density Cluster Outliers</span>
              </h3>
              <p className="text-[11px] text-slate-400">Dense inlier clusters vs isolated multivariate noise points (cluster -1)</p>
            </div>
          </div>
          <div className="h-60 flex items-center justify-center">
            {charts?.dbscan_distribution ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.dbscan_distribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {charts.dbscan_distribution.map((entry, index) => (
                      <Cell key={`cell-db-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      border: '1px solid #334155',
                      fontSize: '11px',
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-500">No chart data</div>
            )}
          </div>
        </div>

        {/* Chart 3: Network Stress Index (NSI) Distribution */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Gauge size={16} className="text-blue-500" />
                <span>3. Network Stress Index (NSI) Distribution</span>
              </h3>
              <p className="text-[11px] text-slate-400">Node counts across 4 operational stress tiers</p>
            </div>
          </div>
          <div className="h-60">
            {charts?.nsi_distribution ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.nsi_distribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="bin" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      border: '1px solid #334155',
                      fontSize: '11px',
                    }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Asset Count" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-500 text-center py-20">No data</div>
            )}
          </div>
        </div>

        {/* Chart 4: Average Latency and Packet Loss by Asset Type */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Zap size={16} className="text-amber-500" />
                <span>4. Latency & Packet Loss Profile by Node Type</span>
              </h3>
              <p className="text-[11px] text-slate-400">Average round-trip latency (ms) and packet drop rate (%)</p>
            </div>
          </div>
          <div className="h-60">
            {charts?.latency_packet_loss ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.latency_packet_loss}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="asset_type" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      border: '1px solid #334155',
                      fontSize: '11px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="latency_ms" fill="#f59e0b" name="Avg Latency (ms)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="packet_loss_pct" fill="#ef4444" name="Avg Packet Loss (%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-500 text-center py-20">No data</div>
            )}
          </div>
        </div>

        {/* Chart 5: Signal Strength Coverage Distribution */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Signal size={16} className="text-emerald-500" />
                <span>5. RSRP Signal Strength Coverage Distribution</span>
              </h3>
              <p className="text-[11px] text-slate-400">Radio signal strength tiers across active inventory</p>
            </div>
          </div>
          <div className="h-60">
            {charts?.signal_distribution ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.signal_distribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="tier" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      border: '1px solid #334155',
                      fontSize: '11px',
                    }}
                  />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="Node Count" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-500 text-center py-20">No data</div>
            )}
          </div>
        </div>

        {/* Chart 6: Health Breakdown by Region/Continent */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <MapPin size={16} className="text-blue-500" />
                <span>6. Regional Health & At-Risk Share</span>
              </h3>
              <p className="text-[11px] text-slate-400">Optimal vs At-Risk proportion across geographical regions</p>
            </div>
          </div>
          <div className="h-60">
            {charts?.risk_by_region ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.risk_by_region}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="region" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      border: '1px solid #334155',
                      fontSize: '11px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="optimal" stackId="a" fill="#10b981" name="Optimal" />
                  <Bar dataKey="at_risk" stackId="a" fill="#ef4444" name="At Risk" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-500 text-center py-20">No data</div>
            )}
          </div>
        </div>
      </div>

      {/* Asset Health Inventory Table */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Server size={18} className="text-blue-500" />
              <span>Asset Health Directory (Click row to view full details)</span>
            </h2>
            <p className="text-xs text-slate-500">
              Showing {assetData?.total || 0} matching assets from SQLite database
            </p>
          </div>

          <form onSubmit={handleSearchSubmit} className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Asset ID, city, country..."
              className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 w-56"
            />
          </form>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 bg-slate-50 dark:bg-slate-900 font-semibold uppercase tracking-wider">
                <th className="p-3">Asset ID</th>
                <th className="p-3">Type</th>
                <th className="p-3">Location</th>
                <th className="p-3">Status</th>
                <th className="p-3">Stress (NSI)</th>
                <th className="p-3">Latency</th>
                <th className="p-3">Packet Loss</th>
                <th className="p-3">Traffic Load</th>
                <th className="p-3">Risk Score</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-800">
              {!assetData || assetData.items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500">
                    No matching assets found in database.
                  </td>
                </tr>
              ) : (
                assetData.items.map((asset) => (
                  <tr
                    key={asset.asset_id}
                    onClick={() => handleSelectAsset(asset.asset_id)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                  >
                    <td className="p-3 font-mono font-bold text-blue-500">{asset.asset_id}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">
                      {asset.asset_type}
                    </td>
                    <td className="p-3 text-slate-500 font-mono text-[11px]">
                      {asset.city ? `${asset.city}, ` : ''}{asset.country || 'N/A'}
                    </td>
                    <td className="p-3">
                      <span
                        className="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                        style={{
                          color: getStatusStyle(asset.status).hex,
                          backgroundColor: `${getStatusStyle(asset.status).hex}20`,
                        }}
                      >
                        {asset.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {asset.network_stress_index.toFixed(1)}
                    </td>
                    <td className="p-3 font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {asset.latency_ms.toFixed(1)} ms
                    </td>
                    <td className="p-3 font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {asset.packet_loss_pct.toFixed(2)}%
                    </td>
                    <td className="p-3 font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {asset.traffic_load_pct.toFixed(1)}%
                    </td>
                    <td className="p-3 font-mono font-bold text-red-500">
                      {(asset.risk_score * 100).toFixed(1)}%
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/map?asset=${encodeURIComponent(asset.asset_id)}`);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-900 hover:bg-blue-600 hover:text-white text-slate-700 dark:text-slate-300 font-medium text-[11px] transition-colors border border-slate-300 dark:border-slate-700 inline-flex items-center gap-1"
                      >
                        <MapPin size={12} />
                        <span>Map</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paging */}
        {assetData && assetData.total > 10 && (
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span>
              Showing {((page - 1) * 10) + 1} to {Math.min(page * 10, assetData.total)} of {assetData.total} assets
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 disabled:opacity-40 flex items-center gap-1"
              >
                <ChevronLeft size={14} />
                <span>Previous</span>
              </button>
              <span>
                Page {page} of {Math.ceil(assetData.total / 10)}
              </span>
              <button
                disabled={page >= Math.ceil(assetData.total / 10)}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 disabled:opacity-40 flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Asset Details Drawer (Section 3.E) */}
      {selectedAssetId && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-6 overflow-y-auto space-y-5 animate-slide-left font-sans">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <span className="text-[10px] text-blue-500 font-bold uppercase tracking-wider">Asset Telemetry Details</span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
                {selectedAssetId}
              </h3>
            </div>
            <button
              onClick={() => setSelectedAssetId(null)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {loadingDetail || !assetDetail ? (
            <div className="py-20 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <RefreshCw size={14} className="animate-spin text-blue-500" />
              <span>Loading asset details...</span>
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              {/* Asset Identity Card */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Asset Type:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{assetDetail.asset.asset_type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Location:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {assetDetail.asset.city ? `${assetDetail.asset.city}, ` : ''}{assetDetail.asset.country || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Coordinates:</span>
                  <span className="font-mono text-slate-600 dark:text-slate-300">
                    {assetDetail.asset.latitude?.toFixed(4)}, {assetDetail.asset.longitude?.toFixed(4)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Observation Timestamp:</span>
                  <span className="font-mono text-slate-600 dark:text-slate-300">
                    {assetDetail.latest?.timestamp ? new Date(assetDetail.latest.timestamp).toLocaleString() : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Model Decision Outputs */}
              {assetDetail.latest && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    AI Decision & Outlier Classification
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] text-slate-400 block">SVM Risk Classification</span>
                      <span className={`text-xs font-bold block mt-0.5 ${assetDetail.latest.is_at_risk ? 'text-red-500' : 'text-emerald-500'}`}>
                        {assetDetail.latest.risk_label} ({ (assetDetail.latest.risk_score * 100).toFixed(1) }%)
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] text-slate-400 block">DBSCAN Density Status</span>
                      <span className={`text-xs font-bold block mt-0.5 ${assetDetail.latest.is_anomaly ? 'text-purple-400' : 'text-blue-500'}`}>
                        {assetDetail.latest.is_anomaly ? 'Multivariate Outlier' : 'Core Inlier'}
                      </span>
                    </div>
                  </div>

                  {/* Derived Features */}
                  <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                    <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-center">
                      <span className="text-[10px] text-slate-400 block">NSI Stress</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{assetDetail.latest.network_stress_index.toFixed(1)}</span>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-center">
                      <span className="text-[10px] text-slate-400 block">Signal Quality</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{assetDetail.latest.signal_quality_score.toFixed(1)}</span>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-center">
                      <span className="text-[10px] text-slate-400 block">TP / User</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{assetDetail.latest.throughput_per_user.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Raw Telemetry Metrics */}
              {assetDetail.latest && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Observed Telemetry Metrics
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1">
                      <span className="text-slate-500">Latency:</span>
                      <span className="font-mono font-semibold">{assetDetail.latest.latency_ms.toFixed(1)} ms</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1">
                      <span className="text-slate-500">Packet Loss:</span>
                      <span className="font-mono font-semibold">{assetDetail.latest.packet_loss_pct.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1">
                      <span className="text-slate-500">Traffic Load:</span>
                      <span className="font-mono font-semibold">{assetDetail.latest.traffic_load_pct.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1">
                      <span className="text-slate-500">Throughput:</span>
                      <span className="font-mono font-semibold">{assetDetail.latest.throughput_mbps.toFixed(1)} Mbps</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1">
                      <span className="text-slate-500">Connected Users:</span>
                      <span className="font-mono font-semibold">{assetDetail.latest.connected_users.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1">
                      <span className="text-slate-500">Signal (RSRP):</span>
                      <span className="font-mono font-semibold">{assetDetail.latest.signal_strength_dbm.toFixed(1)} dBm</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1">
                      <span className="text-slate-500">Call Drop Rate:</span>
                      <span className="font-mono font-semibold">{assetDetail.latest.call_drop_rate_pct.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1">
                      <span className="text-slate-500">Resource Util:</span>
                      <span className="font-mono font-semibold">{assetDetail.latest.resource_utilization_pct.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Threshold Breaches */}
              {assetDetail.latest?.threshold_breaches && assetDetail.latest.threshold_breaches.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs space-y-1">
                  <span className="font-bold flex items-center gap-1">
                    <AlertTriangle size={13} />
                    <span>Threshold Breaches Detected</span>
                  </span>
                  {assetDetail.latest.threshold_breaches.map((b, idx) => (
                    <p key={idx} className="text-[11px] text-amber-600 dark:text-amber-400">
                      &bull; {b.message} ({b.metric}: {b.value})
                    </p>
                  ))}
                </div>
              )}

              {/* Decision-support disclaimer */}
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500">
                <strong>Academic Disclaimer:</strong> AI model predictions are decision-support estimates derived from offline training, not guaranteed operational diagnoses.
              </div>

              <div className="pt-2">
                <button
                  onClick={() => navigate(`/map?asset=${encodeURIComponent(selectedAssetId)}`)}
                  className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <MapPin size={14} />
                  <span>View Asset on Interactive Map</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transparent NSI and Health Formula Help Modal */}
      {showFormulaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in font-sans">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle size={18} className="text-blue-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Network Health & NSI Documentation
                </h3>
              </div>
              <button
                onClick={() => setShowFormulaModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1.5">
                <span className="font-bold text-blue-500 block">1. Network Stress Index (NSI)</span>
                <p className="font-mono text-[11px] bg-slate-100 dark:bg-slate-900 p-2 rounded border border-slate-300 dark:border-slate-700">
                  {doc?.nsi_formula || 'NSI = (Traffic Load + Resource Utilization + Packet Loss + Call Drop Rate) / 4'}
                </p>
                <p className="text-[11px] text-slate-500">
                  A transparent linear composite ranging from 0.0 to 100.0 measuring the aggregate saturation of baseband processing, transport throughput, and transmission drops.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1.5">
                <span className="font-bold text-emerald-500 block">2. Composite Health Score Formula</span>
                <p className="font-mono text-[11px] bg-slate-100 dark:bg-slate-900 p-2 rounded border border-slate-300 dark:border-slate-700">
                  {doc?.health_score_formula || 'Health Score = 100 - (0.40 * NSI + 0.30 * (100 - SignalQuality) + 0.30 * RiskScorePct)'}
                </p>
                <p className="text-[11px] text-slate-500">
                  Combines three distinct operational dimensions: 40% Operational Stress (NSI), 30% Radio Coverage Quality, and 30% Calibrated SVM Degradation Risk.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1 text-[11px]">
                <span className="font-bold text-purple-400 block">3. Data Scope & Provenance</span>
                <p className="text-slate-500">
                  {doc?.data_scope || 'Active SQLite Telemetry Snapshot: 2026-09-16 00:00:00 to 2026-09-16 23:00:00'}
                </p>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setShowFormulaModal(false)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors"
              >
                Close Documentation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
