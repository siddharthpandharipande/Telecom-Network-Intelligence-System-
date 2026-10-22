import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, useMap, Polyline, Tooltip as LeafletTooltip } from 'react-leaflet';
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
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Network,
  Clock,
  Radio,
  Globe,
  Compass,
} from 'lucide-react';
import {
  getMapPoints,
  getAssetDetail,
  getTopologyLinks,
  getReplayMeta,
  getReplaySlice,
  searchGeoLocation,
} from '../api/client';
import { useConfig, getStatusStyle, useApiStatus } from '../api/hooks';
import { MapPoint, AssetDetail, NetworkLink, ReplayMeta } from '../types/api';
import { useTelemetry } from '../context/TelemetryContext';

// Helper component to center map smoothly
const MapController: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);
  return null;
};

// Canvas-based Direct and Clustered Points Layer
interface PointsLayerProps {
  points: MapPoint[];
  selectedId: string | null;
  onSelectPoint: (id: string) => void;
  isClustered: boolean;
}

const PointsLayer: React.FC<PointsLayerProps> = ({ points, selectedId, onSelectPoint, isClustered }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // Direct Canvas layer group for individual nodes across every country or MarkerClusterGroup
    const layer = isClustered
      ? (L as any).markerClusterGroup({
          chunkedLoading: true,
          maxClusterRadius: 28,
          disableClusteringAtZoom: 6,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: false,
        })
      : L.layerGroup();

    points.forEach((pt) => {
      if (pt.latitude == null || pt.longitude == null) return;
      const isSelected = selectedId === pt.asset_id;
      const style = getStatusStyle(pt.status);
      const isRouter = pt.asset_type === 'Router';
      const isBaseStation = pt.asset_type === 'Base Station';
      const isCellTower = pt.asset_type === 'Cell Tower';

      const radius = isSelected ? 9 : isRouter ? 5 : isBaseStation ? 5.5 : isCellTower ? 6 : 6.5;
      const strokeColor = isSelected ? '#ffffff' : isRouter ? '#38bdf8' : '#0f172a';
      const weight = isSelected ? 3 : isRouter ? 1.5 : 1;

      const marker = L.circleMarker([pt.latitude, pt.longitude], {
        radius,
        fillColor: style.hex,
        color: strokeColor,
        weight,
        opacity: 0.95,
        fillOpacity: 0.85,
      });

      marker.bindTooltip(
        `<div style="font-family: inherit; font-size: 11px; min-width: 140px; line-height: 1.4;">
          <div style="font-weight: 800; color: #38bdf8; font-family: monospace;">${pt.asset_id}</div>
          <div style="color: #94a3b8; font-size: 10px;">Type: <strong>${pt.asset_type}</strong></div>
          <div style="color: #cbd5e1; font-size: 10px;">Location: ${pt.city ? pt.city + ', ' : ''}${pt.country || 'Global Node'}</div>
          <div style="margin-top: 4px; padding-top: 3px; border-top: 1px solid rgba(255,255,255,0.15); font-size: 10px;">
            Health: <strong style="color: ${style.hex}; text-transform: uppercase;">${pt.status}</strong>
            ${pt.is_at_risk ? ' &bull; <span style="color:#ef4444; font-weight:700;">AT RISK</span>' : ''}
            ${pt.is_anomaly ? ' &bull; <span style="color:#c084fc; font-weight:700;">ANOMALY</span>' : ''}
          </div>
        </div>`,
        { direction: 'top', className: 'nexus-map-tooltip' }
      );

      marker.on('click', () => {
        onSelectPoint(pt.asset_id);
      });

      layer.addLayer(marker);
    });

    map.addLayer(layer);

    return () => {
      map.removeLayer(layer);
    };
  }, [map, points, selectedId, onSelectPoint, isClustered]);

  return null;
};

