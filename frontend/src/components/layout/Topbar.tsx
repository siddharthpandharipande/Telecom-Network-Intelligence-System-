import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell, User, Wifi, Menu, Pause, Play } from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';

interface TopbarProps {
  collapsed: boolean;
  toggleCollapse: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ collapsed, toggleCollapse }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isLive, setIsLive, searchQuery, setSearchQuery, findCellById, setSelectedCell, alerts } = useTelemetry();

  const [currentTime, setCurrentTime] = useState<string>('13 Sep 2026 | 15:42:18 IST');
  const [showNotifications, setShowNotifications] = useState<boolean>(false);

  useEffect(() => {
    const timer = setInterval(() => {
      const date = new Date();
      const formatted = `${date.getDate()} Sep 2026 | ${date.toLocaleTimeString('en-US', { hour12: false })} IST`;
      setCurrentTime(formatted);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getBreadcrumb = () => {
    switch (location.pathname) {
      case '/': return 'Network Command Center';
      case '/health': return 'Real-Time Network Health';
      case '/map': return 'Live Network Map';
      case '/svm': return 'SVM Risk Prediction';
      case '/dbscan': return 'DBSCAN Anomaly Detection';
      case '/incidents': return 'Alerts & Incident Management';
      case '/assets': return 'Network Assets';
      case '/analytics': return 'Analytics';
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
    <header className={`fixed top-0 right-0 h-16 bg-[#080d19]/90 backdrop-blur-md border-b border-[#1e2d4a] z-30 transition-all duration-300 flex items-center justify-between px-6 ${
      collapsed ? 'left-20' : 'left-64'
    }`}>
      {/* Left: Collapse Toggle & Breadcrumb */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleCollapse}
          className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-[#111b30] rounded-lg transition-colors"
          title="Toggle Navigation"
        >
          <Menu size={18} />
        </button>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-400">NEXUSNET</span>
          <span className="text-slate-400">/</span>
          <span className="text-cyan-400 font-semibold">{getBreadcrumb()}</span>
        </div>
      </div>

      {/* Center: Global Search */}
      <form onSubmit={handleSearch} className="relative hidden md:block w-72 lg:w-96">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search cell, tower, router or location..."
          className="w-full pl-9 pr-4 py-1.5 bg-[#0c1322] border border-[#1e2d4a] focus:border-cyan-400/80 rounded-full text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/50 font-mono transition-all"
        />
        {searchQuery && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-cyan-400/70 font-mono">
            Press Enter ↵
          </span>
        )}
      </form>

      {/* Right: Status Indicators & Operator Profile */}
      <div className="flex items-center gap-4">
        {/* System Online Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>SYSTEM ONLINE</span>
        </div>

        {/* Live Simulation Indicator Toggle */}
        <button
          onClick={() => setIsLive(!isLive)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold transition-all ${
            isLive
              ? 'bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 shadow-noc-cyan'
              : 'bg-slate-800 border border-slate-700 text-slate-400'
          }`}
          title={isLive ? 'Pause Real-Time Telemetry' : 'Resume Telemetry Stream'}
        >
          {isLive ? (
            <>
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
              <Pause size={12} />
              <span>LIVE</span>
            </>
          ) : (
            <>
              <Play size={12} />
              <span>PAUSED</span>
            </>
          )}
        </button>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-slate-300 hover:text-cyan-400 hover:bg-[#111b30] rounded-lg transition-colors relative"
          >
            <Bell size={18} />
            {activeAlerts.length > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-bounce">
                {activeAlerts.length}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-[#0c1322] border border-[#1e2d4a] rounded-xl shadow-2xl z-50 p-4 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-[#1e2d4a] pb-2">
                <span className="font-bold text-slate-200">Active NOC Alerts</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
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
                    className="p-2 rounded bg-[#111b30] hover:bg-[#1a2944] border border-[#1e2d4a] cursor-pointer transition-colors space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-red-400 font-bold text-[11px]">{alert.title}</span>
                      <span className="text-[10px] text-slate-400">{alert.timestamp}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Asset: <strong className="text-cyan-300">{alert.assetId}</strong></span>
                      <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded">{alert.detectionSource}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Live Clock */}
        <div className="hidden xl:block text-slate-400 text-xs font-mono border-l border-[#1e2d4a] pl-4">
          {currentTime}
        </div>

        {/* Operator Profile */}
        <div className="flex items-center gap-2 border-l border-[#1e2d4a] pl-4">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 border border-cyan-400/50 flex items-center justify-center text-slate-100 font-semibold shadow-noc-cyan">
            <User size={16} />
          </div>
          <div className="hidden lg:flex flex-col text-left">
            <span className="text-xs font-semibold text-slate-200 leading-tight">NOC Operator</span>
            <span className="text-[10px] text-cyan-400 font-mono">Tier-2 Ops</span>
          </div>
        </div>
      </div>
    </header>
  );
};
