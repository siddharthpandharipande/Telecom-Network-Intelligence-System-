import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  Search, Filter, Layers, Radio, ShieldAlert, Cpu, ScatterChart, RefreshCw, X, ArrowRight, Zap, MapPin, Database
} from 'lucide-react';
import { useTelemetry } from '../context/TelemetryContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { NetworkCell, AssetType, AssetStatus } from '../types/telecom';

// Helper component to center map smoothly
const MapController: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);
  return null;
};

// Custom SVG Leaflet DivIcon with 4 AI Status Colors: 🟢 Healthy | 🟡 Warning | 🔴 At Risk | 🟣 Anomaly
const createCustomMarkerIcon = (type: AssetType, status: AssetStatus, isSelected: boolean) => {
  let bgColor = '#10b981'; // 🟢 Healthy Green
  let glowClass = '';

  if (status === 'warning') {
    bgColor = '#f59e0b'; // 🟡 Warning Amber
  } else if (status === 'critical') {
    bgColor = '#ef4444'; // 🔴 At Risk Red
    glowClass = 'animate-ping';
  } else if (status === 'anomaly') {
    bgColor = '#a855f7'; // 🟣 AI Anomaly Purple
    glowClass = 'animate-pulse';
  }

  let symbol = '◉';
  if (type === 'tower') symbol = '📡';
  else if (type === 'basestation') symbol = '▣';
  else if (type === 'router') symbol = '◇';

  const html = `
    <div style="
      position: relative;
      width: ${isSelected ? '38px' : '30px'};
      height: ${isSelected ? '38px' : '30px'};
      border-radius: 50%;
      background: #0c1322;
      border: 2.5px solid ${bgColor};
      box-shadow: 0 0 ${isSelected ? '20px' : '10px'} ${bgColor};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${isSelected ? '16px' : '13px'};
      color: ${bgColor};
      cursor: pointer;
    ">
      ${symbol}
      ${(status === 'critical' || status === 'anomaly') ? `<span style="position:absolute; width:100%; height:100%; border-radius:50%; border:2px solid ${bgColor}; opacity:0.6;" class="${glowClass}"></span>` : ''}
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-noc-marker',
    iconSize: [isSelected ? 38 : 30, isSelected ? 38 : 30],
    iconAnchor: [isSelected ? 19 : 15, isSelected ? 19 : 15]
  });
};

export const LiveMap: React.FC = () => {
  const navigate = useNavigate();
  const { cells, assets, links, selectedCell, setSelectedCell, isLive, createIncident } = useTelemetry();

  const [mapCenter, setMapCenter] = useState<[number, number]>([18.5204, 73.8567]); // Default Pune
  const [mapZoom, setMapZoom] = useState<number>(10);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchQuery, setSearchQueryLocal] = useState<string>('');
  const [drawerOpen, setDrawerOpen] = useState<boolean>(true);

  // Layer Visibility Toggles
  const [layers, setLayers] = useState({
    cells: true,
    towers: true,
    baseStations: true,
    routers: true,
    links: true,
    anomalies: true
  });

  useEffect(() => {
    if (selectedCell) {
      setMapCenter([selectedCell.lat, selectedCell.lng]);
      setMapZoom(13);
      setDrawerOpen(true);
    }
  }, [selectedCell]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;

    const matchedCell = cells.find(c => c.id.toLowerCase() === query || c.name.toLowerCase().includes(query) || c.region.toLowerCase().includes(query));
    if (matchedCell) {
      setSelectedCell(matchedCell);
      setMapCenter([matchedCell.lat, matchedCell.lng]);
      setMapZoom(13);
      return;
    }

    if (query.includes('mumbai')) { setMapCenter([19.0760, 72.8777]); setMapZoom(11); }
    else if (query.includes('pune')) { setMapCenter([18.5204, 73.8567]); setMapZoom(12); }
    else if (query.includes('delhi')) { setMapCenter([28.6139, 77.2090]); setMapZoom(11); }
    else if (query.includes('bengaluru') || query.includes('bangalore')) { setMapCenter([12.9716, 77.5946]); setMapZoom(11); }
    else if (query.includes('hyderabad')) { setMapCenter([17.3850, 78.4867]); setMapZoom(11); }
  };

  const filteredCells = cells.filter(cell => {
    if (statusFilter === 'All') return true;
    if (statusFilter === 'Healthy') return cell.status === 'healthy';
    if (statusFilter === 'Warning') return cell.status === 'warning';
    if (statusFilter === 'At Risk') return cell.status === 'critical' || cell.svmRiskCategory === 'At Risk';
    if (statusFilter === 'Anomaly') return cell.status === 'anomaly' || cell.dbscanClassification === 'Anomaly';
    return true;
  });

  const healthyCount = cells.filter(c => c.status === 'healthy').length;
  const warningCount = cells.filter(c => c.status === 'warning').length;
  const atRiskCount = cells.filter(c => c.status === 'critical' || c.svmRiskCategory === 'At Risk').length;
  const anomalyCount = cells.filter(c => c.status === 'anomaly' || c.dbscanClassification === 'Anomaly').length;

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] bg-[#060911] overflow-hidden flex flex-col font-mono">
      {/* Pipeline Flow Status Banner */}
      <div className="bg-[#080d19] border-b border-[#1e2d4a] px-4 py-2 text-xs flex flex-wrap items-center justify-between z-20">
        <div className="flex items-center gap-2 text-[#00f0ff] font-bold">
          <MapPin size={16} />
          <span>LIVE INTERACTIVE NETWORK MAP — PLOTTED FROM COMPANY TELEMETRY</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-slate-400">STATUS LEGEND:</span>
          <span className="text-emerald-400 font-bold">🟢 Healthy</span>
          <span className="text-amber-400 font-bold">🟡 Warning</span>
          <span className="text-red-400 font-bold">🔴 At Risk (SVM)</span>
          <span className="text-purple-400 font-bold">🟣 Anomaly (DBSCAN)</span>
        </div>
      </div>

      {/* Top Map Controls Bar */}
      <div className="absolute top-12 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Search Field */}
        <form onSubmit={handleSearchSubmit} className="pointer-events-auto relative w-72 md:w-96 shadow-2xl">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQueryLocal(e.target.value)}
            placeholder="Search Cell/Tower ID or location..."
            className="w-full pl-9 pr-24 py-2 bg-[#0c1322]/90 backdrop-blur-md border border-[#1e2d4a] focus:border-cyan-400 rounded-lg text-xs text-slate-100 placeholder-slate-400 focus:outline-none shadow-noc-card"
          />
          <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-[10px] rounded transition-colors">
            SEARCH
          </button>
        </form>

        {/* Status Filters & Map Reset */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 bg-[#0c1322]/95 backdrop-blur-md p-1.5 rounded-lg border border-[#1e2d4a] shadow-2xl">
          {(['All', 'Healthy', 'Warning', 'At Risk', 'Anomaly'] as const).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-2.5 py-1 text-xs font-semibold rounded transition-all ${
                statusFilter === f
                  ? f === 'At Risk'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                    : f === 'Anomaly'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                    : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {f}
            </button>
          ))}

          <button
            onClick={() => {
              setMapCenter([18.5204, 73.8567]);
              setMapZoom(10);
            }}
            className="px-2.5 py-1 bg-[#1e2d4a] hover:bg-cyan-600 text-slate-200 hover:text-black text-xs rounded transition-colors"
          >
            RESET MAP
          </button>
        </div>
      </div>

      {/* Main Map Canvas */}
      <div className="w-full h-full relative">
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%' }}
        >
          <MapController center={mapCenter} zoom={mapZoom} />

          {/* Dark NOC Tile Layer */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Render Network Links */}
          {layers.links && links.map(link => (
            <Polyline
              key={link.id}
              positions={[link.fromCoords, link.toCoords]}
              pathOptions={{
                color: link.status === 'critical' ? '#ef4444' : link.status === 'warning' ? '#f59e0b' : '#00f0ff',
                weight: link.status === 'critical' ? 3 : 2,
                dashArray: link.status === 'critical' ? '6, 6' : undefined,
                opacity: 0.8
              }}
            />
          ))}

          {/* Render All Assets Plotted by exact Latitude / Longitude & identified by Cell/Tower ID */}
          {filteredCells.map(cell => (
            <Marker
              key={cell.id}
              position={[cell.lat, cell.lng]}
              icon={createCustomMarkerIcon(cell.assetType || 'cell', cell.status, selectedCell?.id === cell.id)}
              eventHandlers={{
                click: () => {
                  setSelectedCell(cell);
                  setDrawerOpen(true);
                }
              }}
            >
              <Popup>
                <div className="font-mono text-xs space-y-1 p-1">
                  <div className="font-bold text-cyan-400">{cell.id} ({cell.assetType.toUpperCase()})</div>
                  <div className="text-slate-300">Lat/Lng: {cell.lat.toFixed(4)}, {cell.lng.toFixed(4)}</div>
                  <div className="text-slate-300">Latency: <span className="text-red-400 font-bold">{cell.latency} ms</span></div>
                  <div className="text-slate-300">SVM Risk: <span className="text-purple-400 font-bold">{cell.svmRiskCategory}</span></div>
                  <div className="text-slate-300">DBSCAN: <span className="text-indigo-400 font-bold">{cell.dbscanClassification}</span></div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Floating Live Status Overlay */}
      <div className="absolute bottom-6 left-6 z-20 p-4 rounded-xl bg-[#0c1322]/95 backdrop-blur-md border border-[#1e2d4a] shadow-2xl text-xs space-y-2.5 max-w-xs">
        <div className="flex items-center justify-between border-b border-[#1e2d4a] pb-2">
          <span className="font-bold text-slate-200 uppercase tracking-wider">LIVE NETWORK AI MAP STATUS</span>
          <span className="flex items-center gap-1 text-cyan-400 text-[10px] font-bold">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            LIVE
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="p-2 rounded bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 font-bold">
            🟢 Healthy: {healthyCount}
          </div>
          <div className="p-2 rounded bg-amber-950/20 border border-amber-500/30 text-amber-400 font-bold">
            🟡 Warning: {warningCount}
          </div>
          <div className="p-2 rounded bg-red-950/20 border border-red-500/30 text-red-400 font-bold">
            🔴 At Risk: {atRiskCount}
          </div>
          <div className="p-2 rounded bg-purple-950/20 border border-purple-500/30 text-purple-400 font-bold">
            🟣 Anomaly: {anomalyCount}
          </div>
        </div>
      </div>

      {/* CLICKED MARKER CELL/TOWER DETAILS DRAWER (FULL TELEMETRY + SVM + DBSCAN RESULTS) */}
      {selectedCell && drawerOpen && (
        <div className="absolute top-12 right-4 bottom-6 z-30 w-80 md:w-96 bg-[#0c1322]/95 backdrop-blur-xl border border-[#1e2d4a] rounded-xl shadow-2xl p-6 overflow-y-auto space-y-6 animate-in slide-in-from-right duration-300">
          {/* Drawer Header */}
          <div className="flex items-start justify-between border-b border-[#1e2d4a] pb-4">
            <div>
              <div className="text-xs text-cyan-400 font-bold tracking-widest uppercase">ASSET TELEMETRY & AI DETAILS</div>
              <h2 className="text-xl font-extrabold text-slate-100 mt-1">{selectedCell.id}</h2>
              <p className="text-xs text-slate-400">Type: <strong className="text-cyan-300 uppercase">{selectedCell.assetType}</strong> | Location: {selectedCell.region}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Coords: <strong className="text-slate-200">{selectedCell.lat.toFixed(4)}, {selectedCell.lng.toFixed(4)}</strong></p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={selectedCell.status} size="md" />
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-100 rounded"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Network Metrics Grid */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">COMPANY TELEMETRY VALUES</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded bg-[#080d19] border border-[#1e2d4a]">
                <div className="text-[10px] text-slate-400">LATENCY</div>
                <div className={`text-base font-extrabold ${selectedCell.latency > 100 ? 'text-red-400' : 'text-slate-100'}`}>
                  {selectedCell.latency} ms
                </div>
              </div>
              <div className="p-2.5 rounded bg-[#080d19] border border-[#1e2d4a]">
                <div className="text-[10px] text-slate-400">PACKET LOSS</div>
                <div className={`text-base font-extrabold ${selectedCell.packetLoss > 5 ? 'text-red-400' : 'text-slate-100'}`}>
                  {selectedCell.packetLoss}%
                </div>
              </div>
              <div className="p-2.5 rounded bg-[#080d19] border border-[#1e2d4a]">
                <div className="text-[10px] text-slate-400">TRAFFIC LOAD</div>
                <div className={`text-base font-extrabold ${selectedCell.trafficLoad > 90 ? 'text-red-400' : 'text-slate-100'}`}>
                  {selectedCell.trafficLoad}%
                </div>
              </div>
              <div className="p-2.5 rounded bg-[#080d19] border border-[#1e2d4a]">
                <div className="text-[10px] text-slate-400">THROUGHPUT</div>
                <div className="text-base font-extrabold text-cyan-400">{selectedCell.throughput} Mbps</div>
              </div>
              <div className="p-2.5 rounded bg-[#080d19] border border-[#1e2d4a]">
                <div className="text-[10px] text-slate-400">CONNECTED USERS</div>
                <div className="text-base font-extrabold text-slate-100">{selectedCell.users.toLocaleString()}</div>
              </div>
              <div className="p-2.5 rounded bg-[#080d19] border border-[#1e2d4a]">
                <div className="text-[10px] text-slate-400">SIGNAL STRENGTH</div>
                <div className="text-base font-extrabold text-slate-100">{selectedCell.signalStrength} dBm</div>
              </div>
              <div className="p-2.5 rounded bg-[#080d19] border border-[#1e2d4a]">
                <div className="text-[10px] text-slate-400">CALL DROP RATE</div>
                <div className="text-base font-extrabold text-slate-100">{selectedCell.callDropRate}%</div>
              </div>
              <div className="p-2.5 rounded bg-[#080d19] border border-[#1e2d4a]">
                <div className="text-[10px] text-slate-400">RESOURCE UTIL</div>
                <div className="text-base font-extrabold text-slate-100">{selectedCell.resourceUtil}%</div>
              </div>
            </div>
            {selectedCell.timestamp && (
              <div className="text-[10px] text-slate-400 pt-1">
                Telemetry Timestamp: <span className="text-slate-200">{selectedCell.timestamp}</span>
              </div>
            )}
          </div>

          {/* AI Intelligence Section */}
          <div className="space-y-3 pt-3 border-t border-[#1e2d4a]">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu size={16} className="text-purple-400" />
              <span>AI MODEL INFERENCE RESULTS</span>
            </h3>

            {/* SVM Box */}
            <div className="p-3 rounded-lg bg-purple-950/20 border border-purple-500/40 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-300">SVM RISK PREDICTION</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  selectedCell.svmRiskCategory === 'At Risk' ? 'bg-red-500/30 text-red-300' : 'bg-emerald-500/30 text-emerald-300'
                }`}>
                  {selectedCell.svmRiskCategory.toUpperCase()}
                </span>
              </div>
              <div className="text-sm font-extrabold text-purple-400">Risk Score: {selectedCell.svmRiskScore}%</div>
              <div className="text-[10px] text-slate-300">Main Driver: {selectedCell.svmMainFactor}</div>
            </div>

            {/* DBSCAN Box */}
            <div className="p-3 rounded-lg bg-indigo-950/20 border border-indigo-500/40 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-300">DBSCAN ANOMALY DETECTION</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  selectedCell.dbscanClassification === 'Anomaly' ? 'bg-purple-500/30 text-purple-300' : 'bg-emerald-500/30 text-emerald-300'
                }`}>
                  {selectedCell.dbscanClassification.toUpperCase()}
                </span>
              </div>
              <div className="text-sm font-extrabold text-indigo-400">Anomaly Score: {selectedCell.dbscanAnomalyScore}</div>
              <div className="text-[10px] text-slate-300">Density Outlier Classification</div>
            </div>
          </div>

          {/* Operational Action Buttons */}
          <div className="space-y-2 pt-3 border-t border-[#1e2d4a]">
            <button
              onClick={() => navigate('/svm')}
              className="w-full py-2 px-3 rounded-lg bg-purple-600/80 hover:bg-purple-500 text-white font-bold text-xs transition-colors flex items-center justify-between"
            >
              <span>VIEW SVM PREDICTION PAGE</span>
              <ArrowRight size={14} />
            </button>
            <button
              onClick={() => navigate('/dbscan')}
              className="w-full py-2 px-3 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white font-bold text-xs transition-colors flex items-center justify-between"
            >
              <span>VIEW DBSCAN ANALYSIS PAGE</span>
              <ArrowRight size={14} />
            </button>
            <button
              onClick={() => {
                createIncident(selectedCell.id);
                navigate('/incidents');
              }}
              className="w-full py-2.5 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-noc-red transition-all flex items-center justify-center gap-2"
            >
              <ShieldAlert size={16} />
              <span>CREATE INCIDENT</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