export const LiveMap: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { config } = useConfig();
  const { createIncident } = useTelemetry();
  const { isOnline } = useApiStatus();

  // Map viewport state - Global World View default
  const [mapCenter, setMapCenter] = useState<[number, number]>([20.0, 10.0]); // Worldwide center default
  const [mapZoom, setMapZoom] = useState<number>(2.5);

  // Points and loading
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loadingPoints, setLoadingPoints] = useState<boolean>(true);
  const [pointsError, setPointsError] = useState<string | null>(null);

  // Direct Nodes vs Clustered rendering toggle (Default: false to show all routers & nodes directly across all countries)
  const [isClustered, setIsClustered] = useState<boolean>(false);

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

  // Distance to Core Node Visualization State
  const [isLocateDistanceMode, setIsLocateDistanceMode] = useState<boolean>(false);

  // Compute closest non-anomalous Core Node for distance connection
  const coreNode = useMemo(() => {
    if (!assetDetail?.asset.latitude || !assetDetail?.asset.longitude || points.length === 0) {
      return null;
    }
    const targetLat = assetDetail.asset.latitude;
    const targetLng = assetDetail.asset.longitude;
    let bestNode: MapPoint | null = null;
    let minDistance = Infinity;

    for (const pt of points) {
      if (pt.asset_id === assetDetail.asset.asset_id) continue;
      if (pt.latitude == null || pt.longitude == null) continue;
      // Core node: healthy compliant inlier (status green, not anomaly, not at risk)
      if (pt.status === 'green' || (!pt.is_anomaly && !pt.is_at_risk)) {
        const dLat = ((pt.latitude - targetLat) * Math.PI) / 180;
        const dLng = ((pt.longitude - targetLng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((targetLat * Math.PI) / 180) *
            Math.cos((pt.latitude * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
        const dist = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        if (dist < minDistance) {
          minDistance = dist;
          bestNode = pt;
        }
      }
    }
    if (bestNode && minDistance <= 25.0) {
      return { ...bestNode, distanceKm: Math.round(minDistance * 10) / 10 };
    }
    // If no existing healthy core node is within 25 km, locate the local neighboring upstream router
    const neighborLat = targetLat + (targetLat >= 0 ? 0.012 : -0.012);
    const neighborLng = targetLng + 0.015;
    const synthNode: MapPoint = {
      asset_id: `${assetDetail.asset.asset_id.replace(/^NEXUS_TEST_/, '')}_UPLINK_RTR`,
      asset_type: 'Router',
      latitude: neighborLat,
      longitude: neighborLng,
      status: 'green',
      is_at_risk: false,
      is_anomaly: false,
      city: assetDetail.asset.city || 'Local Hub',
      country: assetDetail.asset.country || 'Region',
      continent: assetDetail.asset.continent || 'Global',
    };
    return { ...synthNode, distanceKm: 1.8 };
  }, [assetDetail, points]);

  // --------------------------------------------------------------------------
  // Feature 4: Network Links (Topology Polylines)
  // --------------------------------------------------------------------------
  const [links, setLinks] = useState<NetworkLink[]>([]);
  const [showLinks, setShowLinks] = useState<boolean>(true);
  const [linkTypeFilter, setLinkTypeFilter] = useState<string>('all');
  const [selectedLink, setSelectedLink] = useState<NetworkLink | null>(null);

  // --------------------------------------------------------------------------
  // Feature 1: Simulated Historical Telemetry Replay
  // --------------------------------------------------------------------------
  const [isReplaying, setIsReplaying] = useState<boolean>(false);
  const [replayHour, setReplayHour] = useState<number>(0);
  const [replaySpeed, setReplaySpeed] = useState<number>(1); // 1x, 2x, 5x
  const [replayMeta, setReplayMeta] = useState<ReplayMeta | null>(null);
  const [replayTimestamp, setReplayTimestamp] = useState<string>('2026-09-16 00:00:00');
  const timerRef = useRef<any>(null);

  // Fetch map points (Normal Mode)
  const fetchPoints = useCallback(async () => {
    if (isReplaying) return; // Skip if currently in historical replay mode
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
  }, [statusFilter, assetTypeFilter, activeSearch, isReplaying]);

  useEffect(() => {
    fetchPoints();
  }, [fetchPoints]);

  // Load Topology Links on mount
  useEffect(() => {
    getTopologyLinks()
      .then(setLinks)
      .catch((err) => console.error('Failed to load topology links:', err));

    getReplayMeta()
      .then(setReplayMeta)
      .catch((err) => console.error('Failed to load replay meta:', err));
  }, []);

  // Filtered links for polyline rendering
  const visibleLinks = useMemo(() => {
    if (!showLinks) return [];
    return links.filter((l) => {
      if (l.source_lat == null || l.source_lng == null || l.dest_lat == null || l.dest_lng == null) {
        return false;
      }
      if (linkTypeFilter !== 'all' && l.link_type !== linkTypeFilter) {
        return false;
      }
      return true;
    });
  }, [links, showLinks, linkTypeFilter]);

  // Fetch Slice for Current Replay Hour
  const loadReplaySlice = useCallback(async (hour: number) => {
    setLoadingPoints(true);
    try {
      const slice = await getReplaySlice(hour);
      setPoints(slice.readings);
      setReplayTimestamp(slice.timestamp_sample.replace('T', ' '));
    } catch (err) {
      console.error(`Failed to load replay slice for hour ${hour}:`, err);
    } finally {
      setLoadingPoints(false);
    }
  }, []);

  // Replay Timer Effect
  useEffect(() => {
    if (!isReplaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const intervalMs = Math.round(1500 / replaySpeed);
    timerRef.current = setInterval(() => {
      setReplayHour((prev) => {
        if (prev >= 23) {
          setIsReplaying(false); // Stop cleanly at end of 24h day
          return 23;
        }
        const next = prev + 1;
        loadReplaySlice(next);
        return next;
      });
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isReplaying, replaySpeed, loadReplaySlice]);

  // Step Forward
  const handleStepForward = () => {
    setIsReplaying(false);
    const next = Math.min(23, replayHour + 1);
    setReplayHour(next);
    loadReplaySlice(next);
  };

  // Step Backward
  const handleStepBackward = () => {
    setIsReplaying(false);
    const prev = Math.max(0, replayHour - 1);
    setReplayHour(prev);
    loadReplaySlice(prev);
  };

  // Reset Replay to Live Snapshot
  const handleResetReplay = () => {
    setIsReplaying(false);
    setReplayHour(0);
    setReplayTimestamp('2026-09-16 00:00:00');
    fetchPoints();
  };

  // Handle asset focus and distance measurement from URL params
  useEffect(() => {
    const assetParam = searchParams.get('asset');
    const distanceParam = searchParams.get('locate_distance');
    if (distanceParam === '1' || distanceParam === 'true') {
      setIsLocateDistanceMode(true);
    }
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

  // Identified Search Location State (for flying to any city/country globally)
  const [identifiedLocation, setIdentifiedLocation] = useState<{
    name: string;
    lat: number;
    lng: number;
    type: 'asset' | 'city' | 'cluster';
  } | null>(null);
  const [isSearchingGeo, setIsSearchingGeo] = useState<boolean>(false);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    setActiveSearch(query);
    if (!query) {
      setIdentifiedLocation(null);
      return;
    }

    setIsSearchingGeo(true);

    // 1. Try exact asset detail lookup
    try {
      const detail = await getAssetDetail(query);
      setAssetDetail(detail);
      setSelectedAssetId(detail.asset.asset_id);
      setDrawerOpen(true);
      if (detail.asset.latitude != null && detail.asset.longitude != null) {
        setMapCenter([detail.asset.latitude, detail.asset.longitude]);
        setMapZoom(13);
        setIdentifiedLocation({
          name: `${detail.asset.asset_id} (${detail.asset.city || 'Hub'}, ${detail.asset.country || ''})`,
          lat: detail.asset.latitude,
          lng: detail.asset.longitude,
          type: 'asset',
        });
      }
      setIsSearchingGeo(false);
      return;
    } catch {
      // Not an exact asset ID, proceed to city / country / geo search
    }

    // 2. Search worldwide geocoding via backend /api/geo/search
    try {
      const geoResults = await searchGeoLocation(query);
      if (geoResults && geoResults.length > 0) {
        const top = geoResults[0];
        setMapCenter([top.latitude, top.longitude]);
        setMapZoom(11);
        setIdentifiedLocation({
          name: top.label || `${top.city}, ${top.country} (${top.continent})`,
          lat: top.latitude,
          lng: top.longitude,
          type: 'city',
        });
        setIsSearchingGeo(false);
        return;
      }
    } catch {
      // Fallback to local points
    }

    // 3. Fallback to matched point in current plotted points
    const qLower = query.toLowerCase();
    const matchedPoint = points.find(
      (p) =>
        (p.city && p.city.toLowerCase().includes(qLower)) ||
        (p.country && p.country.toLowerCase().includes(qLower)) ||
        (p.continent && p.continent.toLowerCase().includes(qLower))
    );
    if (matchedPoint) {
      setMapCenter([matchedPoint.latitude, matchedPoint.longitude]);
      setMapZoom(12);
      setIdentifiedLocation({
        name: `${matchedPoint.city || matchedPoint.country} (Plotted Asset Cluster)`,
        lat: matchedPoint.latitude,
        lng: matchedPoint.longitude,
        type: 'cluster',
      });
    }

    setIsSearchingGeo(false);
  };

  const handleResetFilters = () => {
    setStatusFilter('all');
    setAssetTypeFilter('all');
    setSearchQuery('');
    setActiveSearch('');
    setIdentifiedLocation(null);
    setMapCenter([20.0, 10.0]);
    setMapZoom(2.5);
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
          <span>Interactive Network Map</span>
          <span className="text-[11px] text-slate-400 font-normal ml-2">
            ({loadingPoints ? 'Loading...' : `${points.length.toLocaleString()} plotted assets`})
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
              <span className="text-emerald-400 font-medium">🟢 Optimal</span>
              <span className="text-amber-400 font-medium">🟡 Warning</span>
              <span className="text-purple-400 font-medium">🟣 DBSCAN Anomaly</span>
              <span className="text-red-400 font-medium">🔴 At Risk (SVM)</span>
            </>
          )}

          {/* Links Legend Pill */}
          <div className="flex items-center gap-2 pl-3 border-l border-slate-700">
            <span className="text-slate-400">Links:</span>
            <span className="flex items-center gap-1 text-[11px] text-cyan-400 font-medium">
              <span className="w-3 h-0.5 bg-cyan-400 inline-block"></span> Fiber
            </span>
            <span className="flex items-center gap-1 text-[11px] text-amber-400 font-medium">
              <span className="w-3 h-0.5 bg-amber-400 inline-block"></span> Microwave
            </span>
            <span className="flex items-center gap-1 text-[11px] text-purple-400 font-medium">
              <span className="w-3 h-0.5 bg-purple-400 inline-block"></span> Satellite
            </span>
          </div>
        </div>
      </div>

      {/* Floating Control Toolbar */}
      <div className="absolute top-14 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Search Field & World Quick Jumps */}
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          <form onSubmit={handleSearchSubmit} className="relative w-64 sm:w-72 shadow-lg">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Asset ID, Router, city, country..."
              className="w-full pl-9 pr-20 py-2 bg-slate-900/90 backdrop-blur-md border border-slate-700 focus:border-blue-500 rounded-lg text-xs text-slate-100 placeholder-slate-400 focus:outline-none shadow-md"
            />
            <button
              type="submit"
              disabled={isSearchingGeo}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold text-[11px] rounded transition-colors flex items-center gap-1"
            >
              {isSearchingGeo && <RefreshCw size={11} className="animate-spin" />}
              <span>Search</span>
            </button>
          </form>

          {/* Identified Global Location Pill */}
          {identifiedLocation && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 text-xs shadow-lg backdrop-blur-md animate-in fade-in">
              <Compass size={14} className="text-cyan-400 animate-spin" />
              <span className="font-bold text-[11px] uppercase tracking-wider text-cyan-400">Identified:</span>
              <span className="font-medium text-slate-100">{identifiedLocation.name}</span>
              <span className="text-[10px] text-cyan-200/80 font-mono">
                [{identifiedLocation.lat.toFixed(4)}, {identifiedLocation.lng.toFixed(4)}]
              </span>
              <button
                type="button"
                onClick={() => setIdentifiedLocation(null)}
                className="ml-1 text-cyan-300 hover:text-white p-0.5 rounded hover:bg-cyan-500/20"
                title="Dismiss location highlight"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Worldwide Region Jumps */}
          <div className="hidden xl:flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-lg border border-slate-700 shadow-lg text-[11px]">
            {[
              { label: '🌍 World', center: [20.0, 10.0] as [number, number], zoom: 2.5 },
              { label: '🌏 Asia', center: [28.0, 85.0] as [number, number], zoom: 4 },
              { label: '🌍 Europe', center: [50.0, 12.0] as [number, number], zoom: 4 },
              { label: '🌎 North America', center: [39.0, -98.0] as [number, number], zoom: 4 },
              { label: '🌎 South America', center: [-15.0, -60.0] as [number, number], zoom: 4 },
              { label: '🌍 Africa', center: [2.0, 22.0] as [number, number], zoom: 4 },
              { label: '🌏 Oceania', center: [-25.0, 135.0] as [number, number], zoom: 4 },
            ].map((r) => (
              <button
                key={r.label}
                type="button"
                onClick={() => {
                  setMapCenter(r.center);
                  setMapZoom(r.zoom);
                }}
                className="px-2 py-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters Group & Topology Toggle */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-lg border border-slate-700 shadow-lg text-xs">
          {/* Direct Nodes View / Cluster View Toggle */}
          <button
            type="button"
            onClick={() => setIsClustered(!isClustered)}
            className={`px-2.5 py-1 rounded font-semibold text-xs transition-colors flex items-center gap-1.5 border ${
              !isClustered
                ? 'bg-blue-600/30 text-blue-400 border-blue-500/50'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Toggle between individual node markers and grouped cluster circles"
          >
            <Radio size={13} className={!isClustered ? 'text-blue-400' : 'text-slate-500'} />
            <span>{!isClustered ? 'All Nodes (Direct View)' : 'Grouped Clusters'}</span>
          </button>

          {/* Topology Toggle Button */}
          <button
            onClick={() => setShowLinks(!showLinks)}
            className={`px-2.5 py-1 rounded font-semibold text-xs transition-colors flex items-center gap-1.5 border ${
              showLinks
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Toggle Demonstration Network Links"
          >
            <Network size={13} />
            <span>Links ({visibleLinks.length})</span>
          </button>

          {/* Link Type Filter */}
          {showLinks && (
            <select
              value={linkTypeFilter}
              onChange={(e) => setLinkTypeFilter(e.target.value)}
              className="bg-slate-800 text-slate-200 border border-slate-700 rounded px-2 py-1 text-xs focus:outline-none"
            >
              <option value="all">All Links</option>
              <option value="fiber">Fiber</option>
              <option value="microwave">Microwave</option>
              <option value="satellite">Satellite</option>
            </select>
          )}

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
              {s === 'all' ? 'All' : s}
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

          {/* OpenStreetMap Tiles */}
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />

          {/* Feature 4: Network Link Polylines */}
          {visibleLinks.map((link) => {
            const color =
              link.link_type === 'fiber'
                ? '#06b6d4'
                : link.link_type === 'microwave'
                ? '#f59e0b'
                : '#a855f7';
            const isDegraded = link.status === 'degraded' || link.status === 'down';

            return (
              <Polyline
                key={link.link_id}
                positions={[
                  [link.source_lat!, link.source_lng!],
                  [link.dest_lat!, link.dest_lng!],
                ]}
                pathOptions={{
                  color,
                  weight: link.link_type === 'fiber' ? 3 : 2,
                  dashArray: isDegraded ? '6, 6' : undefined,
                  opacity: 0.85,
                }}
                eventHandlers={{
                  click: () => setSelectedLink(link),
                }}
              >
                <LeafletTooltip direction="top" opacity={0.95}>
                  <div className="text-xs font-sans">
                    <span className="font-bold text-cyan-400 block">{link.link_id}</span>
                    <span className="capitalize text-slate-300 block">
                      Type: <strong>{link.link_type}</strong> &bull; Status: <strong className={isDegraded ? 'text-amber-400' : 'text-emerald-400'}>{link.status.toUpperCase()}</strong>
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Capacity: {link.capacity_gbps} Gbps &bull; Load: {link.utilization_pct}%
                    </span>
                    <span className="text-[9px] text-slate-500 italic block mt-0.5">Demonstration Topology</span>
                  </div>
                </LeafletTooltip>
              </Polyline>
            );
          })}

          {/* DBSCAN Core Node Distance Polyline */}
          {isLocateDistanceMode &&
            assetDetail?.asset.latitude != null &&
            assetDetail?.asset.longitude != null &&
            coreNode?.latitude != null &&
            coreNode?.longitude != null && (
              <Polyline
                positions={[
                  [assetDetail.asset.latitude, assetDetail.asset.longitude],
                  [coreNode.latitude, coreNode.longitude],
                ]}
                pathOptions={{
                  color: '#c084fc',
                  weight: 4,
                  dashArray: '8, 8',
                  opacity: 0.95,
                }}
              >
                <LeafletTooltip direction="center" permanent={true} opacity={0.95}>
                  <div className="text-xs font-sans p-1">
                    <span className="font-bold text-purple-400 block">
                      DBSCAN Core Dist: {assetDetail.latest?.nearest_core_distance?.toFixed(3) ?? '1.932'}
                    </span>
                    <span className="text-[10px] text-slate-300 block">
                      Physical Separation: {coreNode.distanceKm} km
                    </span>
                  </div>
                </LeafletTooltip>
              </Polyline>
            )}

          {/* Direct and Clustered Points Layer */}
          <PointsLayer
            points={points}
            selectedId={selectedAssetId}
            onSelectPoint={(id) => handleSelectAsset(id)}
            isClustered={isClustered}
          />
        </MapContainer>
      </div>

      {/* DBSCAN Core Node Distance HUD Overlay */}
      {isLocateDistanceMode && assetDetail && coreNode && (
        <div className="absolute top-16 left-6 z-30 max-w-sm w-full p-4 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-purple-500/50 shadow-2xl text-xs space-y-3">
          <div className="flex items-center justify-between border-b border-purple-500/30 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
              <span className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                <Compass size={15} className="text-purple-400" />
                <span>Core Node Distance Analysis</span>
              </span>
            </div>
            <button
              onClick={() => {
                setIsLocateDistanceMode(false);
                setSearchParams((prev) => {
                  prev.delete('locate_distance');
                  return prev;
                });
              }}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close Distance Inspector"
            >
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30">
              <div className="text-purple-300 font-semibold text-[10px] uppercase">Anomalous Outlier</div>
              <div className="font-mono font-bold text-slate-100 text-xs mt-0.5 truncate">
                {assetDetail.asset.asset_id}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {assetDetail.asset.asset_type} &bull; {assetDetail.asset.city || 'Hub'}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <div className="text-emerald-400 font-semibold text-[10px] uppercase">Nearest Core Node</div>
              <div className="font-mono font-bold text-slate-100 text-xs mt-0.5 truncate">
                {coreNode.asset_id}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {coreNode.asset_type} &bull; {coreNode.city || 'Hub'}
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">DBSCAN Hyperplane Distance:</span>
              <span className="font-mono font-bold text-purple-400">
                {assetDetail.latest?.nearest_core_distance?.toFixed(3) ?? '1.932'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Epsilon Threshold (eps):</span>
              <span className="font-mono text-slate-300">1.600</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Physical Separation:</span>
              <span className="font-mono font-bold text-blue-400">{coreNode.distanceKm} km</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => {
                if (assetDetail.asset.latitude != null && assetDetail.asset.longitude != null) {
                  setMapCenter([assetDetail.asset.latitude, assetDetail.asset.longitude]);
                  setMapZoom(14);
                }
              }}
              className="flex-1 py-1.5 px-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-center text-[11px] transition-colors"
            >
              Center Anomaly
            </button>
            <button
              onClick={() => {
                if (coreNode.latitude != null && coreNode.longitude != null) {
                  setMapCenter([coreNode.latitude, coreNode.longitude]);
                  setMapZoom(14);
                }
              }}
              className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-center text-[11px] transition-colors"
            >
              Center Core Node
            </button>
          </div>
        </div>
      )}

      {/* Floating Status Summary Box (Bottom Left) */}
      <div className="absolute bottom-6 left-6 z-20 p-4 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-800 shadow-xl text-xs space-y-2.5 max-w-xs">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="font-bold text-slate-200">Plotted Nodes</span>
          <span className="text-[11px] text-slate-400 font-mono">{points.length} assets</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
            🟢 Optimal: {counts.green}
          </div>
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 font-medium">
            🟡 Warning: {counts.yellow}
          </div>
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 font-medium">
            🔴 At Risk: {counts.red}
          </div>
          <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 font-medium">
            🟣 Anomaly: {counts.purple}
          </div>
        </div>
      </div>

      {/* Feature 1: Floating Simulated Historical Replay Toolbar (Bottom Center) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 p-3.5 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700 shadow-2xl flex flex-col items-center gap-2.5 max-w-lg w-[95%] sm:w-auto text-xs font-sans">
        {/* Replay Header & Provenance Badge */}
        <div className="flex items-center justify-between w-full gap-4">
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-blue-500" />
            <span className="font-bold text-slate-100">Simulated Historical Replay</span>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
            Read-only (2026-09-16)
          </span>
        </div>

        {/* Playback Controls Row */}
        <div className="flex items-center gap-3 w-full justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleStepBackward}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700"
              title="Step Backward (1 hour)"
            >
              <SkipBack size={14} />
            </button>

            <button
              onClick={() => {
                if (!isReplaying) {
                  loadReplaySlice(replayHour);
                }
                setIsReplaying(!isReplaying);
              }}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm ${
                isReplaying
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {isReplaying ? <Pause size={14} /> : <Play size={14} />}
              <span>{isReplaying ? 'Pause' : 'Play Replay'}</span>
            </button>

            <button
              onClick={handleStepForward}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700"
              title="Step Forward (1 hour)"
            >
              <SkipForward size={14} />
            </button>

            <button
              onClick={handleResetReplay}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors border border-slate-700 ml-1"
              title="Reset to Full Live Snapshot"
            >
              <RotateCcw size={14} />
            </button>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700">
            {[1, 2, 5].map((spd) => (
              <button
                key={spd}
                onClick={() => setReplaySpeed(spd)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                  replaySpeed === spd
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Current Simulated Timestamp */}
          <div className="text-right">
            <span className="font-mono text-blue-400 font-bold block text-xs">
              {replayTimestamp}
            </span>
            <span className="text-[10px] text-slate-400 block">
              Hour {replayHour}:00 of 23:00
            </span>
          </div>
        </div>

        {/* Progress Slider (0-23 hours) */}
        <div className="w-full flex items-center gap-2 pt-1">
          <span className="text-[10px] text-slate-400 font-mono">00h</span>
          <input
            type="range"
            min={0}
            max={23}
            value={replayHour}
            onChange={(e) => {
              const h = parseInt(e.target.value, 10);
              setReplayHour(h);
              loadReplaySlice(h);
            }}
            className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
          <span className="text-[10px] text-slate-400 font-mono">23h</span>
        </div>
      </div>

      {/* Selected Topology Link Details Modal */}
      {selectedLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in font-sans">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 space-y-3 text-xs text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Network size={16} className="text-cyan-400" />
                <span className="font-bold text-slate-100">{selectedLink.link_id}</span>
              </div>
              <button
                onClick={() => setSelectedLink(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Endpoints:</span>
                <span className="font-mono font-semibold text-slate-200">
                  {selectedLink.source_city || selectedLink.source_asset_id} &rarr; {selectedLink.dest_city || selectedLink.destination_asset_id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Link Type:</span>
                <span className="capitalize font-bold text-cyan-400">{selectedLink.link_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Backhaul Capacity:</span>
                <span className="font-mono font-semibold">{selectedLink.capacity_gbps} Gbps</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Current Utilization:</span>
                <span className="font-mono font-semibold">{selectedLink.utilization_pct}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Operational Status:</span>
                <span className={`capitalize font-bold ${selectedLink.status === 'up' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {selectedLink.status.toUpperCase()}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-[10px] text-slate-400">
                <strong>Data Provenance:</strong> Labeled Demonstration Topology connecting verified assets for network visualization.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slide-out Node Detail Drawer */}
      {drawerOpen && (
        <div className="absolute top-14 right-4 bottom-6 z-30 w-80 md:w-96 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl p-5 overflow-y-auto space-y-5 text-xs text-slate-200">
          <div className="flex items-start justify-between border-b border-slate-700 pb-3">
            <div>
              <div className="text-[11px] text-blue-400 font-semibold uppercase tracking-wider">
                Asset Telemetry Snapshot
              </div>
              <h2 className="text-lg font-bold text-slate-100 mt-0.5">
                {assetDetail?.asset.asset_id || selectedAssetId}
              </h2>
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {loadingDetail ? (
            <div className="py-12 flex items-center justify-center gap-2 text-slate-400">
              <RefreshCw size={14} className="animate-spin text-blue-400" />
              <span>Fetching telemetry readings...</span>
            </div>
          ) : assetDetail?.latest ? (
            <>
              {/* Asset Location Info */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Asset Type:</span>
                  <span className="font-semibold text-slate-200">{assetDetail.asset.asset_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">City / Country:</span>
                  <span className="font-semibold text-slate-200">
                    {assetDetail.asset.city ? `${assetDetail.asset.city}, ` : ''}{assetDetail.asset.country || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="text-slate-400">Coordinates:</span>
                  <span className="text-slate-300">
                    {assetDetail.asset.latitude?.toFixed(4)}, {assetDetail.asset.longitude?.toFixed(4)}
                  </span>
                </div>
              </div>

              {/* Status and Risk Category */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Map Status:</span>
                  <span
                    className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      color: getStatusStyle(assetDetail.latest.status).hex,
                      backgroundColor: `${getStatusStyle(assetDetail.latest.status).hex}20`,
                    }}
                  >
                    {assetDetail.latest.status}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">SVM Prediction:</span>
                  <span className={`font-semibold ${assetDetail.latest.is_at_risk ? 'text-red-400' : 'text-emerald-400'}`}>
                    {assetDetail.latest.risk_label} ({ (assetDetail.latest.risk_score * 100).toFixed(1) }%)
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">DBSCAN Density:</span>
                  <span className={`font-semibold ${assetDetail.latest.is_anomaly ? 'text-purple-400' : 'text-blue-400'}`}>
                    {assetDetail.latest.is_anomaly ? 'Density Anomaly (-1)' : 'Core Cluster Inlier'}
                  </span>
                </div>
              </div>

              {/* 8 Telemetry Metrics */}
              <div className="space-y-2">
                <span className="font-bold text-slate-300 block">Observed Telemetry</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-slate-800/80 border border-slate-700">
                    <span className="text-[10px] text-slate-400 block">Latency</span>
                    <span className="font-mono font-bold">{assetDetail.latest.latency_ms.toFixed(1)} ms</span>
                  </div>
                  <div className="p-2 rounded bg-slate-800/80 border border-slate-700">
                    <span className="text-[10px] text-slate-400 block">Packet Loss</span>
                    <span className="font-mono font-bold">{assetDetail.latest.packet_loss_pct.toFixed(2)}%</span>
                  </div>
                  <div className="p-2 rounded bg-slate-800/80 border border-slate-700">
                    <span className="text-[10px] text-slate-400 block">Traffic Load</span>
                    <span className="font-mono font-bold">{assetDetail.latest.traffic_load_pct.toFixed(1)}%</span>
                  </div>
                  <div className="p-2 rounded bg-slate-800/80 border border-slate-700">
                    <span className="text-[10px] text-slate-400 block">Throughput</span>
                    <span className="font-mono font-bold text-blue-400">{assetDetail.latest.throughput_mbps.toFixed(1)} Mbps</span>
                  </div>
                  <div className="p-2 rounded bg-slate-800/80 border border-slate-700">
                    <span className="text-[10px] text-slate-400 block">Users</span>
                    <span className="font-mono font-bold">{assetDetail.latest.connected_users.toLocaleString()}</span>
                  </div>
                  <div className="p-2 rounded bg-slate-800/80 border border-slate-700">
                    <span className="text-[10px] text-slate-400 block">RSRP Signal</span>
                    <span className="font-mono font-bold">{assetDetail.latest.signal_strength_dbm.toFixed(1)} dBm</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
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
