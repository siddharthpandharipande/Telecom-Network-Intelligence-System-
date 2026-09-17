import React, { useState } from 'react';
import {
  ShieldAlert, AlertTriangle, CheckCircle2, Clock, UserCheck, Search, Filter, ShieldCheck, Zap, CornerUpRight
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

  return (
    <div className="p-6 space-y-6 font-mono">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
            <ShieldAlert className="text-red-400" size={28} />
            <span>Alerts & Incident Management</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time NOC operational workspace to monitor, investigate, escalate and resolve network incidents
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/15 border border-red-500/40 text-red-400 text-xs">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            <span>{incidents.filter(i => i.status !== 'RESOLVED').length} OPEN INCIDENTS</span>
          </div>
        </div>
      </div>

      {/* Alert Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div className="p-4 rounded-xl bg-[#0c1322] border border-red-500/50 bg-red-950/10 shadow-noc-red">
          <div className="text-slate-400 text-[10px]">CRITICAL INCIDENTS</div>
          <div className="text-2xl font-extrabold text-red-400 mt-1">3</div>
          <div className="text-[10px] text-red-300 mt-1">Requires immediate intervention</div>
        </div>
        <div className="p-4 rounded-xl bg-[#0c1322] border border-amber-500/40 bg-amber-950/10">
          <div className="text-slate-400 text-[10px]">HIGH SEVERITY</div>
          <div className="text-2xl font-extrabold text-amber-400 mt-1">7</div>
          <div className="text-[10px] text-amber-300 mt-1">Telemetry threshold breach</div>
        </div>
        <div className="p-4 rounded-xl bg-[#0c1322] border border-blue-500/40 bg-blue-950/10">
          <div className="text-slate-400 text-[10px]">MEDIUM SEVERITY</div>
          <div className="text-2xl font-extrabold text-blue-400 mt-1">8</div>
          <div className="text-[10px] text-blue-300 mt-1">Warning alerts active</div>
        </div>
        <div className="p-4 rounded-xl bg-[#0c1322] border border-emerald-500/40 bg-emerald-950/10">
          <div className="text-slate-400 text-[10px]">RESOLVED TODAY</div>
          <div className="text-2xl font-extrabold text-emerald-400 mt-1">42</div>
          <div className="text-[10px] text-emerald-300 mt-1">Average MTTR: 14.2 mins</div>
        </div>
      </div>

      {/* Main Operational Section: Active Incident Focus + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Incident Detail Focus & Operator Actions */}
        <div className="lg:col-span-2 p-6 rounded-xl bg-[#0c1322] border border-red-500/40 bg-gradient-to-br from-red-950/10 via-[#0c1322] to-[#0c1322] shadow-noc-card space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#1e2d4a] pb-4 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-400 font-bold tracking-widest">ACTIVE INCIDENT FOCUS</span>
                <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] font-bold">
                  {currentIncident.id}
                </span>
              </div>
              <h2 className="text-xl font-extrabold text-slate-100 mt-1">
                ASSET {currentIncident.assetId} — {currentIncident.region}
              </h2>
            </div>
            <StatusBadge status={currentIncident.status} size="lg" />
          </div>

          {/* Incident Metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-[#080d19] border border-[#1e2d4a]">
              <div className="text-[10px] text-slate-400">DETECTED AT</div>
              <div className="text-sm font-bold text-slate-100">{currentIncident.detectedTime}</div>
            </div>
            <div className="p-3 rounded-lg bg-[#080d19] border border-[#1e2d4a]">
              <div className="text-[10px] text-slate-400">DETECTION SOURCE</div>
              <div className="text-sm font-bold text-purple-400">{currentIncident.detectionSource}</div>
            </div>
            <div className="p-3 rounded-lg bg-[#080d19] border border-[#1e2d4a]">
              <div className="text-[10px] text-slate-400">SUPPORTING AI</div>
              <div className="text-sm font-bold text-indigo-400">{currentIncident.supportingDetection}</div>
            </div>
            <div className="p-3 rounded-lg bg-[#080d19] border border-[#1e2d4a]">
              <div className="text-[10px] text-slate-400">ASSIGNED OPERATOR</div>
              <div className="text-sm font-bold text-cyan-400">{currentIncident.assignedOperator || 'Unassigned'}</div>
            </div>
          </div>

          {/* Operator Action Buttons Toolbar */}
          <div className="p-4 rounded-xl bg-[#080d19] border border-[#1e2d4a] space-y-3">
            <h3 className="text-xs font-bold text-slate-200">OPERATOR ACTION CONTROLS</h3>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => acknowledgeIncident(currentIncident.id)}
                className="px-3 py-2 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <UserCheck size={14} />
                <span>ACKNOWLEDGE</span>
              </button>

              <button
                onClick={() => assignIncident(currentIncident.id, 'NOC Lead Alex')}
                className="px-3 py-2 rounded-lg bg-cyan-600/80 hover:bg-cyan-500 text-black font-bold text-xs transition-colors flex items-center gap-1.5"
              >
                <UserCheck size={14} />
                <span>ASSIGN TO ME</span>
              </button>

              <button
                onClick={() => investigateIncident(currentIncident.id)}
                className="px-3 py-2 rounded-lg bg-purple-600/80 hover:bg-purple-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <Zap size={14} />
                <span>INVESTIGATE</span>
              </button>

              <button
                onClick={() => resolveIncident(currentIncident.id)}
                className="px-3 py-2 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 size={14} />
                <span>RESOLVE</span>
              </button>

              <button
                onClick={() => escalateIncident(currentIncident.id)}
                className="px-3 py-2 rounded-lg bg-red-600/80 hover:bg-red-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <CornerUpRight size={14} />
                <span>ESCALATE</span>
              </button>
            </div>
          </div>

          {/* Incident Timeline */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <Clock size={16} className="text-cyan-400" />
              <span>INCIDENT AUDIT TIMELINE LOG</span>
            </h3>

            <div className="space-y-2 relative border-l-2 border-[#1e2d4a] ml-2 pl-4 text-xs">
              {currentIncident.timeline.map((evt, idx) => (
                <div key={idx} className="relative space-y-0.5">
                  <span className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border ${
                    evt.type === 'critical' ? 'bg-red-500 border-red-400 animate-ping' : evt.type === 'anomaly' ? 'bg-purple-500 border-purple-400' : 'bg-cyan-500 border-cyan-400'
                  }`}></span>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[10px]">{evt.time}</span>
                    <span className="text-[10px] text-cyan-400 uppercase font-bold">{evt.type}</span>
                  </div>
                  <div className="text-slate-200">{evt.event}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Active Incidents Selector list */}
        <div className="p-6 rounded-xl bg-[#0c1322] border border-[#1e2d4a] space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-100 border-b border-[#1e2d4a] pb-3 mb-3">
              ACTIVE NOC INCIDENTS ({incidents.length})
            </h3>

            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {incidents.map(inc => (
                <div
                  key={inc.id}
                  onClick={() => setSelectedIncident(inc)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    currentIncident.id === inc.id
                      ? 'bg-[#111b30] border-cyan-500 shadow-noc-cyan'
                      : 'bg-[#080d19] border-[#1e2d4a] hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-cyan-400 text-xs">{inc.id}</span>
                    <StatusBadge status={inc.status} size="sm" />
                  </div>
                  <div className="text-xs text-slate-200 mt-1 font-bold">Asset: {inc.assetId}</div>
                  <div className="text-[10px] text-slate-400 justify-between flex mt-1">
                    <span>Region: {inc.region}</span>
                    <span>{inc.detectedTime}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Active Alerts Table */}
      <div className="p-6 rounded-xl bg-[#0c1322] border border-[#1e2d4a] space-y-4">
        <h2 className="text-base font-bold text-slate-100">SYSTEM TELEMETRY ALERT FEED</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1e2d4a] text-slate-400 bg-[#080d19]">
                <th className="p-3">SEVERITY</th>
                <th className="p-3">ALERT TITLE</th>
                <th className="p-3">ASSET ID</th>
                <th className="p-3">TIME</th>
                <th className="p-3">DETECTION SOURCE</th>
                <th className="p-3">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2d4a]">
              {alerts.map(alert => (
                <tr key={alert.id} className="hover:bg-[#111b30] transition-colors">
                  <td className="p-3"><StatusBadge status={alert.severity === 'critical' ? 'Critical' : 'Warning'} size="sm" /></td>
                  <td className="p-3 font-bold text-slate-100">{alert.title}</td>
                  <td className="p-3 text-cyan-400">{alert.assetId}</td>
                  <td className="p-3 text-slate-400">{alert.timestamp}</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">{alert.detectionSource}</span></td>
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
