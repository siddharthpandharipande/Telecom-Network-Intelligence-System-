import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  MapPin,
  Brain,
  ShieldAlert,
  Server,
  Settings,
  Radio,
  Database,
  ChevronRight,
  FileText,
  BarChart3,
  Radar
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
  title?: string;
  items: NavItem[];
}

export const Sidebar: React.FC<{ collapsed: boolean; toggleCollapse: () => void }> = ({ collapsed }) => {
  const { incidents } = useTelemetry();
  const criticalCount = incidents.filter(i => i.status !== 'RESOLVED').length;

  const sections: NavSection[] = [
    {
      title: 'PLATFORM',
      items: [
        { label: 'Overview', path: '/', icon: <LayoutDashboard size={18} /> },
        { label: 'Data Ingestion', path: '/data-input', icon: <Database size={18} /> },
        { label: 'Network Map', path: '/map', icon: <MapPin size={18} /> },
        { label: 'AI Diagnostics', path: '/svm', icon: <Brain size={18} /> },
        { label: 'DBSCAN Anomalies', path: '/dbscan', icon: <Radar size={18} /> },
        { label: 'Analytics', path: '/analytics', icon: <BarChart3 size={18} /> },
        {
          label: 'Alerts & Incidents',
          path: '/incidents',
          icon: <ShieldAlert size={18} />,
          badge: criticalCount > 0 ? criticalCount : undefined,
          badgeColor: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
        },
      ]
    },
    {
      title: 'MANAGEMENT',
      items: [
        { label: 'Network Health', path: '/health', icon: <Activity size={18} /> },
        { label: 'Network Assets', path: '/assets', icon: <Server size={18} /> },
        { label: 'Model Card', path: '/model', icon: <FileText size={18} /> },
        { label: 'Settings', path: '/settings', icon: <Settings size={18} /> },
      ]
    }
  ];

  return (
    <aside
      className={`fixed top-0 left-0 h-screen z-40 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transition-all duration-300 flex flex-col ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center px-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/60">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white flex-shrink-0 shadow-md">
            <Radio size={20} className="stroke-[2.5]" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white">
                NEXUSNET
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Telecom Intelligence
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-5 px-3 space-y-6">
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-1.5">
            {!collapsed && section.title && (
              <h3 className="px-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {section.title}
              </h3>
            )}
            <div className="space-y-1">
              {section.items.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `group flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 font-bold shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50'
                    }`
                  }
                  title={collapsed ? item.label : undefined}
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-3">
                        <span className={`transition-colors ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'}`}>
                          {item.icon}
                        </span>
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </div>

                      {!collapsed && item.badge !== undefined && (
                        <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full border ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      )}

                      {!collapsed && isActive && (
                        <ChevronRight size={14} className="text-blue-600 dark:text-blue-400" />
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
        <div className="p-3.5 m-3 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-slate-700 dark:text-slate-300 font-medium">NOC Active</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">v1.0</span>
        </div>
      )}
    </aside>
  );
};


