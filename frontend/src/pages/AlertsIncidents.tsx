import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  UserCheck,
  Zap,
  CornerUpRight,
  RefreshCw,
  Search,
  Filter,
  Check,
  XCircle,
} from 'lucide-react';
import { getIncidents, applyIncidentAction } from '../api/client';
import { useApiStatus } from '../api/hooks';
import { Incident } from '../types/api';

export const AlertsIncidents: React.FC = () => {
  const { isOnline } = useApiStatus();

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [selectedIncidentId, setSelectedIncidentId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [page, setPage] = useState<number>(1);

  // Fetch Incidents
  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const params: { status?: string; severity?: string; page: number; page_size: number } = {
        page,
        page_size: 15,
      };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (severityFilter !== 'all') params.severity = severityFilter;

      const res = await getIncidents(params);
      setIncidents(res.items);
      setTotalCount(res.total);

      if (res.items.length > 0 && (!selectedIncidentId || !res.items.some((i) => i.id === selectedIncidentId))) {
        setSelectedIncidentId(res.items[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load incidents from API:', err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, severityFilter]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  // Currently focused incident
  const currentIncident = incidents.find((i) => i.id === selectedIncidentId) || incidents[0] || null;

  // Handle action dispatch (acknowledge, assign, investigate, resolve, escalate)
  const handleAction = async (action: string, assignee?: string, note?: string) => {
    if (!currentIncident || !isOnline) return;
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const updated = await applyIncidentAction(currentIncident.id, {
        action,
        assignee: assignee || 'NOC Operator',
        note: note || `Dispatched action "${action}" from NOC console`,
        actor: 'noc_console',
      });

      setActionSuccess(`Incident #${currentIncident.id} successfully updated to status: ${updated.status}`);
      // Refresh incidents to update list and current selection
      await fetchIncidents();
    } catch (err: any) {
      if (err.code === 'CONFLICT' || err.message?.includes('409') || err.message?.includes('Cannot transition')) {
        setActionError(
          `Action Conflict: Cannot perform "${action}" while incident is in "${currentIncident.status}" status. (${err.message})`
        );
      } else {
        setActionError(err.message || `Failed to perform action "${action}" on incident.`);
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Severity style helper
  const getSeverityBadge = (sev: string) => {
    switch (sev?.toLowerCase()) {
      case 'critical':
        return 'bg-red-500/20 text-red-500 border border-red-500/30';
      case 'high':
        return 'bg-amber-500/20 text-amber-500 border border-amber-500/30';
      default:
        return 'bg-blue-500/20 text-blue-500 border border-blue-500/30';
    }
  };

  // Status style helper
  const getStatusBadge = (st: string) => {
    switch (st?.toLowerCase()) {
      case 'open':
        return 'bg-red-500/20 text-red-500 border-red-500/30';
      case 'acknowledged':
        return 'bg-amber-500/20 text-amber-500 border-amber-500/30';
      case 'assigned':
        return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
      case 'investigating':
        return 'bg-purple-500/20 text-purple-500 border-purple-500/30';
      case 'resolved':
        return 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30';
      case 'escalated':
        return 'bg-rose-500/20 text-rose-500 border-rose-500/30 font-bold';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  // Counters
  const openCount = incidents.filter((i) => i.status === 'open').length;
  const inProgressCount = incidents.filter((i) => ['acknowledged', 'assigned', 'investigating'].includes(i.status)).length;
  const resolvedCount = incidents.filter((i) => i.status === 'resolved').length;
  const criticalCount = incidents.filter((i) => i.severity === 'critical').length;

  return (
    <div className="p-6 space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <ShieldAlert className="text-red-500" size={24} />
            <span>NOC Alerts & Incident Management</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Network Operations Center workflow to track, investigate, escalate, and resolve operational telemetry incidents.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchIncidents()}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors flex items-center gap-1.5 border border-slate-300 dark:border-slate-700"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>{totalCount} Total Incidents in DB</span>
          </div>
        </div>
      </div>

      {/* KPI Cards derived from real database state */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-1">
          <div className="text-slate-500 text-[11px]">Unresolved / Open</div>
          <div className="text-2xl font-bold text-red-500 font-mono">{openCount}</div>
          <div className="text-[11px] text-red-400">Awaiting acknowledgement</div>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-1">
          <div className="text-slate-500 text-[11px]">In Progress / Triage</div>
          <div className="text-2xl font-bold text-amber-500 font-mono">{inProgressCount}</div>
          <div className="text-[11px] text-amber-400">Assigned / Investigating</div>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-1">
          <div className="text-slate-500 text-[11px]">Critical Severity</div>
          <div className="text-2xl font-bold text-rose-500 font-mono">{criticalCount}</div>
          <div className="text-[11px] text-rose-400">High operational urgency</div>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-1">
          <div className="text-slate-500 text-[11px]">Resolved Incidents</div>
          <div className="text-2xl font-bold text-emerald-500 font-mono">{resolvedCount}</div>
          <div className="text-[11px] text-emerald-400">Audit trail preserved</div>
        </div>
      </div>

      {/* Action Banners */}
      {actionError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <XCircle size={16} className="flex-shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-slate-400 hover:text-slate-100 text-xs">
            Dismiss
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-slate-400 hover:text-slate-100 text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Detail + List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Incident Detail (2 cols) */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
          {currentIncident ? (
            <>
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-4 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-blue-500 font-semibold uppercase tracking-wider">
                      Incident Focus
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-mono">
                      #{currentIncident.id}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getSeverityBadge(
                        currentIncident.severity
                      )}`}
                    >
                      {currentIncident.severity}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
                    Asset {currentIncident.asset_id}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">{currentIncident.title}</p>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusBadge(
                    currentIncident.status
                  )}`}
                >
                  {currentIncident.status}
                </span>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <div className="text-[11px] text-slate-500">Detected At</div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">
                    {new Date(currentIncident.created_at).toLocaleString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <div className="text-[11px] text-slate-500">Detection Source</div>
                  <div className="text-xs font-semibold text-indigo-500 mt-0.5 capitalize">
                    {currentIncident.source === 'auto' ? 'Automated Monitor' : currentIncident.source}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <div className="text-[11px] text-slate-500">Reading Ref</div>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5 font-mono">
                    {currentIncident.reading_id ? `#${currentIncident.reading_id}` : 'None'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <div className="text-[11px] text-slate-500">Assignee</div>
                  <div className="text-xs font-semibold text-blue-500 mt-0.5">
                    {currentIncident.assignee || 'Unassigned'}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-3">
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Operator Workflow Controls
                </h3>

                <div className="flex flex-wrap gap-2.5">
                  <button
                    disabled={actionLoading || !isOnline}
                    onClick={() => handleAction('acknowledge')}
                    className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <UserCheck size={14} />
                    <span>Acknowledge</span>
                  </button>

                  <button
                    disabled={actionLoading || !isOnline}
                    onClick={() => handleAction('assign', 'NOC Engineer')}
                    className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <UserCheck size={14} />
                    <span>Assign to Me</span>
                  </button>

                  <button
                    disabled={actionLoading || !isOnline}
                    onClick={() => handleAction('investigate')}
                    className="px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Zap size={14} />
                    <span>Investigate</span>
                  </button>

                  <button
                    disabled={actionLoading || !isOnline}
                    onClick={() => handleAction('resolve')}
                    className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} />
                    <span>Resolve</span>
                  </button>

                  <button
                    disabled={actionLoading || !isOnline}
                    onClick={() => handleAction('escalate')}
                    className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <CornerUpRight size={14} />
                    <span>Escalate</span>
                  </button>
                </div>
              </div>

              {/* Audit Timeline */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Clock size={15} className="text-blue-500" />
                  <span>Incident Audit Timeline</span>
                </h3>

                <div className="space-y-3 relative border-l border-slate-200 dark:border-slate-700 ml-2 pl-4 text-xs">
                  {currentIncident.events && currentIncident.events.length > 0 ? (
                    currentIncident.events.map((evt, idx) => (
                      <div key={idx} className="relative space-y-1">
                        <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white dark:border-slate-800" />
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 text-[11px] font-mono">
                            {new Date(evt.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-blue-500">
                            {evt.action}
                          </span>
                        </div>
                        <div className="text-slate-800 dark:text-slate-200 font-medium">
                          {evt.note || (evt.from_status ? `Transition: ${evt.from_status} → ${evt.to_status}` : 'Action recorded')}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">Actor: {evt.actor}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-400 text-xs">No audit events recorded for this incident yet.</div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">
              No incident selected or database is empty. Dispatch an incident from the Map or SVM page.
            </div>
          )}
        </div>

        {/* Incident Selection List (1 col) */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3 mb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Incidents List ({totalCount})
              </h3>
            </div>

            {/* Filter controls */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="assigned">Assigned</option>
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved</option>
                <option value="escalated">Escalated</option>
              </select>

              <select
                value={severityFilter}
                onChange={(e) => {
                  setSeverityFilter(e.target.value);
                  setPage(1);
                }}
                className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
              </select>
            </div>

            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {loading ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  <RefreshCw size={18} className="animate-spin inline-block mr-2" />
                  Loading incidents...
                </div>
              ) : incidents.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  No incidents matching current criteria.
                </div>
              ) : (
                incidents.map((inc) => (
                  <div
                    key={inc.id}
                    onClick={() => setSelectedIncidentId(inc.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      currentIncident?.id === inc.id
                        ? 'bg-blue-50/50 dark:bg-slate-900 border-blue-500 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-blue-500 text-xs font-mono">#{inc.id}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getStatusBadge(
                          inc.status
                        )}`}
                      >
                        {inc.status}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1.5 font-mono">
                      Asset {inc.asset_id}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">{inc.title}</div>
                    <div className="text-[10px] text-slate-400 flex justify-between mt-1 pt-1 border-t border-slate-200 dark:border-slate-800">
                      <span className="capitalize">{inc.severity} priority</span>
                      <span>
                        {new Date(inc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
