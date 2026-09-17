import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, Search, Filter, RefreshCw, Radio, Users, Gauge, Zap, PhoneOff, Signal, Cpu, ArrowUpDown, Database
} from 'lucide-react';
import { MetricCard } from '../components/common/MetricCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { useTelemetry } from '../context/TelemetryContext';

export const NetworkHealth: React.FC = () => {
  const navigate = useNavigate();
  const { cells, setSelectedCell, isLive, setIsLive, lastTelemetryTime } = useTelemetry();

  const [search, setSearch] = useState<string>('');
  const [regionFilter, setRegionFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [sortField, setSortField] = useState<'latency' | 'packetLoss' | 'trafficLoad' | 'users'>('latency');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const filteredCells = cells.filter(cell => {
    const matchesSearch = cell.id.toLowerCase().includes(search.toLowerCase()) ||
                          cell.name.toLowerCase().includes(search.toLowerCase()) ||
                          cell.region.toLowerCase().includes(search.toLowerCase());
    const matchesRegion = regionFilter === 'All' || cell.region === regionFilter;
    const matchesStatus = statusFilter === 'All' || cell.status === statusFilter.toLowerCase();
    return matchesSearch && matchesRegion && matchesStatus;
  }).sort((a, b) => {
    const valA = a[sortField];
    const valB = b[sortField];
    return sortAsc ? valA - valB : valB - valA;
  });

  const regions = ['All', 'Pune', 'Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Chennai', 'Ahmedabad', 'Kolkata'];

  return (
    <div className="p-6 space-y-6 font-mono">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
            <Activity size={28} className="text-cyan-400" />
            <span>Real-Time Network Health Dashboard</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Live telemetry health monitoring displaying all submitted company network data & operational metrics
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>TELEMETRY STREAM OPERATIONAL</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0c1322] border border-[#1e2d4a] text-cyan-400 text-xs">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            <span>● LIVE DATA</span>
            <span className="text-slate-400 text-[10px] ml-1">({lastTelemetryTime})</span>
          </div>
        </div>
      </div>

      {/* Pipeline Visualizer Strip */}
      <div className="p-3 rounded-xl bg-[#080d19] border border-[#1e2d4a] flex flex-wrap items-center justify-between text-xs gap-2">
        <span className="text-slate-400 font-bold">TELEMETRY PIPELINE STAGE:</span>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400">1. Company Input</span>
          <span>➔</span>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400">2. AI Inference</span>
          <span>➔</span>
          <span className="px-2.5 py-1 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold">
            3. Network Health Dashboard (ACTIVE)
          </span>
          <span>➔</span>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400">4. Interactive Live Map</span>
        </div>
      </div>

      {/* 8 Live Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="LATENCY"
          value="42"
          unit="ms"
          trend="▲ 4ms from baseline"
          trendDirection="down"
          status="warning"
          sparklineData={[28, 32, 35, 38, 45, 40, 42]}
          subtext="Target: < 50 ms"
          icon={<Activity size={16} />}
        />
        <MetricCard
          title="PACKET LOSS"
          value="1.8"
          unit="%"
          trend="▼ 0.2% improvement"
          trendDirection="up"
          status="healthy"
          sparklineData={[2.4, 2.1, 1.9, 1.8, 1.7, 1.8]}
          subtext="Threshold: < 2.0%"
          icon={<Zap size={16} />}
        />
        <MetricCard
          title="THROUGHPUT"
          value="8.42"
          unit="Gbps"
          trend="▲ 12% peak traffic"
          trendDirection="up"
          status="healthy"
          sparklineData={[7.2, 7.8, 8.1, 8.0, 8.3, 8.42]}
          subtext="Capacity: 10 Gbps"
          icon={<Radio size={16} />}
        />
        <MetricCard
          title="TRAFFIC LOAD"
          value="71"
          unit="%"
          trend="Normal distribution"
          trendDirection="neutral"
          status="healthy"
          sparklineData={[62, 65, 68, 70, 72, 71]}
          subtext="Max Limit: 85%"
          icon={<Gauge size={16} />}
        />
        <MetricCard
          title="CONNECTED USERS"
          value="1.84"
          unit="M"
          trend="▲ 45K active sessions"
          trendDirection="up"
          status="healthy"
          sparklineData={[1.72, 1.76, 1.80, 1.82, 1.84]}
          subtext="Active 5G / 4G Subscribers"
          icon={<Users size={16} />}
        />
        <MetricCard
          title="CALL DROP RATE"
          value="1.2"
          unit="%"
          trend="▲ 0.3% elevated in Pune"
          trendDirection="down"
          status="warning"
          sparklineData={[0.8, 0.9, 1.0, 1.1, 1.2]}
          subtext="SLA Limit: < 1.0%"
          icon={<PhoneOff size={16} />}
        />
        <MetricCard
          title="SIGNAL QUALITY"
          value="94"
          unit="%"
          trend="Optimal Coverage"
          trendDirection="up"
          status="healthy"
          sparklineData={[91, 92, 94, 93, 94, 94]}
          subtext="Average RSRP -82 dBm"
          icon={<Signal size={16} />}
        />
        <MetricCard
          title="RESOURCE UTILIZATION"
          value="68"
          unit="%"
          trend="Balanced CPU / Memory"
          trendDirection="neutral"
          status="healthy"
          sparklineData={[60, 62, 65, 66, 68]}
          subtext="Baseband Processing Unit"
          icon={<Cpu size={16} />}
        />
      </div>

      {/* Complete Table of All Submitted Network Data */}
      <div className="p-6 rounded-xl bg-[#0c1322] border border-[#1e2d4a] space-y-4">
        {/* Table Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-100">
              SUBMITTED COMPANY TELEMETRY INVENTORY TABLE ({filteredCells.length})
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search cell ID, location..."
                className="pl-8 pr-3 py-1.5 bg-[#080d19] border border-[#1e2d4a] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Region Filter */}
            <select
              value={regionFilter}
              onChange={e => setRegionFilter(e.target.value)}
              className="px-3 py-1.5 bg-[#080d19] border border-[#1e2d4a] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
            >
              {regions.map(r => (
                <option key={r} value={r}>Region: {r}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-[#080d19] border border-[#1e2d4a] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
            >
              <option value="All">Status: All</option>
              <option value="healthy">Healthy</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>

            <button
              onClick={() => setIsLive(!isLive)}
              className={`p-1.5 rounded-lg border text-xs transition-colors ${
                isLive ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40' : 'bg-[#080d19] text-slate-400 border-[#1e2d4a]'
              }`}
              title="Auto Refresh Telemetry"
            >
              <RefreshCw size={14} className={isLive ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Data Table showing exact submitted company network fields */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1e2d4a] text-slate-400 bg-[#080d19]">
                <th className="p-3">CELL/TOWER ID</th>
                <th className="p-3">ASSET TYPE</th>
                <th className="p-3">LATITUDE</th>
                <th className="p-3">LONGITUDE</th>
                <th className="p-3">LATENCY</th>
                <th className="p-3">PACKET LOSS</th>
                <th className="p-3">TRAFFIC LOAD</th>
                <th className="p-3">SIGNAL</th>
                <th className="p-3">TIMESTAMP</th>
                <th className="p-3">HEALTH STATUS</th>
                <th className="p-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2d4a]">
              {filteredCells.map(cell => (
                <tr
                  key={cell.id}
                  className={`hover:bg-[#111b30] transition-colors ${
                    cell.isCompanyIngested ? 'bg-cyan-950/15' : ''
                  }`}
                >
                  <td className="p-3 font-bold text-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-cyan-400">{cell.id}</span>
                      {cell.isCompanyIngested && (
                        <span className="px-1.5 py-0.5 text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded">
                          INGESTED
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 uppercase font-bold text-slate-300">{cell.assetType}</td>
                  <td className="p-3 text-slate-300">{cell.lat.toFixed(4)}</td>
                  <td className="p-3 text-slate-300">{cell.lng.toFixed(4)}</td>
                  <td className={`p-3 font-bold ${cell.latency > 100 ? 'text-red-400' : cell.latency > 60 ? 'text-amber-400' : 'text-slate-200'}`}>
                    {cell.latency} ms
                  </td>
                  <td className={`p-3 font-bold ${cell.packetLoss > 5 ? 'text-red-400' : cell.packetLoss > 2 ? 'text-amber-400' : 'text-slate-200'}`}>
                    {cell.packetLoss}%
                  </td>
                  <td className={`p-3 font-bold ${cell.trafficLoad > 90 ? 'text-red-400' : cell.trafficLoad > 80 ? 'text-amber-400' : 'text-slate-200'}`}>
                    {cell.trafficLoad}%
                  </td>
                  <td className="p-3 text-slate-300">{cell.signalStrength} dBm</td>
                  <td className="p-3 text-slate-400">{cell.timestamp || cell.lastUpdated}</td>
                  <td className="p-3">
                    <StatusBadge status={cell.status} size="sm" />
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => {
                        setSelectedCell(cell);
                        navigate('/map');
                      }}
                      className="px-2.5 py-1 rounded bg-[#1e2d4a] hover:bg-cyan-600 text-slate-200 hover:text-black font-bold text-[11px] transition-colors"
                    >
                      MAP LOCATE
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
