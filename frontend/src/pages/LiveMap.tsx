import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import {
  Search,
  MapPin,
  X,
  ArrowRight,
  Brain,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Layers,
  Filter,
} from 'lucide-react';
import { getMapPoints, getAssetDetail } from '../api/client';
import { useConfig, getStatusStyle, useApiStatus } from '../api/hooks';
import { MapPoint, AssetDetail } from '../types/api';
import { useTelemetry } from '../context/TelemetryContext';

// Helper component to center map smoothly
const MapController: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);
  return null;
};

// Canvas-based Clustered Points Layer
interface PointsLayerProps {
  points: MapPoint[];
  selectedId: string | null;
  onSelectPoint: (id: string) => void;
}

const PointsLayer: React.FC<PointsLayerProps> = ({ points, selectedId, onSelectPoint }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const clusterGroup = (L as any).markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 45,
      disableClusteringAtZoom: 13,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
    });

    points.forEach((pt) => {
      if (pt.latitude == null || pt.longitude == null) return;
      const isSelected = selectedId === pt.asset_id;
      const style = getStatusStyle(pt.status);

      const marker = L.circleMarker([pt.latitude, pt.longitude], {
        radius: isSelected ? 8 : 5,
        fillColor: style.hex,
        color: isSelected ? '#ffffff' : '#0f172a',
        weight: isSelected ? 2.5 : 1,
        opacity: 0.95,
        fillOpacity: 0.85,
      });

      marker.bindTooltip(
        `<div style="font-family: inherit; font-size: 11px;">
          <b>${pt.asset_id}</b> (${pt.asset_type})<br/>
          <span>${pt.city || 'Unknown location'} &bull; Status: <strong style="color:${style.hex};">${pt.status.toUpperCase()}</strong></span>
        </div>`,
        { direction: 'top', className: 'nexus-map-tooltip' }
      );

      marker.on('click', () => {
        onSelectPoint(pt.asset_id);
      });

      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);

    return () => {
      map.removeLayer(clusterGroup);
    };
  }, [map, points, selectedId, onSelectPoint]);

  return null;
};

