import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  Search, Filter, MapPin, X, ArrowRight, Brain, Activity, ShieldAlert
} from 'lucide-react';
import { useTelemetry } from '../context/TelemetryContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { AssetType, AssetStatus } from '../types/telecom';

// Helper component to center map smoothly
const MapController: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);
  return null;
};

// Custom SVG Leaflet DivIcon with 4 Status Colors: 🟢 Healthy | 🟡 Warning | 🔴 At Risk | 🟣 Anomaly
const createCustomMarkerIcon = (type: AssetType, status: AssetStatus, isSelected: boolean) => {
  let bgColor = '#10b981'; // 🟢 Healthy Green
  if (status === 'warning') bgColor = '#f59e0b'; // 🟡 Warning Amber
  else if (status === 'critical') bgColor = '#ef4444'; // 🔴 At Risk Red
  else if (status === 'anomaly') bgColor = '#a855f7'; // 🟣 AI Anomaly Purple

  let symbol = '●';
  if (type === 'tower') symbol = '📡';
  else if (type === 'basestation') symbol = '▣';
  else if (type === 'router') symbol = '◇';

  const html = `
    <div style="
      position: relative;
      width: ${isSelected ? '36px' : '28px'};
      height: ${isSelected ? '36px' : '28px'};
      border-radius: 50%;
      background: #1e293b;
      border: 2px solid ${bgColor};
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${isSelected ? '15px' : '12px'};
      color: ${bgColor};
      cursor: pointer;
    ">
      ${symbol}
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-map-marker',
    iconSize: [isSelected ? 36 : 28, isSelected ? 36 : 28],
    iconAnchor: [isSelected ? 18 : 14, isSelected ? 18 : 14]
  });
};

export const LiveMap: React.FC = () => {
  const navigate = useNavigate();
  const { cells, links, selectedCell, setSelectedCell, createIncident } = useTelemetry();

  const [mapCenter, setMapCenter] = useState<[number, number]>([18.5204, 73.8567]); // Default Pune
  const [mapZoom, setMapZoom] = useState<number>(10);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchQuery, setSearchQueryLocal] = useState<string>('');
  const [drawerOpen, setDrawerOpen] = useState<boolean>(true);

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
    <div className="relative w-full h-[calc(100vh-4rem)] bg-[#0f172a] overflow-hidden flex flex-col">
      {/* Top Status & Filter Header */}
      <div className="bg-[#1e293b] border-b border-[#334155] px-5 py-2.5 text-xs flex flex-wrap items-center justify-between z-20">
        <div className="flex items-center gap-2 text-slate-100 font-semibold">
          <MapPin size={16} className="text-blue-400" />
          <span>Interactive Telecom Network Map</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-400">Legend:</span>
          <span className="text-emerald-400 font-medium">🟢 Healthy</span>
          <span className="text-amber-400 font-medium">🟡 Warning</span>
          <span className="text-red-400 font-medium">🔴 At Risk (SVM)</span>
          <span className="text-purple-400 font-medium">🟣 Anomaly (DBSCAN)</span>
        </div>
      </div>

      {/* Floating Control Toolbar */}
      <div className="absolute top-14 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Search Field */}
        <form onSubmit={handleSearchSubmit} className="pointer-events-auto relative w-72 md:w-80 shadow-lg">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQueryLocal(e.target.value)}
            placeholder="Search Node ID, city, or tower..."
            className="w-full pl-9 pr-20 py-2 bg-[#1e293b]/95 backdrop-blur-md border border-[#334155] focus:border-blue-500 rounded-lg text-xs text-slate-100 placeholder-slate-400 focus:outline-none shadow-md"
          />
          <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[11px] rounded transition-colors">
            Search
          </button>
        </form>

        {/* Status Filters */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 bg-[#1e293b]/95 backdrop-blur-md p-1.5 rounded-lg border border-[#334155] shadow-lg text-xs">
          {(['All', 'Healthy', 'Warning', 'At Risk', 'Anomaly'] as const).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                statusFilter === f
                  ? f === 'At Risk'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30 font-semibold'
                    : f === 'Anomaly'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30 font-semibold'
                    : 'bg-blue-600 text-white font-semibold'
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
            className="px-2.5 py-1 bg-[#0f172a] hover:bg-slate-700 text-slate-300 text-xs rounded border border-[#334155] transition-colors ml-1"
          >
            Reset
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

          {/* Dark Map Tiles */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Render Network Links */}
          {links.map(link => (
            <Polyline
              key={link.id}
              positions={[link.fromCoords, link.toCoords]}
              pathOptions={{
                color: link.status === 'critical' ? '#ef4444' : link.status === 'warning' ? '#f59e0b' : '#3b82f6',
                weight: link.status === 'critical' ? 3 : 2,
                opacity: 0.7
              }}
            />
          ))}

          {/* Render All Filtered Assets */}
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
                <div className="text-xs space-y-1 p-0.5">
                  <div className="font-bold text-blue-400">{cell.id} ({cell.assetType})</div>
                  <div className="text-slate-300 font-mono text-[11px]">{cell.lat.toFixed(4)}, {cell.lng.toFixed(4)}</div>
                  <div className="text-slate-300">Latency: <strong className="text-red-400">{cell.latency} ms</strong></div>
                  <div className="text-slate-300">SVM Risk: <strong className="text-indigo-400">{cell.svmRiskCategory}</strong></div>
                  <div className="text-slate-300">DBSCAN: <strong className="text-purple-400">{cell.dbscanClassification}</strong></div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Floating Status Summary Box */}
      <div className="absolute bottom-6 left-6 z-20 p-4 rounded-xl bg-[#1e293b]/95 backdrop-blur-md border border-[#334155] shadow-xl text-xs space-y-2.5 max-w-xs">
        <div className="flex items-center justify-between border-b border-[#334155] pb-2">
          <span className="font-bold text-slate-200">Network Map Status</span>
          <span className="text-xs text-emerald-400 font-medium">Stream Active</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
            🟢 Healthy: {healthyCount}
          </div>
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 font-medium">
            🟡 Warning: {warningCount}
          </div>
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 font-medium">
            🔴 At Risk: {atRiskCount}
          </div>
          <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 font-medium">
            🟣 Anomaly: {anomalyCount}
          </div>
        </div>
      </div>

      {/* Slide-out Node Detail Drawer */}
      {selectedCell && drawerOpen && (
        <div className="absolute top-14 right-4 bottom-6 z-30 w-80 md:w-96 bg-[#1e293b]/95 backdrop-blur-xl border border-[#334155] rounded-xl shadow-2xl p-5 overflow-y-auto space-y-5">
          {/* Drawer Header */}
          <div className="flex items-start justify-between border-b border-[#334155] pb-3.5">
            <div>
              <div className="text-[11px] text-blue-400 font-semibold">Node Telemetry & Diagnostics</div>
              <h2 className="text-lg font-bold text-slate-100 mt-0.5">{selectedCell.id}</h2>
              <p className="text-xs text-slate-400">{selectedCell.name} ({selectedCell.region})</p>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">Coords: {selectedCell.lat.toFixed(4)}, {selectedCell.lng.toFixed(4)}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={selectedCell.status} size="md" />
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Telemetry Metrics */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Telemetry Parameters</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-[#0f172a] border border-[#334155]">
                <div className="text-[11px] text-slate-400">Latency</div>
                <div className={`text-sm font-bold ${selectedCell.latency > 100 ? 'text-red-400' : 'text-slate-100'}`}>
                  {selectedCell.latency} ms
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0f172a] border border-[#334155]">
                <div className="text-[11px] text-slate-400">Packet Loss</div>
                <div className={`text-sm font-bold ${selectedCell.packetLoss > 5 ? 'text-red-400' : 'text-slate-100'}`}>
                  {selectedCell.packetLoss}%
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0f172a] border border-[#334155]">
                <div className="text-[11px] text-slate-400">Traffic Load</div>
                <div className={`text-sm font-bold ${selectedCell.trafficLoad > 90 ? 'text-red-400' : 'text-slate-100'}`}>
                  {selectedCell.trafficLoad}%
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0f172a] border border-[#334155]">
                <div className="text-[11px] text-slate-400">Throughput</div>
                <div className="text-sm font-bold text-blue-400">{selectedCell.throughput} Mbps</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0f172a] border border-[#334155]">
                <div className="text-[11px] text-slate-400">Users</div>
                <div className="text-sm font-bold text-slate-100">{selectedCell.users.toLocaleString()}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0f172a] border border-[#334155]">
                <div className="text-[11px] text-slate-400">Signal Strength</div>
                <div className="text-sm font-bold text-slate-100">{selectedCell.signalStrength} dBm</div>
              </div>
            </div>
          </div>

          {/* AI Inference Summary */}
          <div className="space-y-2.5 pt-2 border-t border-[#334155]">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Brain size={15} className="text-indigo-400" />
              <span>AI Diagnostics Summary</span>
            </h3>

            {/* SVM Card */}
            <div className="p-3 rounded-lg bg-[#0f172a] border border-[#334155] space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">SVM Risk Prediction</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  selectedCell.svmRiskCategory === 'At Risk' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {selectedCell.svmRiskCategory}
                </span>
              </div>
              <div className="text-sm font-bold text-indigo-400">Risk Score: {selectedCell.svmRiskScore}%</div>
              <div className="text-[11px] text-slate-400">Main Factor: {selectedCell.svmMainFactor}</div>
            </div>

            {/* DBSCAN Card */}
            <div className="p-3 rounded-lg bg-[#0f172a] border border-[#334155] space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">DBSCAN Anomaly Detection</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  selectedCell.dbscanClassification === 'Anomaly' ? 'bg-purple-500/20 text-purple-400' : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {selectedCell.dbscanClassification}
                </span>
              </div>
              <div className="text-sm font-bold text-purple-400">Anomaly Score: {selectedCell.dbscanAnomalyScore}</div>
            </div>
          </div>

          {/* Operational Action Buttons */}
          <div className="space-y-2 pt-2 border-t border-[#334155]">
            <button
              onClick={() => navigate('/svm')}
              className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center justify-between"
            >
              <span>View SVM Diagnostics Page</span>
              <ArrowRight size={14} />
            </button>
            <button
              onClick={() => {
                createIncident(selectedCell.id);
                navigate('/incidents');
              }}
              className="w-full py-2 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <ShieldAlert size={15} />
              <span>Create Action Incident</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

