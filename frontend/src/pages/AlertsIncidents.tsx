import React, { useState } from 'react';
import {
  ShieldAlert, AlertTriangle, CheckCircle2, Clock, UserCheck, Zap, CornerUpRight
} from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';
import { useTelemetry } from '../context/TelemetryContext';
import { Incident } from '../types/telecom';

export const AlertsIncidents: React.FC = () => {
  const {
    alerts,
    incidents,
    acknowledgeIncident,
    assignIncident,
    investigateIncident,
    resolveIncident,
    escalateIncident
  } = useTelemetry();

  const [selectedIncident, setSelectedIncident] = useState<Incident>(incidents[0]);

  // Keep selectedIncident in sync with telemetry context
  const currentIncident = incidents.find(i => i.id === selectedIncident.id) || incidents[0];
  const activeIncidentsCount = incidents.filter(i => i.status !== 'RESOLVED').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
            <ShieldAlert className="text-red-400" size={24} />
            <span>Alerts & Incident Management</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time NOC workspace to track, investigate, escalate, and resolve network incidents.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span>{activeIncidentsCount} Open Incidents</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div className="p-4 rounded-xl bg-[#1e293b] border border-[#334155] shadow-sm space-y-1">
          <div className="text-slate-400 text-[11px]">Critical Incidents</div>
          <div className="text-2xl font-bold text-red-400">3</div>
          <div className="text-[11px] text-red-300">Requires immediate action</div>
        </div>
        <div className="p-4 rounded-xl bg-[#1e293b] border border-[#334155] shadow-sm space-y-1">
          <div className="text-slate-400 text-[11px]">High Severity</div>
          <div className="text-2xl font-bold text-amber-400">7</div>
          <div className="text-[11px] text-amber-300 font-medium">Threshold breach</div>
        </div>
        <div className="p-4 rounded-xl bg-[#1e293b] border border-[#334155] shadow-sm space-y-1">
          <div className="text-slate-400 text-[11px]">Medium Severity</div>
          <div className="text-2xl font-bold text-blue-400">8</div>
          <div className="text-[11px] text-slate-400">Warning alerts</div>
        </div>
        <div className="p-4 rounded-xl bg-[#1e293b] border border-[#334155] shadow-sm space-y-1">
          <div className="text-slate-400 text-[11px]">Resolved Today</div>
          <div className="text-2xl font-bold text-emerald-400">42</div>
          <div className="text-[11px] text-emerald-300">Avg MTTR: 14 mins</div>
        </div>
      </div>

      {/* Main Incident Focus Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Incident Details */}
        <div className="lg:col-span-2 p-6 rounded-xl bg-[#1e293b] border border-[#334155] shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#334155] pb-4 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-blue-400 font-semibold">Active Incident Focus</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-mono">
                  {currentIncident.id}
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-100 mt-1">
                Node {currentIncident.assetId} — {currentIncident.region}
              </h2>
            </div>
            <StatusBadge status={currentIncident.status} size="lg" />
          </div>

          {/* Incident Metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-[#0f172a] border border-[#334155]">
              <div className="text-[11px] text-slate-400">Detected At</div>
              <div className="text-sm font-semibold text-slate-200 mt-0.5">{currentIncident.detectedTime}</div>
            </div>
            <div className="p-3 rounded-lg bg-[#0f172a] border border-[#334155]">
              <div className="text-[11px] text-slate-400">Detection Source</div>
              <div className="text-sm font-semibold text-indigo-400 mt-0.5">{currentIncident.detectionSource}</div>
            </div>
            <div className="p-3 rounded-lg bg-[#0f172a] border border-[#334155]">
              <div className="text-[11px] text-slate-400">Supporting Model</div>
              <div className="text-sm font-semibold text-purple-400 mt-0.5">{currentIncident.supportingDetection}</div>
            </div>
            <div className="p-3 rounded-lg bg-[#0f172a] border border-[#334155]">
              <div className="text-[11px] text-slate-400">Assigned Operator</div>
              <div className="text-sm font-semibold text-blue-400 mt-0.5">{currentIncident.assignedOperator || 'Unassigned'}</div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 rounded-xl bg-[#0f172a] border border-[#334155] space-y-3">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Operator Action Controls</h3>

            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => acknowledgeIncident(currentIncident.id)}
                className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <UserCheck size={14} />
                <span>Acknowledge</span>
              </button>

              <button
                onClick={() => assignIncident(currentIncident.id, 'NOC Analyst')}
                className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5"
              >
                <UserCheck size={14} />
                <span>Assign to Me</span>
              </button>

              <button
                onClick={() => investigateIncident(currentIncident.id)}
                className="px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5"
              >
                <Zap size={14} />
                <span>Investigate</span>
              </button>

              <button
                onClick={() => resolveIncident(currentIncident.id)}
                className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 size={14} />
                <span>Resolve</span>
              </button>

              <button
                onClick={() => escalateIncident(currentIncident.id)}
                className="px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5"
              >
                <CornerUpRight size={14} />
                <span>Escalate</span>
              </button>
            </div>
          </div>

          {/* Incident Timeline */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Clock size={15} className="text-blue-400" />
              <span>Incident Audit Timeline</span>
            </h3>

            <div className="space-y-3 relative border-l border-[#334155] ml-2 pl-4 text-xs">
              {currentIncident.timeline.map((evt, idx) => (
                <div key={idx} className="relative space-y-1">
                  <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-[#1e293b]"></span>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">{evt.time}</span>
                    <span className="text-[10px] text-slate-400 uppercase">{evt.type}</span>
                  </div>
                  <div className="text-slate-200">{evt.event}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Incident Selection List */}
        <div className="p-6 rounded-xl bg-[#1e293b] border border-[#334155] shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-100 border-b border-[#334155] pb-3 mb-3">
              Active Incidents ({incidents.length})
            </h3>

            <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
              {incidents.map(inc => (
                <div
                  key={inc.id}
                  onClick={() => setSelectedIncident(inc)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    currentIncident.id === inc.id
                      ? 'bg-[#0f172a] border-blue-500 shadow-sm'
                      : 'bg-[#0f172a]/50 border-[#334155] hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-blue-400 text-xs font-mono">{inc.id}</span>
                    <StatusBadge status={inc.status} size="sm" />
                  </div>
                  <div className="text-xs text-slate-200 mt-1.5 font-medium">Node: {inc.assetId}</div>
                  <div className="text-[11px] text-slate-400 justify-between flex mt-1">
                    <span>Region: {inc.region}</span>
                    <span>{inc.detectedTime}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Active Alerts Feed Table */}
      <div className="p-6 rounded-xl bg-[#1e293b] border border-[#334155] shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-100">Telemetry Alert Log Feed</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#334155] text-slate-400 bg-[#0f172a]">
                <th className="p-3 font-semibold">Severity</th>
                <th className="p-3 font-semibold">Alert Title</th>
                <th className="p-3 font-semibold">Node ID</th>
                <th className="p-3 font-semibold">Time</th>
                <th className="p-3 font-semibold">Source</th>
                <th className="p-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155]">
              {alerts.map(alert => (
                <tr key={alert.id} className="hover:bg-[#0f172a]/60 transition-colors">
                  <td className="p-3"><StatusBadge status={alert.severity === 'critical' ? 'Critical' : 'Warning'} size="sm" /></td>
                  <td className="p-3 font-semibold text-slate-100">{alert.title}</td>
                  <td className="p-3 text-blue-400 font-mono">{alert.assetId}</td>
                  <td className="p-3 text-slate-400">{alert.timestamp}</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">{alert.detectionSource}</span></td>
                  <td className="p-3 text-slate-300">{alert.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

