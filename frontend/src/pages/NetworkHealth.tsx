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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
            <Activity size={24} className="text-blue-400" />
            <span>Network Health Metrics & Inventory</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time telemetry health indicators across latency, packet loss, throughput, and capacity.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Telemetry Active ({lastTelemetryTime})</span>
          </div>
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
          subtext="Active Subscribers"
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
          trend="Balanced Processing"
          trendDirection="neutral"
          status="healthy"
          sparklineData={[60, 62, 65, 66, 68]}
          subtext="Processing Unit"
          icon={<Cpu size={16} />}
        />
      </div>

      {/* Complete Table of All Submitted Network Data */}
      <div className="p-6 rounded-xl bg-[#1e293b] border border-[#334155] shadow-sm space-y-4">
        {/* Table Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-100">
              Network Telemetry Node Inventory ({filteredCells.length} Nodes)
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
                placeholder="Filter by Node ID..."
                className="pl-8 pr-3 py-1.5 bg-[#0f172a] border border-[#334155] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Region Filter */}
            <select
              value={regionFilter}
              onChange={e => setRegionFilter(e.target.value)}
              className="px-3 py-1.5 bg-[#0f172a] border border-[#334155] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              {regions.map(r => (
                <option key={r} value={r}>Region: {r}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-[#0f172a] border border-[#334155] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="All">Status: All</option>
              <option value="healthy">Healthy</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#334155] text-slate-400 bg-[#0f172a]">
                <th className="p-3 font-semibold">Node ID</th>
                <th className="p-3 font-semibold">Type</th>
                <th className="p-3 font-semibold">Coordinates</th>
                <th className="p-3 font-semibold">Latency</th>
                <th className="p-3 font-semibold">Packet Loss</th>
                <th className="p-3 font-semibold">Traffic Load</th>
                <th className="p-3 font-semibold">Signal</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155]">
              {filteredCells.map(cell => (
                <tr
                  key={cell.id}
                  className="hover:bg-[#0f172a]/60 transition-colors"
                >
                  <td className="p-3 font-bold text-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-blue-400">{cell.id}</span>
                      {cell.isCompanyIngested && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded">
                          Ingested
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 uppercase font-medium text-slate-300">{cell.assetType}</td>
                  <td className="p-3 text-slate-400 font-mono text-[11px]">{cell.lat.toFixed(4)}, {cell.lng.toFixed(4)}</td>
                  <td className={`p-3 font-semibold ${cell.latency > 100 ? 'text-red-400' : cell.latency > 60 ? 'text-amber-400' : 'text-slate-200'}`}>
                    {cell.latency} ms
                  </td>
                  <td className={`p-3 font-semibold ${cell.packetLoss > 5 ? 'text-red-400' : cell.packetLoss > 2 ? 'text-amber-400' : 'text-slate-200'}`}>
                    {cell.packetLoss}%
                  </td>
                  <td className={`p-3 font-semibold ${cell.trafficLoad > 90 ? 'text-red-400' : cell.trafficLoad > 80 ? 'text-amber-400' : 'text-slate-200'}`}>
                    {cell.trafficLoad}%
                  </td>
                  <td className="p-3 text-slate-300">{cell.signalStrength} dBm</td>
                  <td className="p-3">
                    <StatusBadge status={cell.status} size="sm" />
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => {
                        setSelectedCell(cell);
                        navigate('/map');
                      }}
                      className="px-2.5 py-1 rounded bg-[#0f172a] hover:bg-blue-600 text-slate-300 hover:text-white font-medium text-[11px] transition-colors border border-[#334155]"
                    >
                      Locate on Map
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

