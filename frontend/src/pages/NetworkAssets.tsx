import React, { useState } from 'react';
import { Server, Radio, Router, Search, Filter, Shield } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';
import { useTelemetry } from '../context/TelemetryContext';

export const NetworkAssets: React.FC = () => {
  const { assets } = useTelemetry();
  const [search, setSearch] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('All');

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.id.toLowerCase().includes(search.toLowerCase()) ||
                          asset.name.toLowerCase().includes(search.toLowerCase()) ||
                          asset.region.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'All' || asset.type === typeFilter.toLowerCase();
    return matchesSearch && matchesType;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
            <Server className="text-blue-400" size={26} />
            <span>Network Infrastructure Assets</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Physical and virtual telecom inventory tracking across cell sites, base stations, and backhaul routers.
          </p>
        </div>
      </div>

      {/* Asset Summary Count Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">Mobile Towers</div>
          <div className="text-2xl font-bold text-slate-100 mt-1">1,240</div>
          <div className="text-xs text-blue-400 mt-1 flex items-center gap-1">📡 Macro Cell Towers</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">Network Cells</div>
          <div className="text-2xl font-bold text-blue-400 mt-1">2,486</div>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">Active 5G/4G Sectors</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">Base Stations</div>
          <div className="text-2xl font-bold text-indigo-400 mt-1">760</div>
          <div className="text-xs text-slate-400 mt-1">gNodeB / eNodeB</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">Edge Routers</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">486</div>
          <div className="text-xs text-slate-400 mt-1">Backhaul Edge Routers</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">Network Links</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">3,820</div>
          <div className="text-xs text-slate-400 mt-1">Fiber & Microwave</div>
        </div>
      </div>

      {/* Asset Inventory Table */}
      <div className="p-6 rounded-xl bg-slate-800/80 border border-slate-700 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-slate-100">Infrastructure Inventory Directory</h2>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by ID or region..."
                className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="All">Type: All Assets</option>
              <option value="tower">Cell Towers</option>
              <option value="basestation">Base Stations</option>
              <option value="router">Routers</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 bg-slate-900/60 font-semibold uppercase tracking-wider">
                <th className="p-3">Asset ID</th>
                <th className="p-3">Asset Type</th>
                <th className="p-3">Name & Region</th>
                <th className="p-3">Health Status</th>
                <th className="p-3">Current Load</th>
                <th className="p-3">Last Telemetry Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {filteredAssets.map(asset => (
                <tr key={asset.id} className="hover:bg-slate-700/40 transition-colors">
                  <td className="p-3 font-mono font-bold text-blue-400">{asset.id}</td>
                  <td className="p-3 text-slate-300 font-medium capitalize">{asset.type}</td>
                  <td className="p-3 text-slate-200">{asset.name} <span className="text-slate-400">({asset.region})</span></td>
                  <td className="p-3"><StatusBadge status={asset.status} size="sm" /></td>
                  <td className="p-3 text-slate-100 font-semibold">{asset.currentLoad}%</td>
                  <td className="p-3 text-slate-400 font-mono text-[11px]">{asset.lastUpdate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

