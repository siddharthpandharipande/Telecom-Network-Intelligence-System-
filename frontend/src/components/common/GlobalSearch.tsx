import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface SearchAsset {
  id: string;
  type: string;
  location: string;
  status: 'At Risk' | 'Normal' | 'Attention';
  classifier: string;
  anomaly: string;
  latency: string;
  packetLoss: string;
  load: string;
  signal: string;
}

const DEFAULT_ASSETS: SearchAsset[] = [
  { id: 'OC-AUS-SYD-NSW-GW-02451', type: 'Network Gateway', location: 'Sydney, New South Wales, Australia', status: 'At Risk', classifier: 'High Priority (100%)', anomaly: 'Telemetry Outlier Anomaly', latency: '215.8ms', packetLoss: '7.7%', load: '86.5%', signal: '-98.5 dBm' },
  { id: 'AS-CHN-SHA-SH-RT-00001', type: 'Router', location: 'Shanghai, China', status: 'At Risk', classifier: 'High Priority (96%)', anomaly: 'Normal Baseline', latency: '101.8ms', packetLoss: '4.0%', load: '88.5%', signal: '-98.0 dBm' },
  { id: 'AS-IND-PUN-MH-BS-00002', type: 'Base Station', location: 'Pune, Maharashtra, India', status: 'Normal', classifier: 'Routine (100%)', anomaly: 'Normal Baseline', latency: '28.4ms', packetLoss: '0.1%', load: '52.1%', signal: '-75.0 dBm' },
  { id: 'TWR-IND-042', type: 'Cell Tower 5G-NR', location: 'Mumbai, Maharashtra', status: 'At Risk', classifier: 'At Risk (91.4%)', anomaly: 'Telemetry Anomaly', latency: '142ms', packetLoss: '4.8%', load: '91.2%', signal: '-94 dBm' },
  { id: 'GTW-MUM-108', type: 'Edge Gateway', location: 'Bandra Kurla, Mumbai', status: 'At Risk', classifier: 'At Risk (84.1%)', anomaly: 'Normal Baseline', latency: '118ms', packetLoss: '3.1%', load: '88.5%', signal: '-86 dBm' },
];

export const GlobalSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = DEFAULT_ASSETS.filter((a) => {
    const q = query.toLowerCase().trim();
    return (
      a.id.toLowerCase().includes(q) ||
      a.location.toLowerCase().includes(q) ||
      a.type.toLowerCase().includes(q)
    );
  });

  const handleSelect = (assetId: string) => {
    setIsOpen(false);
    setQuery('');
    navigate(`/network-map?asset=${encodeURIComponent(assetId)}`);
  };

  return (
    <div ref={containerRef} className="relative hidden sm:block">
      <div className="relative flex items-center">
        <span className="material-symbols-outlined absolute left-3.5 text-slate-400 text-[18px]">
          search
        </span>
        <input
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          placeholder="Search Asset ID, location..."
          className="w-60 lg:w-72 pl-10 pr-4 py-2 rounded-full bg-white/90 border border-slate-200/80 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all shadow-xs"
        />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200/80 shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="p-2 border-b border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3">
            <span>Monitored Assets ({filtered.length})</span>
            <span className="text-purple-600 font-normal">Click to Inspect</span>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <div className="p-4 text-xs text-slate-400 text-center font-medium">
                No assets matching "<span className="text-slate-600 font-semibold">{query}</span>" found.
              </div>
            ) : (
              filtered.map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleSelect(a.id)}
                  className="w-full text-left flex items-center justify-between px-3.5 py-2.5 hover:bg-purple-50/50 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold font-mono ${a.status === 'At Risk'
                        ? 'bg-rose-50 text-rose-600'
                        : a.status === 'Attention'
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-emerald-50 text-emerald-600'
                        }`}
                    >
                      {a.id.split('-')[0]}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800 group-hover:text-purple-700 transition-colors">
                        {a.id}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {a.type} • {a.location}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${a.status === 'At Risk'
                        ? 'bg-rose-100/70 text-rose-700'
                        : a.status === 'Attention'
                          ? 'bg-amber-100/70 text-amber-700'
                          : 'bg-emerald-100/70 text-emerald-700'
                        }`}
                    >
                      {a.status}
                    </span>
                    <span className="material-symbols-outlined text-[16px] text-slate-300 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all">
                      chevron_right
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
