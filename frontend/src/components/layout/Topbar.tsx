import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell, User, Menu, PlusCircle, Sun, Moon } from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';
import { useTheme } from '../../context/ThemeContext';

interface TopbarProps {
  collapsed: boolean;
  toggleCollapse: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ collapsed, toggleCollapse }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { searchQuery, setSearchQuery, findCellById, setSelectedCell, alerts } = useTelemetry();
  const { theme, toggleTheme } = useTheme();

  const [showNotifications, setShowNotifications] = useState<boolean>(false);

  const getBreadcrumb = () => {
    switch (location.pathname) {
      case '/': return 'Dashboard Overview';
      case '/data-input': return 'Telemetry Data Ingestion';
      case '/svm':
      case '/dbscan': return 'AI Model Diagnostics';
      case '/health': return 'Network Health Metrics';
      case '/map': return 'Network Map';
      case '/incidents': return 'Alerts & Incidents';
      case '/assets': return 'Network Assets';
      case '/analytics': return 'Network Analytics';
      case '/model': return 'Model Card';
      case '/settings': return 'Settings';
      default: return 'Overview';
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const matchedCell = findCellById(searchQuery.trim());
    if (matchedCell) {
      setSelectedCell(matchedCell);
      navigate('/map');
    }
  };

  const activeAlerts = alerts.filter(a => a.status !== 'Resolved');

  return (
    <header className={`fixed top-0 right-0 h-16 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 z-30 transition-all duration-300 flex items-center justify-between px-6 ${
      collapsed ? 'left-20' : 'left-64'
    }`}>
      {/* Left: Collapse Toggle & Breadcrumb */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleCollapse}
          className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-lg transition-colors"
          title="Toggle Sidebar"
        >
          <Menu size={18} />
        </button>

        <div className="flex items-center gap-2 text-xs font-medium">
          <span className="text-slate-400">NEXUSNET</span>
          <span className="text-slate-400">/</span>
          <span className="text-slate-900 dark:text-slate-100 font-semibold">{getBreadcrumb()}</span>
        </div>
      </div>

      {/* Center: Global Search */}
      <form onSubmit={handleSearch} className="relative hidden md:block w-64 lg:w-96">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search node ID, city, or tower..."
          className="w-full pl-9 pr-4 py-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-blue-500 rounded-lg text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none transition-all"
        />
      </form>

      {/* Right: Actions, Notifications & Profile */}
      <div className="flex items-center gap-3">
        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-lg transition-colors flex items-center justify-center"
          title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
        >
          {theme === 'dark' ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-slate-700" />}
        </button>

        {/* Quick Data Ingest Button */}
        <button
          onClick={() => navigate('/data-input')}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all"
        >
          <PlusCircle size={14} />
          <span>Ingest Data</span>
        </button>

        {/* Dataset Snapshot Indicator */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400"
          title="Dataset Snapshot: 2026-09-16 (6,000 synthetic assets)"
        >
          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          <span>Snapshot (2026-09-16)</span>
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-lg transition-colors relative"
          >
            <Bell size={18} />
            {activeAlerts.length > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {activeAlerts.length}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
                <span className="font-bold text-slate-900 dark:text-slate-100">Network Alerts</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-500 dark:text-red-400 font-semibold">
                  {activeAlerts.length} Active
                </span>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {activeAlerts.map(alert => (
                  <div
                    key={alert.id}
                    onClick={() => {
                      setShowNotifications(false);
                      navigate('/incidents');
                    }}
                    className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-red-500 dark:text-red-400 font-semibold text-xs">{alert.title}</span>
                      <span className="text-[10px] text-slate-400">{alert.timestamp}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Node: <strong className="text-slate-800 dark:text-slate-200">{alert.assetId}</strong></span>
                      <span className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[10px]">{alert.detectionSource}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="flex items-center gap-2.5 border-l border-slate-200 dark:border-slate-700 pl-3">
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-700 dark:text-slate-200 font-semibold">
            <User size={16} />
          </div>
          <div className="hidden lg:flex flex-col text-left">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">Telecom Analyst</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Network NOC</span>
          </div>
        </div>
      </div>
    </header>
  );
};


