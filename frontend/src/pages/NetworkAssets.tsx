import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Server,
  Radio,
  Router,
  Search,
  Filter,
  Shield,
  RefreshCw,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Layers,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';
import { getAssets, getStatsOverview } from '../api/client';
import { useConfig, getStatusStyle } from '../api/hooks';
import { Reading, StatsOverview, PaginatedAssets } from '../types/api';

export const NetworkAssets: React.FC = () => {
  const navigate = useNavigate();
  const { config } = useConfig();

  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [assetData, setAssetData] = useState<PaginatedAssets | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [activeQuery, setActiveQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [page, setPage] = useState<number>(1);

  // Load Overview Stats
  useEffect(() => {
    getStatsOverview()
      .then((st) => setStats(st))
      .catch((err) => console.error('Failed to load stats for assets page:', err));
  }, []);

  // Fetch Assets
  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: {
        asset_type?: string;
        status?: string;
        q?: string;
        page: number;
        page_size: number;
      } = {
        page,
        page_size: 12,
      };

      if (typeFilter !== 'All') params.asset_type = typeFilter;
      if (statusFilter !== 'All') params.status = statusFilter;
      if (activeQuery.trim()) params.q = activeQuery.trim();

      const data = await getAssets(params);
      setAssetData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch network assets inventory');
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, statusFilter, activeQuery]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveQuery(search);
    setPage(1);
  };

  // Helper counts from stats.by_asset_type
  const getAssetCount = (type: string) => {
    return stats?.by_asset_type.find((b) => b.asset_type === type)?.count ?? 0;
  };

  return (
    <div className="p-6 space-y-6 font-sans">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <Server className="text-blue-500" size={26} />
            <span>Network Infrastructure Assets Inventory</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Physical and virtual telecom inventory tracking across {stats?.total_assets.toLocaleString() || '6,000'} infrastructure nodes.
          </p>
        </div>

        <button
          onClick={() => loadAssets()}
          disabled={loading}
          className="px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 self-start md:self-auto"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Inventory</span>
        </button>
      </div>

      {/* Asset Summary Count Grid (All derived from SQLite stats.by_asset_type, strictly synchronized with Live Map) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Total Assets</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
            {stats ? stats.total_assets.toLocaleString() : '6,007'}
          </div>
          <div className="text-xs text-blue-500 mt-1 flex items-center gap-1 font-medium">
            100% Geocoded Global Nodes
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Cell Towers</div>
          <div className="text-2xl font-bold text-blue-500 mt-1 font-mono">
            {stats ? getAssetCount('Cell Tower').toLocaleString() : '1,512'}
          </div>
          <div className="text-xs text-slate-400 mt-1">📡 Macro Radio Towers</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Base Stations</div>
          <div className="text-2xl font-bold text-indigo-500 mt-1 font-mono">
            {stats ? getAssetCount('Base Station').toLocaleString() : '1,443'}
          </div>
          <div className="text-xs text-slate-400 mt-1">▣ gNodeB / eNodeB Nodes</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Network Gateways</div>
          <div className="text-2xl font-bold text-emerald-500 mt-1 font-mono">
            {stats ? getAssetCount('Network Gateway').toLocaleString() : '1,515'}
          </div>
          <div className="text-xs text-slate-400 mt-1">Core IP Backhaul</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Edge Routers</div>
          <div className="text-2xl font-bold text-amber-500 mt-1 font-mono">
            {stats ? getAssetCount('Router').toLocaleString() : '1,537'}
          </div>
          <div className="text-xs text-slate-400 mt-1">◇ Packet Switch Routers</div>
        </div>
      </div>

      {/* Asset Inventory Table with Filters */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Infrastructure Inventory Directory
            </h2>
            <p className="text-xs text-slate-500">
              Showing {assetData?.total || 0} matching records in database
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Asset ID, city..."
                className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 w-44"
              />
            </form>

            {/* Asset Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="All">All Types</option>
              <option value="Base Station">Base Station</option>
              <option value="Cell Tower">Cell Tower</option>
              <option value="Network Gateway">Network Gateway</option>
              <option value="Router">Router</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="All">All Statuses</option>
              <option value="green">Green (Compliant)</option>
              <option value="yellow">Yellow (Warning)</option>
              <option value="purple">Purple (Anomaly)</option>
              <option value="red">Red (At Risk)</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 bg-slate-50 dark:bg-slate-900 font-semibold uppercase tracking-wider">
                <th className="p-3">Asset ID</th>
                <th className="p-3">Asset Type</th>
                <th className="p-3">Location</th>
                <th className="p-3">Status</th>
                <th className="p-3">SVM Risk</th>
                <th className="p-3">DBSCAN Anomaly</th>
                <th className="p-3">Latency</th>
                <th className="p-3">Traffic Load</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    <RefreshCw size={18} className="animate-spin inline-block mr-2" />
                    Loading assets from backend...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-red-500">
                    <AlertTriangle size={16} className="inline-block mr-2" />
                    {error}
                  </td>
                </tr>
              ) : !assetData || assetData.items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    No matching assets found for current filter criteria.
                  </td>
                </tr>
              ) : (
                assetData.items.map((asset) => (
                  <tr
                    key={asset.asset_id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
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
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          asset.is_at_risk
                            ? 'bg-red-500/20 text-red-500 border border-red-500/30'
                            : 'bg-emerald-500/20 text-emerald-500'
                        }`}
                      >
                        {asset.risk_label} ({(asset.risk_score * 100).toFixed(0)}%)
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          asset.is_anomaly
                            ? 'bg-purple-500/20 text-purple-500 border border-purple-500/30'
                            : 'bg-emerald-500/20 text-emerald-500'
                        }`}
                      >
                        {asset.is_anomaly ? 'Anomaly' : 'Inlier'}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {asset.latency_ms.toFixed(1)} ms
                    </td>
                    <td className="p-3 font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {asset.traffic_load_pct.toFixed(1)}%
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => navigate(`/map?asset=${encodeURIComponent(asset.asset_id)}`)}
                        className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-900 hover:bg-blue-600 hover:text-white text-slate-700 dark:text-slate-300 font-medium text-[11px] transition-colors border border-slate-300 dark:border-slate-700 inline-flex items-center gap-1"
                      >
                        <MapPin size={12} />
                        <span>Locate</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paging */}
        {assetData && assetData.total > 12 && (
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span>
              Showing {((page - 1) * 12) + 1} to {Math.min(page * 12, assetData.total)} of {assetData.total} assets
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
                Page {page} of {Math.ceil(assetData.total / 12)}
              </span>
              <button
                disabled={page >= Math.ceil(assetData.total / 12)}
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
    </div>
  );
};
