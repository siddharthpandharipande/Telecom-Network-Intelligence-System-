import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  MapPin,
  Cpu,
  ScatterChart,
  ShieldAlert,
  Server,
  BarChart3,
  Settings,
  Radio,
  ChevronRight,
  Database
} from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: number | string;
  badgeColor?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<{ collapsed: boolean; toggleCollapse: () => void }> = ({ collapsed }) => {
  const { incidents, alerts } = useTelemetry();

  const criticalIncidentsCount = incidents.filter(i => i.status !== 'RESOLVED').length;
  const activeAlertsCount = alerts.filter(a => a.status !== 'Resolved').length;

  const sections: NavSection[] = [
    {
      title: 'COMPANY TELEMETRY',
      items: [
        {
          label: 'Company Data Input',
          path: '/data-input',
          icon: <Database size={18} className="text-cyan-400" />,
          badge: 'INGEST SOURCE',
          badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-noc-cyan animate-pulse'
        },
      ]
    },
    {
      title: 'MAIN',
      items: [
        { label: 'Overview', path: '/', icon: <LayoutDashboard size={18} /> },
        { label: 'Network Health', path: '/health', icon: <Activity size={18} /> },
        { label: 'Live Network Map', path: '/map', icon: <MapPin size={18} /> },
      ]
    },
    {
      title: 'AI INTELLIGENCE',
      items: [
        { label: 'SVM Risk Prediction', path: '/svm', icon: <Cpu size={18} />, badge: '94.7%', badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
        { label: 'DBSCAN Anomaly Detection', path: '/dbscan', icon: <ScatterChart size={18} />, badge: '14 Outliers', badgeColor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
      ]
    },
    {
      title: 'OPERATIONS',
      items: [
        {
          label: 'Alerts & Incidents',
          path: '/incidents',
          icon: <ShieldAlert size={18} />,
          badge: criticalIncidentsCount > 0 ? `${criticalIncidentsCount} Critical` : `${activeAlertsCount}`,
          badgeColor: criticalIncidentsCount > 0 ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
        },
      ]
    },
    {
      title: 'NETWORK',
      items: [
        { label: 'Network Assets', path: '/assets', icon: <Server size={18} /> },
        { label: 'Analytics', path: '/analytics', icon: <BarChart3 size={18} /> },
      ]
    },
    {
      title: 'SYSTEM',
      items: [
        { label: 'Settings', path: '/settings', icon: <Settings size={18} /> },
      ]
    }
  ];

  return (
    <aside
      className={`fixed top-0 left-0 h-screen z-40 bg-[#080d19] border-r border-[#1e2d4a] transition-all duration-300 flex flex-col ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center px-4 border-b border-[#1e2d4a] bg-[#0c1322]/80">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#00f0ff] to-[#2563eb] flex items-center justify-center shadow-noc-cyan flex-shrink-0">
            <Radio size={22} className="text-black stroke-[2.5]" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-extrabold text-lg tracking-wider bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-300 bg-clip-text text-transparent">
                NEXUSNET
              </span>
              <span className="text-[10px] text-cyan-400/80 font-mono tracking-widest uppercase">
                Network Intelligence
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            {!collapsed && (
              <h3 className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                {section.title}
              </h3>
            )}
            <div className="space-y-1">
              {section.items.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `group flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-[#00f0ff]/15 to-[#2563eb]/20 text-[#00f0ff] border border-[#00f0ff]/30 shadow-noc-cyan'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-[#111b30]'
                    }`
                  }
                  title={collapsed ? item.label : undefined}
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-3">
                        <span className={`transition-colors ${isActive ? 'text-[#00f0ff]' : 'text-slate-400 group-hover:text-slate-200'}`}>
                          {item.icon}
                        </span>
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </div>

                      {!collapsed && item.badge && (
                        <span className={`px-2 py-0.5 text-[10px] font-mono rounded-full border ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      )}

                      {!collapsed && isActive && (
                        <ChevronRight size={14} className="text-[#00f0ff] animate-pulse" />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Status */}
      {!collapsed && (
        <div className="p-3 m-3 rounded-lg bg-[#0c1322] border border-[#1e2d4a] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-slate-300 font-mono text-[11px]">NOC ENGINE ACTIVE</span>
          </div>
          <span className="text-[10px] text-cyan-400 font-mono">v4.2.0</span>
        </div>
      )}
    </aside>
  );
};