export const LiveMap: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { config } = useConfig();
  const { createIncident } = useTelemetry();
  const { isOnline } = useApiStatus();

  // Map state
  const [mapCenter, setMapCenter] = useState<[number, number]>([20.5937, 78.9629]); // India center default
  const [mapZoom, setMapZoom] = useState<number>(5);

  // Points and loading
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loadingPoints, setLoadingPoints] = useState<boolean>(true);
  const [pointsError, setPointsError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [assetTypeFilter, setAssetTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSearch, setActiveSearch] = useState<string>('');

  // Selected asset detail drawer
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [assetDetail, setAssetDetail] = useState<AssetDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  // Fetch map points
  const fetchPoints = useCallback(async () => {
    setLoadingPoints(true);
    setPointsError(null);
    try {
      const params: { status?: string; asset_type?: string; q?: string } = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (assetTypeFilter !== 'all') params.asset_type = assetTypeFilter;
      if (activeSearch.trim()) params.q = activeSearch.trim();

      const data = await getMapPoints(params);
      setPoints(data);
    } catch (err: any) {
      setPointsError(err.message || 'Failed to load map points');
    } finally {
      setLoadingPoints(false);
    }
  }, [statusFilter, assetTypeFilter, activeSearch]);

  useEffect(() => {
    fetchPoints();
  }, [fetchPoints]);

  // Handle asset focus from URL ?asset=
  useEffect(() => {
    const assetParam = searchParams.get('asset');
    if (assetParam && assetParam !== selectedAssetId) {
      handleSelectAsset(assetParam);
    }
  }, [searchParams]);

  // Load asset detail when an asset is selected
  const handleSelectAsset = useCallback(
    async (assetId: string) => {
      setSelectedAssetId(assetId);
      setDrawerOpen(true);
      setLoadingDetail(true);
      setDetailError(null);

      try {
        const detail = await getAssetDetail(assetId);
        setAssetDetail(detail);

        if (detail.asset.latitude != null && detail.asset.longitude != null) {
          setMapCenter([detail.asset.latitude, detail.asset.longitude]);
          setMapZoom(13);
        }
      } catch (err: any) {
        setDetailError(err.message || `Failed to load details for ${assetId}`);
      } finally {
        setLoadingDetail(false);
      }
    },
    []
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery);
  };

  const handleResetFilters = () => {
    setStatusFilter('all');
    setAssetTypeFilter('all');
    setSearchQuery('');
    setActiveSearch('');
    setMapCenter([20.5937, 78.9629]);
    setMapZoom(5);
  };

  // Status counts from current points
  const counts = useMemo(() => {
    const c = { green: 0, yellow: 0, red: 0, purple: 0 };
    points.forEach((p) => {
      if (p.status in c) {
        c[p.status as keyof typeof c]++;
      }
    });
    return c;
  }, [points]);

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] bg-slate-900 overflow-hidden flex flex-col font-sans">
      {/* Top Status & Legend Bar */}
      <div className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-5 py-2.5 text-xs flex flex-wrap items-center justify-between z-20 gap-3">
        <div className="flex items-center gap-2 text-slate-100 font-semibold">
          <MapPin size={16} className="text-blue-500" />
          <span>Network Map & Asset Locations</span>
          <span className="text-[11px] text-slate-400 font-normal ml-2">
            ({loadingPoints ? 'Loading...' : `${points.length.toLocaleString()} located assets`})
          </span>
        </div>

        {/* Dynamic Legend from backend config */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-slate-400 font-medium">Status Legend:</span>
          {config?.status_legend ? (
            config.status_legend.map((item) => (
              <span key={item.status} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: getStatusStyle(item.status).hex }}
                />
                <span className="text-slate-300 font-medium">{item.label}</span>
              </span>
            ))
          ) : (
            <>
              <span className="text-emerald-400 font-medium">🟢 Green (Optimal)</span>
              <span className="text-amber-400 font-medium">🟡 Yellow (Warning)</span>
              <span className="text-purple-400 font-medium">🟣 Purple (Anomaly)</span>
              <span className="text-red-400 font-medium">🔴 Red (At Risk)</span>
            </>
          )}
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
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Asset ID, city, or country..."
            className="w-full pl-9 pr-20 py-2 bg-slate-900/90 backdrop-blur-md border border-slate-700 focus:border-blue-500 rounded-lg text-xs text-slate-100 placeholder-slate-400 focus:outline-none shadow-md"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[11px] rounded transition-colors"
          >
            Filter
          </button>
        </form>

        {/* Filters Group */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-lg border border-slate-700 shadow-lg text-xs">
          {/* Asset Type Select */}
          <select
            value={assetTypeFilter}
            onChange={(e) => setAssetTypeFilter(e.target.value)}
            className="bg-slate-800 text-slate-200 border border-slate-700 rounded px-2 py-1 text-xs focus:outline-none"
          >
            <option value="all">All Asset Types</option>
            <option value="Base Station">Base Station</option>
            <option value="Cell Tower">Cell Tower</option>
            <option value="Network Gateway">Network Gateway</option>
            <option value="Router">Router</option>
          </select>

          {/* Status Buttons */}
          {(['all', 'green', 'yellow', 'purple', 'red'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded font-medium transition-all text-xs capitalize ${
                statusFilter === s
                  ? s === 'red'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40 font-semibold'
                    : s === 'purple'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40 font-semibold'
                    : s === 'yellow'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 font-semibold'
                    : s === 'green'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-semibold'
                    : 'bg-blue-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {s === 'all' ? 'All Statuses' : s}
            </button>
          ))}

          <button
            onClick={handleResetFilters}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700 transition-colors ml-1"
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
          preferCanvas={true}
          style={{ width: '100%', height: '100%' }}
        >
          <MapController center={mapCenter} zoom={mapZoom} />

          {/* Dark CartoDB / OSM Tiles */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />

          {/* Clustered Canvas Points */}
          <PointsLayer
            points={points}
            selectedId={selectedAssetId}
            onSelectPoint={(id) => handleSelectAsset(id)}
          />
        </MapContainer>
      </div>

      {/* Floating Status Summary Box */}
      <div className="absolute bottom-6 left-6 z-20 p-4 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-800 shadow-xl text-xs space-y-2.5 max-w-xs">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="font-bold text-slate-200">Asset Snapshot Counts</span>
          <span className="text-[11px] text-slate-400 font-mono">{points.length} nodes</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
            🟢 Green: {counts.green}
          </div>
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 font-medium">
            🟡 Yellow: {counts.yellow}
          </div>
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 font-medium">
            🔴 Red: {counts.red}
          </div>
          <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 font-medium">
            🟣 Purple: {counts.purple}
          </div>
        </div>
      </div>

      {/* Slide-out Node Detail Drawer */}
      {drawerOpen && (
        <div className="absolute top-14 right-4 bottom-6 z-30 w-80 md:w-96 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl p-5 overflow-y-auto space-y-5 text-xs text-slate-200">
          {/* Drawer Header */}
          <div className="flex items-start justify-between border-b border-slate-700 pb-3">
            <div>
              <div className="text-[11px] text-blue-400 font-semibold uppercase tracking-wider">
                Asset Telemetry Snapshot
              </div>
              <h2 className="text-lg font-bold text-slate-100 mt-0.5">
                {assetDetail?.asset.asset_id || selectedAssetId}
              </h2>
              {assetDetail && (
                <>
                  <p className="text-xs text-slate-400">
                    {assetDetail.asset.asset_type} &bull; {assetDetail.asset.city || 'N/A'}, {assetDetail.asset.country || ''}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Coords: {assetDetail.asset.latitude?.toFixed(4)}, {assetDetail.asset.longitude?.toFixed(4)}
                  </p>
                </>
              )}
            </div>
            <button
              onClick={() => {
                setDrawerOpen(false);
                setSelectedAssetId(null);
                setSearchParams({});
              }}
              className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {loadingDetail ? (
            <div className="p-8 text-center text-slate-400">
              <RefreshCw size={20} className="animate-spin inline-block mr-2" />
              Loading asset telemetry from backend...
            </div>
          ) : detailError ? (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>{detailError}</span>
            </div>
          ) : assetDetail?.latest ? (
            <>
              {/* Dual Badges Section (Both badges appear when node is at-risk AND anomaly) */}
              <div className="space-y-2">
                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold block">
                  Model Classifications
                </span>
                <div className="flex flex-wrap gap-2">
                  {/* Status Badge */}
                  <span
                    className="px-2.5 py-1 rounded text-xs font-bold uppercase"
                    style={{
                      color: getStatusStyle(assetDetail.latest.status).hex,
                      backgroundColor: `${getStatusStyle(assetDetail.latest.status).hex}20`,
                      border: `1px solid ${getStatusStyle(assetDetail.latest.status).hex}40`,
                    }}
                  >
                    Status: {assetDetail.latest.status}
                  </span>

                  {/* SVM Risk Badge */}
                  <span
                    className={`px-2.5 py-1 rounded text-xs font-bold ${
                      assetDetail.latest.is_at_risk
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    }`}
                  >
                    {assetDetail.latest.risk_label} (Risk score: {(assetDetail.latest.risk_score * 100).toFixed(1)}%)
                  </span>

                  {/* DBSCAN Anomaly Badge */}
                  {assetDetail.latest.is_anomaly && (
                    <span className="px-2.5 py-1 rounded text-xs font-bold bg-purple-500/20 text-purple-400 border border-purple-500/40 flex items-center gap-1">
                      <ShieldAlert size={12} />
                      <span>Multivariate Anomaly (Cluster {assetDetail.latest.dbscan_cluster})</span>
                    </span>
                  )}
                </div>

                {assetDetail.latest.is_at_risk && assetDetail.latest.is_anomaly && (
                  <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300">
                    ⚠️ Dual alert: Node has both elevated SVM risk and multivariate DBSCAN anomaly characteristics.
                  </div>
                )}
              </div>

              {/* Threshold breaches (rule-based) */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                  Threshold breaches (rule-based)
                </span>
                {assetDetail.latest.threshold_breaches?.length > 0 ? (
                  <div className="space-y-1.5">
                    {assetDetail.latest.threshold_breaches.map((b, i) => (
                      <div
                        key={i}
                        className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-[11px]"
                      >
                        <div className="font-semibold">{b.message}</div>
                        <div className="text-slate-400 text-[10px]">
                          Limit: {b.limit} {b.operator} Actual: {b.value}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                    ✓ No operational threshold breaches detected.
                  </div>
                )}
              </div>

              {/* Telemetry Parameters */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Telemetry Parameters
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
                    <div className="text-[11px] text-slate-400">Latency</div>
                    <div className="text-sm font-bold text-slate-100">
                      {assetDetail.latest.latency_ms.toFixed(1)} ms
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
                    <div className="text-[11px] text-slate-400">Packet Loss</div>
                    <div className="text-sm font-bold text-slate-100">
                      {assetDetail.latest.packet_loss_pct.toFixed(2)}%
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
                    <div className="text-[11px] text-slate-400">Traffic Load</div>
                    <div className="text-sm font-bold text-slate-100">
                      {assetDetail.latest.traffic_load_pct.toFixed(1)}%
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
                    <div className="text-[11px] text-slate-400">Throughput</div>
                    <div className="text-sm font-bold text-blue-400">
                      {assetDetail.latest.throughput_mbps.toFixed(1)} Mbps
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
                    <div className="text-[11px] text-slate-400">Connected Users</div>
                    <div className="text-sm font-bold text-slate-100">
                      {assetDetail.latest.connected_users.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
                    <div className="text-[11px] text-slate-400">Signal Strength</div>
                    <div className="text-sm font-bold text-slate-100">
                      {assetDetail.latest.signal_strength_dbm.toFixed(1)} dBm
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
                    <div className="text-[11px] text-slate-400">Call Drop Rate</div>
                    <div className="text-sm font-bold text-slate-100">
                      {assetDetail.latest.call_drop_rate_pct.toFixed(2)}%
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
                    <div className="text-[11px] text-slate-400">Resource Utilization</div>
                    <div className="text-sm font-bold text-slate-100">
                      {assetDetail.latest.resource_utilization_pct.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Operational Action Buttons */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => navigate('/svm')}
                  className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center justify-between"
                >
                  <span>View SVM Diagnostics</span>
                  <ArrowRight size={14} />
                </button>
                <button
                  disabled={!isOnline}
                  onClick={async () => {
                    await createIncident(assetDetail.asset.asset_id);
                    navigate('/incidents');
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <ShieldAlert size={15} />
                  <span>Dispatch NOC Incident</span>
                </button>
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-slate-400">No telemetry readings recorded for this asset.</div>
          )}
        </div>
      )}
    </div>
  );
};
