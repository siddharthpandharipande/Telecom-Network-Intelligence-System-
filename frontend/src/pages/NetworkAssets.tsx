import React, { useState } from 'react';
import { Server, Radio, Router, Search, Filter } from 'lucide-react';
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
    <div className="p-6 space-y-6 font-mono">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
            <Server className="text-cyan-400" size={28} />
            <span>Network Infrastructure Assets</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Physical & virtual telecom inventory tracking across cell sites, base stations, and edge routers
          </p>
        </div>
      </div>

      {/* Asset Summary Count Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
        <div className="p-4 rounded-xl bg-[#0c1322] border border-[#1e2d4a]">
          <div className="text-slate-400 text-[10px]">MOBILE TOWERS</div>
          <div className="text-2xl font-extrabold text-slate-100 mt-1">1,240</div>
          <div className="text-[10px] text-cyan-400 mt-1">📡 Macro Cell Towers</div>
        </div>
        <div className="p-4 rounded-xl bg-[#0c1322] border border-[#1e2d4a]">
          <div className="text-slate-400 text-[10px]">NETWORK CELLS</div>
          <div className="text-2xl font-extrabold text-cyan-400 mt-1">2,486</div>
          <div className="text-[10px] text-slate-400 mt-1">◉ Active 5G/4G Sectors</div>
        </div>
        <div className="p-4 rounded-xl bg-[#0c1322] border border-[#1e2d4a]">
          <div className="text-slate-400 text-[10px]">BASE STATIONS</div>
          <div className="text-2xl font-extrabold text-indigo-400 mt-1">760</div>
          <div className="text-[10px] text-slate-400 mt-1">▣ gNodeB / eNodeB</div>
        </div>
        <div className="p-4 rounded-xl bg-[#0c1322] border border-[#1e2d4a]">
          <div className="text-slate-400 text-[10px]">ROUTERS</div>
          <div className="text-2xl font-extrabold text-amber-400 mt-1">486</div>
          <div className="text-[10px] text-slate-400 mt-1">◇ Backhaul Edge Routers</div>
        </div>
        <div className="p-4 rounded-xl bg-[#0c1322] border border-[#1e2d4a]">
          <div className="text-slate-400 text-[10px]">NETWORK LINKS</div>
          <div className="text-2xl font-extrabold text-purple-400 mt-1">3,820</div>
          <div className="text-[10px] text-slate-400 mt-1">Fiber & Microwave</div>
        </div>
      </div>

      {/* Asset Inventory Table */}
      <div className="p-6 rounded-xl bg-[#0c1322] border border-[#1e2d4a] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-base font-bold text-slate-100">INFRASTRUCTURE INVENTORY DIRECTORY</h2>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search asset ID..."
                className="pl-8 pr-3 py-1.5 bg-[#080d19] border border-[#1e2d4a] rounded-lg text-xs font-mono text-slate-200 focus:outline-none"
              />
            </div>

            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 bg-[#080d19] border border-[#1e2d4a] rounded-lg text-xs font-mono text-slate-200 focus:outline-none"
            >
              <option value="All">Type: All</option>
              <option value="tower">Towers</option>
              <option value="basestation">Base Stations</option>
              <option value="router">Routers</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1e2d4a] text-slate-400 bg-[#080d19]">
                <th className="p-3">ASSET ID</th>
                <th className="p-3">ASSET TYPE</th>
                <th className="p-3">NAME / REGION</th>
                <th className="p-3">STATUS</th>
                <th className="p-3">CURRENT LOAD</th>
                <th className="p-3">LAST TELEMETRY UPDATE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2d4a]">
              {filteredAssets.map(asset => (
                <tr key={asset.id} className="hover:bg-[#111b30] transition-colors">
                  <td className="p-3 font-bold text-cyan-400">{asset.id}</td>
                  <td className="p-3 uppercase text-slate-300 font-bold">{asset.type}</td>
                  <td className="p-3 text-slate-200">{asset.name} ({asset.region})</td>
                  <td className="p-3"><StatusBadge status={asset.status} size="sm" /></td>
                  <td className="p-3 text-slate-100 font-bold">{asset.currentLoad}%</td>
                  <td className="p-3 text-slate-400">{asset.lastUpdate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
