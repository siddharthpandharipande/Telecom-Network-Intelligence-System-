import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell, User, Menu, PlusCircle, Sun, Moon, Shield, Wrench, UserCheck, Radio } from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

interface TopbarProps {
  collapsed: boolean;
  toggleCollapse: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ collapsed, toggleCollapse }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    searchQuery,
    setSearchQuery,
    findCellById,
    setSelectedCell,
    alerts,
    addAlert,
    dismissAlert,
    clearAllAlerts,
    refreshData,
  } = useTelemetry();
  const { theme, toggleTheme } = useTheme();
  const { user, role, setShowLoginModal } = useAuth();

  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [streamStatus, setStreamStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket Live Telemetry Streaming Connection
  useEffect(() => {
    let isMounted = true;
    let reconnectTimeout: any = null;

    const connectWs = () => {
      try {
        const wsUrl = 'ws://localhost:8000/api/ws/telemetry';
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isMounted) setStreamStatus('connected');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'telemetry_ingested' && data.data) {
              // Immediately flag any asset that comes to risk
              if (data.data.is_at_risk || data.data.status === 'red' || data.data.is_anomaly) {
                addAlert({
                  id: `ALT-LIVE-${Date.now()}-${data.data.asset_id}`,
                  severity: data.data.status === 'red' || data.data.is_at_risk ? 'critical' : 'high',
                  title: data.data.is_at_risk
                    ? `🚨 CRITICAL RISK: Asset ${data.data.asset_id} (${data.data.city || 'NOC'}) Flagged At-Risk`
                    : `⚠️ ANOMALY ALERT: Node ${data.data.asset_id} Outlier Detected`,
                  assetId: data.data.asset_id,
                  timestamp: 'Just now',
                  detectionSource: data.data.is_at_risk ? 'Real-Time SVM Classifier' : 'DBSCAN Anomaly Monitor',
                  status: 'Open',
                });
              }
              // Dynamically refresh background telemetry when new readings are broadcast
              refreshData();
            }
          } catch {
            // Non-JSON message
          }
        };

        ws.onerror = () => {
          if (isMounted) setStreamStatus('disconnected');
        };

        ws.onclose = () => {
          if (isMounted) {
            setStreamStatus('disconnected');
            // Graceful reconnect attempt after 5 seconds
            reconnectTimeout = setTimeout(connectWs, 5000);
          }
        };
      } catch {
        if (isMounted) setStreamStatus('disconnected');
      }
    };

    connectWs();

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (wsRef.current) wsRef.current.close();
    };
  }, [refreshData]);

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
        {/* Real-Time WebSocket Streaming Status Pill */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
            streamStatus === 'connected'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : streamStatus === 'connecting'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
              : 'bg-slate-500/10 border-slate-500/30 text-slate-500'
          }`}
          title={
            streamStatus === 'connected'
              ? 'WebSocket Stream: Connected — awaiting new telemetry'
              : 'WebSocket Reconnecting / REST Fallback Active'
          }
        >
          <span
            className={`w-2 h-2 rounded-full ${
              streamStatus === 'connected'
                ? 'bg-emerald-500 animate-pulse'
                : streamStatus === 'connecting'
                ? 'bg-amber-500 animate-ping'
                : 'bg-slate-400'
            }`}
          />
          <span className="hidden sm:inline">Stream: </span>
          <span>{streamStatus === 'connected' ? 'Live (awaiting telemetry)' : 'REST Fallback'}</span>
        </div>

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

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-lg transition-colors relative"
            title="Real-Time Network Risk Notifications"
          >
            <Bell size={18} className={activeAlerts.length > 0 ? 'text-red-500' : ''} />
            {activeAlerts.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse shadow-md">
                {activeAlerts.length}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-84 sm:w-96 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
                  <span>Network Risk Alerts</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-500 dark:text-red-400 font-semibold">
                    {activeAlerts.length} Active
                  </span>
                </div>
                {activeAlerts.length > 0 && (
                  <button
                    onClick={() => clearAllAlerts()}
                    className="text-[10px] text-slate-400 hover:text-red-400 transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {activeAlerts.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs">
                    All network assets operating within normal SLA. No active risks detected.
                  </div>
                ) : (
                  activeAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      onClick={() => {
                        setShowNotifications(false);
                        navigate(`/map?asset=${encodeURIComponent(alert.assetId)}`);
                      }}
                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors space-y-1 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-red-500 dark:text-red-400 font-bold text-xs leading-snug">
                          {alert.title}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] text-slate-400">{alert.timestamp}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              dismissAlert(alert.id);
                            }}
                            className="text-slate-400 hover:text-red-400 opacity-60 group-hover:opacity-100 px-1 font-bold"
                            title="Dismiss Notification"
                          >
                            &times;
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span>
                          Node ID: <strong className="text-slate-800 dark:text-slate-200 font-mono">{alert.assetId}</strong>
                        </span>
                        <span className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[10px] font-mono">
                          {alert.detectionSource}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {activeAlerts.length > 0 && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">Click any alert to locate on map</span>
                  <button
                    onClick={() => {
                      setShowNotifications(false);
                      navigate('/map');
                    }}
                    className="text-blue-500 hover:underline font-semibold"
                  >
                    View on Live Map &rarr;
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Authenticated Role & User Switcher Button */}
        <button
          onClick={() => setShowLoginModal(true)}
          className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-300 dark:border-slate-700 text-left"
          title="Click to switch role or authenticate"
        >
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold ${
              role === 'admin'
                ? 'bg-amber-500'
                : role === 'network_engineer'
                ? 'bg-purple-500'
                : 'bg-blue-600'
            }`}
          >
            {role === 'admin' ? (
              <Shield size={14} />
            ) : role === 'network_engineer' ? (
              <Wrench size={14} />
            ) : (
              <UserCheck size={14} />
            )}
          </div>
          <div className="hidden lg:flex flex-col text-left">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
              {user?.full_name || 'NOC Analyst'}
            </span>
            <span className="text-[10px] text-blue-500 font-bold tracking-wider capitalize">
              {role.replace('_', ' ')}
            </span>
          </div>
        </button>
      </div>
    </header>
  );
};


