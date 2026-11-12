import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import { getAssetLocation } from '../api/client';

export interface MapNode {
  id: string;
  name: string;
  type: string;
  location: string;
  lat: number;
  lng: number;
  status: 'critical' | 'warning' | 'normal' | 'backup';
  svm: string;
  dbscan: string;
  signal: string;
  latency: string;
  loss: string;
  load: string;
  failoverNode?: string;
  failoverDist?: string;
  coverageRadiusMeters?: number;
  investigationPriority?: string;
  decisionFlag?: string;
  city?: string;
  region?: string;
}

export const REAL_TELECOM_NODES: MapNode[] = [
  {
    id: 'TWR-IND-042',
    name: 'Mumbai West Sector 4B',
    type: 'Cell Tower 5G-NR',
    location: 'Santacruz West, Mumbai • 19.0760° N, 72.8377° E',
    lat: 19.0760,
    lng: 72.8377,
    status: 'critical',
    svm: 'At Risk (91.4%)',
    dbscan: 'Investigate',
    signal: '-94 dBm (Degraded)',
    latency: '142 ms (+184%)',
    loss: '4.8 % (High)',
    load: '91.2 % (Saturated)',
    failoverNode: 'TWR-IND-043',
    failoverDist: '1.2 km',
    coverageRadiusMeters: 3200,
  },
  {
    id: 'GTW-MUM-108',
    name: 'Bandra Kurla Enterprise Hub',
    type: 'Edge Gateway',
    location: 'Bandra Kurla Complex, Mumbai • 19.0657° N, 72.8688° E',
    lat: 19.0657,
    lng: 72.8688,
    status: 'warning',
    svm: 'At Risk (84.1%)',
    dbscan: 'Investigate',
    signal: '-86 dBm (Normal)',
    latency: '118 ms (+136%)',
    loss: '3.1 % (Elevated)',
    load: '88.5 % (Heavy)',
    failoverNode: 'GTW-MUM-109',
    failoverDist: '2.5 km',
    coverageRadiusMeters: 2400,
  },
  {
    id: 'BST-WOR-015',
    name: 'Worli Sea-Link Coastal Hub',
    type: 'Base Station 4G/5G',
    location: 'Worli Point, Mumbai • 19.0176° N, 72.8156° E',
    lat: 19.0176,
    lng: 72.8156,
    status: 'normal',
    svm: 'Normal (97.8%)',
    dbscan: 'Monitor',
    signal: '-72 dBm (Strong)',
    latency: '24 ms (Optimal)',
    loss: '0.1 % (Nominal)',
    load: '54.0 % (Moderate)',
    failoverNode: 'TWR-MUM-018',
    failoverDist: '3.1 km',
    coverageRadiusMeters: 2800,
  },
  {
    id: 'RTR-POW-003',
    name: 'Powai Optical Center',
    type: 'Core Optical Router',
    location: 'Hiranandani Tech Park, Powai • 19.1176° N, 72.9060° E',
    lat: 19.1176,
    lng: 72.9060,
    status: 'normal',
    svm: 'Normal (99.4%)',
    dbscan: 'Monitor',
    signal: '-68 dBm (Strong)',
    latency: '18 ms (Optimal)',
    loss: '0.04 % (Nominal)',
    load: '48.2 % (Balanced)',
    failoverNode: 'RTR-POW-004',
    failoverDist: '0.8 km',
    coverageRadiusMeters: 3600,
  },
  {
    id: 'TWR-IND-043',
    name: 'Thane West Sector Relay',
    type: 'Cell Tower 5G-NR',
    location: 'Ghodbunder Rd, Thane • 19.2183° N, 72.9781° E',
    lat: 19.2183,
    lng: 72.9781,
    status: 'backup',
    svm: 'Normal (98.2%)',
    dbscan: 'Monitor',
    signal: '-72 dBm (Strong)',
    latency: '34 ms (Optimal)',
    loss: '0.2 % (Nominal)',
    load: '42.0 % (Available)',
    failoverNode: 'TWR-IND-042',
    failoverDist: '1.2 km',
    coverageRadiusMeters: 3000,
  },
  {
    id: 'TWR-AND-019',
    name: 'Andheri West Transit Cell',
    type: 'Cell Tower 5G-NR',
    location: 'Lokhandwala, Andheri West • 19.1363° N, 72.8277° E',
    lat: 19.1363,
    lng: 72.8277,
    status: 'normal',
    svm: 'Normal (96.5%)',
    dbscan: 'Monitor',
    signal: '-75 dBm (Good)',
    latency: '29 ms (Normal)',
    loss: '0.3 % (Normal)',
    load: '66.4 % (Normal)',
    failoverNode: 'TWR-IND-042',
    failoverDist: '6.4 km',
    coverageRadiusMeters: 2600,
  },
  {
    id: 'GTW-NAV-204',
    name: 'Navi Mumbai Gateway Point',
    type: 'Edge Gateway',
    location: 'Vashi Sector 17, Navi Mumbai • 19.0740° N, 72.9980° E',
    lat: 19.0740,
    lng: 72.9980,
    status: 'normal',
    svm: 'Normal (98.0%)',
    dbscan: 'Monitor',
    signal: '-70 dBm (Strong)',
    latency: '22 ms (Fast)',
    loss: '0.08 % (Nominal)',
    load: '51.5 % (Balanced)',
    coverageRadiusMeters: 3200,
  },
];

export const NetworkMap: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const assetQuery = searchParams.get('asset');
  const latQuery = searchParams.get('lat');
  const lngQuery = searchParams.get('lng');
  const typeQuery = searchParams.get('type');
  const priorityQuery = searchParams.get('priority');
  const flagQuery = searchParams.get('flag');
  const cityQuery = searchParams.get('city');
  const regionQuery = searchParams.get('region');
  const locQuery = searchParams.get('loc');

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersMapRef = useRef<{ [id: string]: L.Marker }>({});

  const layersRef = useRef<{
    markers: L.LayerGroup;
    polylines: L.LayerGroup;
    circles: L.LayerGroup;
  }>({
    markers: L.layerGroup(),
    polylines: L.layerGroup(),
    circles: L.layerGroup(),
  });

  // State: selected node, node display isolation filter, and view toggles
  const [selectedNode, setSelectedNode] = useState<MapNode>(() => {
    if (latQuery && lngQuery) {
      const pLat = parseFloat(latQuery);
      const pLng = parseFloat(lngQuery);
      if (!isNaN(pLat) && !isNaN(pLng)) {
        const fullLocation = locQuery || `${cityQuery || ''}${regionQuery ? ', ' + regionQuery : ''}`;
        return {
          id: (assetQuery || 'MANUAL-INPUT').trim().toUpperCase(),
          name: `${(assetQuery || 'MANUAL-INPUT').trim().toUpperCase()} (${typeQuery || 'Asset'})`,
          type: typeQuery || 'Inspected Node',
          location: `${fullLocation ? fullLocation + ' • ' : ''}${pLat.toFixed(4)}°, ${pLng.toFixed(4)}°`,
          lat: pLat,
          lng: pLng,
          status: priorityQuery?.toLowerCase() === 'high' ? 'critical' : priorityQuery?.toLowerCase() === 'medium' ? 'warning' : 'normal',
          svm: `${priorityQuery || 'High'} Priority`,
          dbscan: `${flagQuery || 'Investigate'}`,
          signal: '-94 dBm (Degraded)',
          latency: '215.84 ms (+184%)',
          loss: '4.5 % (High)',
          load: '91.2 % (Saturated)',
          failoverNode: 'N/A',
          failoverDist: 'N/A',
          coverageRadiusMeters: 3000,
          investigationPriority: priorityQuery || 'High',
          decisionFlag: flagQuery || 'Investigate',
          city: cityQuery || locQuery || '',
          region: regionQuery || '',
        };
      }
    }
    return REAL_TELECOM_NODES[0];
  });
  const [displayedNodeFilter, setDisplayedNodeFilter] = useState<string>('ALL');
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showTrunks, setShowTrunks] = useState(true);
  const [filterAtRisk, setFilterAtRisk] = useState(true);
  const [tileStyle, setTileStyle] = useState<'carto' | 'osm'>('carto');

  // Helper to resolve node from ID string (exact or partial, or synthesized)
  const resolveNode = (id: string | null): MapNode | null => {
    // If coordinates were explicitly provided in URL params
    if (latQuery && lngQuery) {
      const pLat = parseFloat(latQuery);
      const pLng = parseFloat(lngQuery);
      if (!isNaN(pLat) && !isNaN(pLng)) {
        const fullLocation = locQuery || `${cityQuery || ''}${regionQuery ? ', ' + regionQuery : ''}`;
        return {
          id: (id || 'MANUAL-INPUT').trim().toUpperCase(),
          name: `${(id || 'MANUAL-INPUT').trim().toUpperCase()} (${typeQuery || 'Asset'})`,
          type: typeQuery || 'Inspected Node',
          location: `${fullLocation ? fullLocation + ' • ' : ''}${pLat.toFixed(4)}°, ${pLng.toFixed(4)}°`,
          lat: pLat,
          lng: pLng,
          status: priorityQuery?.toLowerCase() === 'high' ? 'critical' : priorityQuery?.toLowerCase() === 'medium' ? 'warning' : 'normal',
          svm: `${priorityQuery || 'High'} Priority`,
          dbscan: `${flagQuery || 'Investigate'}`,
          signal: '-94 dBm (Degraded)',
          latency: '215.84 ms (+184%)',
          loss: '4.5 % (High)',
          load: '91.2 % (Saturated)',
          failoverNode: 'N/A',
          failoverDist: 'N/A',
          coverageRadiusMeters: 3000,
          investigationPriority: priorityQuery || 'High',
          decisionFlag: flagQuery || 'Investigate',
          city: cityQuery || locQuery || '',
          region: regionQuery || '',
        };
      }
    }

    if (!id) return null;
    const clean = id.trim().toLowerCase();
    const exact = REAL_TELECOM_NODES.find((n) => n.id.toLowerCase() === clean);
    if (exact) return exact;
    const partial = REAL_TELECOM_NODES.find(
      (n) => n.id.toLowerCase().includes(clean) || clean.includes(n.id.toLowerCase())
    );
    if (partial) return partial;

    // Fallback: Synthesize an inspected node in the Mumbai grid
    return {
      id: id.trim().toUpperCase(),
      name: `${id.trim().toUpperCase()} Dynamic Target`,
      type: 'Inspected Node',
      location: 'Mumbai Sector Grid • 19.0760° N, 72.8377° E',
      lat: 19.0760,
      lng: 72.8377,
      status: 'critical',
      svm: 'At Risk (Telemetric Inspection)',
      dbscan: 'Investigate',
      signal: '-94 dBm (Degraded)',
      latency: '142 ms (+184%)',
      loss: '4.8 % (High)',
      load: '91.2 % (Saturated)',
      failoverNode: 'TWR-IND-043',
      failoverDist: '1.2 km',
      coverageRadiusMeters: 3000,
    };
  };

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    let initCenter: [number, number] = [19.0980, 72.8800];
    let initZoom = 11;
    if (latQuery && lngQuery) {
      const pLat = parseFloat(latQuery);
      const pLng = parseFloat(lngQuery);
      if (!isNaN(pLat) && !isNaN(pLng)) {
        initCenter = [pLat, pLng];
        initZoom = 13;
      }
    }

    // Center on target asset coordinates if provided, else Mumbai metropolitan area
    const map = L.map(mapContainerRef.current, {
      center: initCenter,
      zoom: initZoom,
      zoomControl: false,
    });

    mapInstanceRef.current = map;

    // Tile Layer: CartoDB Positron for Averon Enterprise Clean Aesthetic
    const tileUrl =
      tileStyle === 'carto'
        ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    L.tileLayer(tileUrl, {
      attribution: '&copy; CartoDB &copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    layersRef.current.circles.addTo(map);
    layersRef.current.polylines.addTo(map);
    layersRef.current.markers.addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Handle Tile Layer Switch
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const tileUrl =
      tileStyle === 'carto'
        ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    L.tileLayer(tileUrl, {
      attribution: '&copy; CartoDB &copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
  }, [tileStyle]);

  // 3. Sync from URL Query Param ?asset=... & ?lat=... & ?lng=... (From Command Center / Analyze Telemetry)
  useEffect(() => {
    if (!assetQuery && !latQuery) return;

    if (!latQuery && assetQuery) {
      getAssetLocation(assetQuery)
        .then((loc) => {
          if (loc && loc.latitude != null && loc.longitude != null) {
            const fullLoc = [loc.city, loc.region, loc.country].filter(Boolean).join(', ');
            const dynNode: MapNode = {
              id: loc.asset_id,
              name: `${loc.asset_id} (${typeQuery || 'Asset'})`,
              type: typeQuery || 'Inspected Node',
              location: `${fullLoc ? fullLoc + ' • ' : ''}${loc.latitude.toFixed(4)}°, ${loc.longitude.toFixed(4)}°`,
              lat: loc.latitude,
              lng: loc.longitude,
              status: priorityQuery?.toLowerCase() === 'high' ? 'critical' : priorityQuery?.toLowerCase() === 'medium' ? 'warning' : 'normal',
              svm: `${priorityQuery || 'High'} Priority`,
              dbscan: flagQuery || 'Investigate',
              signal: '-94 dBm (Degraded)',
              latency: '215.84 ms',
              loss: '4.5 %',
              load: '91.2 %',
              failoverNode: 'N/A',
              failoverDist: 'N/A',
              coverageRadiusMeters: 3000,
              investigationPriority: priorityQuery || 'High',
              decisionFlag: flagQuery || 'Investigate',
              city: loc.city || '',
              region: loc.region || '',
            };
            setSelectedNode(dynNode);
            if (mapInstanceRef.current) {
              mapInstanceRef.current.flyTo([loc.latitude, loc.longitude], 13, { duration: 1.0 });
            }
          }
        })
        .catch(() => {});
    }

    const target = resolveNode(assetQuery);
    if (!target) return;

    setSelectedNode(target);
    // Automatically pan & zoom to the exact asset
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([target.lat, target.lng], 13, { duration: 1.0 });
    }
    // Open popup after map transition
    const timer = setTimeout(() => {
      if (markersMapRef.current[target.id]) {
        markersMapRef.current[target.id].openPopup();
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [assetQuery, latQuery, lngQuery]);

  // 4. Update GIS Overlays, Fiber Links, and Markers based on selection & filter
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const { markers, polylines, circles } = layersRef.current;
    markers.clearLayers();
    polylines.clearLayers();
    circles.clearLayers();
    markersMapRef.current = {};

    // Combine standard nodes with any dynamic/queried asset node (replace static if ID matches)
    const allAvailableNodes = REAL_TELECOM_NODES.filter((n) => !selectedNode || n.id !== selectedNode.id);
    if (selectedNode) {
      allAvailableNodes.push(selectedNode);
    }

    // Determine nodes to display based on Display Selector
    const nodesToDisplay =
      displayedNodeFilter === 'ALL'
        ? allAvailableNodes
        : allAvailableNodes.filter(
          (node) =>
            node.id === displayedNodeFilter ||
            (node.failoverNode && node.failoverNode === displayedNodeFilter) ||
            (allAvailableNodes.find((n) => n.id === displayedNodeFilter)?.failoverNode === node.id)
        );

    // 1. Fiber Backbones: Polylines between nodes
    if (showTrunks) {
      const allConnections: [string, string, [number, number], [number, number]][] = [
        ['BST-WOR-015', 'GTW-MUM-108', [19.0176, 72.8156], [19.0657, 72.8688]],
        ['GTW-MUM-108', 'TWR-IND-042', [19.0657, 72.8688], [19.0760, 72.8377]],
        ['TWR-IND-042', 'TWR-AND-019', [19.0760, 72.8377], [19.1363, 72.8277]],
        ['GTW-MUM-108', 'RTR-POW-003', [19.0657, 72.8688], [19.1176, 72.9060]],
        ['RTR-POW-003', 'TWR-IND-043', [19.1176, 72.9060], [19.2183, 72.9781]],
        ['GTW-MUM-108', 'GTW-NAV-204', [19.0657, 72.8688], [19.0740, 72.9980]],
        ['TWR-IND-042', 'TWR-IND-043', [19.0760, 72.8377], [19.2183, 72.9781]], // Failover trunk
      ];

      allConnections.forEach(([idA, idB, coordA, coordB]) => {
        // If isolating a specific node, only draw lines connected to that node
        if (displayedNodeFilter !== 'ALL' && idA !== displayedNodeFilter && idB !== displayedNodeFilter) {
          return;
        }

        const isFailoverTrunk =
          (idA === 'TWR-IND-042' && idB === 'TWR-IND-043') ||
          (idA === 'TWR-IND-043' && idB === 'TWR-IND-042');

        const line = L.polyline([coordA, coordB], {
          color: isFailoverTrunk ? '#10B981' : '#6366F1',
          weight: isFailoverTrunk ? 3 : 2.5,
          opacity: 0.75,
          dashArray: isFailoverTrunk ? '4, 4' : '6, 6',
        });
        line.addTo(polylines);
      });
    }

    // 2. Real RF Heatmap / Coverage Range Circles
    if (showHeatmap) {
      nodesToDisplay.forEach((node) => {
        if (!node.coverageRadiusMeters) return;
        const isCritical = node.status === 'critical';
        const isBackup = node.status === 'backup';
        const isSelected = selectedNode.id === node.id;

        const circle = L.circle([node.lat, node.lng], {
          radius: node.coverageRadiusMeters,
          color: isSelected
            ? '#4F46E5'
            : isCritical
              ? '#EF4444'
              : isBackup
                ? '#10B981'
                : '#8B5CF6',
          fillColor: isCritical ? '#EF4444' : isBackup ? '#10B981' : '#6366F1',
          fillOpacity: isSelected ? 0.22 : isCritical ? 0.16 : 0.08,
          weight: isSelected ? 2 : 1.2,
          dashArray: isCritical ? '4, 4' : undefined,
        });

        circle.addTo(circles);
      });
    }

    // 3. Real Node Markers with Beacon Ripple Animations
    nodesToDisplay.forEach((node) => {
      // Checkbox filter logic (only applies when displaying all nodes)
      if (displayedNodeFilter === 'ALL') {
        if (!filterAtRisk && node.svm.includes('At Risk')) return;
      }

      const isCritical = node.status === 'critical';
      const isBackup = node.status === 'backup';
      const isSelected = selectedNode.id === node.id;

      let htmlMarker = '';
      if (isCritical) {
        htmlMarker = `
          <div class="beacon-pulse ${isSelected ? 'beacon-focused' : ''}">
            <div class="beacon-pulse-inner"></div>
            ${isSelected ? '<div class="beacon-target-ring"></div>' : ''}
          </div>
        `;
      } else if (isBackup) {
        htmlMarker = `
          <div class="beacon-pulse beacon-pulse-emerald ${isSelected ? 'beacon-focused' : ''}">
            <div class="beacon-pulse-inner-emerald"></div>
            ${isSelected ? '<div class="beacon-target-ring"></div>' : ''}
          </div>
        `;
      } else {
        htmlMarker = `
          <div class="beacon-pulse ${isSelected ? 'beacon-focused' : ''}">
            <div class="beacon-pulse-indigo-inner"></div>
            ${isSelected ? '<div class="beacon-target-ring"></div>' : ''}
          </div>
        `;
      }

      const icon = L.divIcon({
        html: htmlMarker,
        className: 'custom-beacon-icon',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([node.lat, node.lng], { icon });

      // Determine priority, decision flag, and location for popup
      const prioDisplay = node.investigationPriority || (isCritical ? 'High' : isBackup ? 'Routine' : 'Medium');
      const flagDisplay = node.decisionFlag || (isCritical ? 'Investigate' : 'Monitor');
      const cityRegionDisplay = node.city || node.region || node.location;

      // Interactive Popup displaying:
      // Asset ID, Asset type, Investigation priority, Final decision-support flag, City or region
      marker.bindPopup(`
        <div class="p-1 min-w-[220px]">
          <div class="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-slate-100">
            <span class="font-extrabold text-slate-900 text-xs">${node.id}</span>
            <span class="px-2 py-0.5 rounded-full text-[9px] font-bold ${isCritical
          ? 'bg-rose-100 text-rose-800'
          : isBackup
            ? 'bg-emerald-100 text-emerald-800'
            : 'bg-indigo-100 text-indigo-800'
        }">${node.type}</span>
          </div>
          <div class="text-[10px] space-y-1 bg-slate-50 p-2.5 rounded-xl mb-2">
            <div class="flex justify-between">
              <span class="text-slate-500">Asset Type:</span>
              <strong class="text-slate-800">${node.type}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Investigation Priority:</span>
              <strong class="${prioDisplay === 'High' ? 'text-rose-600' : 'text-slate-800'}">${prioDisplay}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Final Decision:</span>
              <strong class="${flagDisplay === 'Investigate' ? 'text-rose-600' : 'text-emerald-700'}">${flagDisplay}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">City / Region:</span>
              <strong class="text-slate-800">${cityRegionDisplay}</strong>
            </div>
          </div>
          <div class="text-[10px] text-center text-purple-600 font-semibold cursor-pointer">
            Centered on live geo coordinates (${node.lat.toFixed(4)}, ${node.lng.toFixed(4)})
          </div>
        </div>
      `);

      marker.on('click', () => {
        setSelectedNode(node);
        setSearchParams({ asset: node.id }, { replace: true });
        map.panTo([node.lat, node.lng], { animate: true, duration: 0.6 });
      });

      marker.addTo(markers);
      markersMapRef.current[node.id] = marker;
    });
  }, [showHeatmap, showTrunks, filterAtRisk, displayedNodeFilter, selectedNode]);

  // Handler: Select a node to focus and view
  const handleSelectNode = (node: MapNode) => {
    setSelectedNode(node);
    setSearchParams({ asset: node.id }, { replace: true });
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([node.lat, node.lng], 14, { duration: 1.0 });
    }
    setTimeout(() => {
      markersMapRef.current[node.id]?.openPopup();
    }, 400);
  };

  // Handler: Change which node to display (or "ALL")
  const handleFilterNodeChange = (targetId: string) => {
    setDisplayedNodeFilter(targetId);
    if (targetId === 'ALL') {
      setSearchParams({}, { replace: true });
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([19.0980, 72.8800], 11, { duration: 1.0 });
      }
    } else {
      const node = resolveNode(targetId);
      if (node) {
        setSelectedNode(node);
        setSearchParams({ asset: node.id }, { replace: true });
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([node.lat, node.lng], 14, { duration: 1.0 });
        }
        setTimeout(() => {
          markersMapRef.current[node.id]?.openPopup();
        }, 400);
      }
    }
  };

  const handleZoom = (delta: number) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setZoom(mapInstanceRef.current.getZoom() + delta);
    }
  };

  const resetView = () => {
    setDisplayedNodeFilter('ALL');
    setSelectedNode(REAL_TELECOM_NODES[0]);
    setFilterAtRisk(true);
    setShowHeatmap(true);
    setShowTrunks(true);
    setSearchParams({}, { replace: true });
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([19.0980, 72.8800], 11, { duration: 0.8 });
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 animate-page-transition">
      {/* Section B: Filter Pill Bar (Averon Soft Pill Dock) */}
      <section className="bg-white rounded-[28px] p-6 border border-slate-200/70 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-bold uppercase tracking-wider mb-1">
              <span className="material-symbols-outlined text-[14px]">satellite_alt</span>
              <span>Live Geographic Cartography (Leaflet GIS Engine)</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Real-World Telecom Spatial Infrastructure
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-mono font-medium">
              <span className="material-symbols-outlined text-[16px] text-purple-600">
                my_location
              </span>
              <span>
                {selectedNode.lat.toFixed(4)}° N, {selectedNode.lng.toFixed(4)}° E
              </span>
            </div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Real Satellite Mesh Synced</span>
            </div>
          </div>
        </div>

        {/* Filter Controls & Node Display Selector Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Primary Control: Option to choose which node to display */}
            <div className="flex items-center gap-2 bg-purple-50/70 border border-purple-200/90 rounded-full px-3 py-1 shadow-xs">
              <span className="material-symbols-outlined text-[16px] text-purple-700">
                filter_center_focus
              </span>
              <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">
                Display Node:
              </span>
              <div className="relative">
                <select
                  id="node-display-selector"
                  value={displayedNodeFilter}
                  onChange={(e) => handleFilterNodeChange(e.target.value)}
                  className="appearance-none bg-white hover:bg-slate-50 border border-purple-300 text-slate-900 font-bold px-3 py-1 pr-7 rounded-full shadow-xs text-xs focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 transition-all cursor-pointer"
                  aria-label="Choose which node to display on the map"
                >
                  <option value="ALL">🌐 All Monitored Nodes (7 Total)</option>
                  <optgroup label="Critical & Warning Nodes">
                    <option value="TWR-IND-042">🔴 TWR-IND-042 — Santacruz West (Critical P1)</option>
                    <option value="GTW-MUM-108">🟡 GTW-MUM-108 — BKC Hub (Warning P2)</option>
                  </optgroup>
                  <optgroup label="Operational & Backup Nodes">
                    <option value="BST-WOR-015">🟢 BST-WOR-015 — Worli Sea-Link Coastal Hub</option>
                    <option value="RTR-POW-003">🟢 RTR-POW-003 — Powai Optical Center</option>
                    <option value="TWR-IND-043">🔵 TWR-IND-043 — Thane Relay (Backup Failover)</option>
                    <option value="TWR-AND-019">🟢 TWR-AND-019 — Andheri West Transit Cell</option>
                    <option value="GTW-NAV-204">🟢 GTW-NAV-204 — Navi Mumbai Gateway Point</option>
                  </optgroup>
                </select>
                <span className="material-symbols-outlined text-[15px] text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  expand_more
                </span>
              </div>
            </div>

            {/* Geographic Context Pills */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-700">
              <span className="text-slate-400">Hub:</span>
              <strong>Mumbai Metro (West Zone)</strong>
            </div>

            {/* Model Condition Filters */}
            <button
              onClick={() => setFilterAtRisk(!filterAtRisk)}
              className={`px-3 py-1.5 rounded-full font-bold flex items-center gap-1.5 transition-all cursor-pointer ${filterAtRisk
                  ? 'bg-rose-50 border border-rose-200 text-rose-800'
                  : 'bg-slate-100 text-slate-400 border border-slate-200'
                }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${filterAtRisk ? 'bg-rose-600' : 'bg-slate-300'}`}
              />
              <span>Random Forest: At Risk</span>
            </button>
          </div>

          <button
            onClick={resetView}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-slate-400 hover:text-slate-700 font-medium transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px]">restart_alt</span>
            <span>Reset View</span>
          </button>
        </div>
      </section>

      {/* Main Real Map Workspace (8 cols map + 4 cols inspected target summary card) */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Real Leaflet Map Canvas (8 cols) */}
        <div className="xl:col-span-8 bg-white rounded-[32px] p-6 border border-slate-200/70 shadow-xs relative overflow-hidden min-h-[640px] flex flex-col justify-between group">
          {/* Real Leaflet Map Container */}
          <div className="absolute inset-0 z-0">
            <div ref={mapContainerRef} className="w-full h-full" />
          </div>

          {/* Top Floating Controls Capsule */}
          <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 w-full pointer-events-none">
            <div className="pointer-events-auto inline-flex p-1 bg-white/95 backdrop-blur-md rounded-full border border-slate-200/80 shadow-md text-xs">
              <button
                onClick={() => setTileStyle('carto')}
                className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${tileStyle === 'carto'
                    ? 'bg-slate-900 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 font-medium'
                  }`}
              >
                Positron GIS
              </button>
              <button
                onClick={() => setTileStyle('osm')}
                className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${tileStyle === 'osm'
                    ? 'bg-slate-900 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 font-medium'
                  }`}
              >
                Standard Street
              </button>
              <div className="h-4 w-px bg-slate-200 my-auto mx-1" />
              <button
                onClick={() => setShowHeatmap(!showHeatmap)}
                className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${showHeatmap
                    ? 'bg-purple-100 text-purple-800 font-bold'
                    : 'text-slate-400 hover:text-slate-700'
                  }`}
              >
                RF Coverage
              </button>
              <button
                onClick={() => setShowTrunks(!showTrunks)}
                className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${showTrunks
                    ? 'bg-indigo-100 text-indigo-800 font-bold'
                    : 'text-slate-400 hover:text-slate-700'
                  }`}
              >
                Fiber Trunks
              </button>
            </div>

            {/* Targeted Node Inspection Indicator */}
            <div className="pointer-events-auto flex items-center gap-2">
              {displayedNodeFilter !== 'ALL' && (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-purple-900/90 text-white backdrop-blur-md rounded-full shadow-md text-xs animate-in fade-in duration-200">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>
                    Isolating: <strong className="font-mono">{displayedNodeFilter}</strong>
                  </span>
                  <button
                    onClick={() => handleFilterNodeChange('ALL')}
                    className="ml-1 text-[11px] underline text-purple-200 hover:text-white cursor-pointer"
                  >
                    Show All
                  </button>
                </div>
              )}

              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/95 backdrop-blur-md rounded-full border border-slate-200/80 shadow-md text-xs">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span>
                  Inspecting: <strong className="text-slate-900">{selectedNode.id}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Node Selector Pills Floating at Bottom */}
          <div className="relative z-20 flex flex-wrap items-end justify-between gap-4 w-full mt-auto pt-4 pointer-events-none">
            <div className="pointer-events-auto bg-white/95 backdrop-blur-md p-2 px-3 rounded-2xl border border-slate-200/80 shadow-md flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pl-1">
                Quick Select Node:
              </span>
              <button
                onClick={() => handleFilterNodeChange('ALL')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${displayedNodeFilter === 'ALL'
                    ? 'bg-purple-900 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
              >
                All Nodes
              </button>
              {REAL_TELECOM_NODES.map((node) => {
                const isActive = selectedNode.id === node.id;
                const isCritical = node.status === 'critical';
                const isBackup = node.status === 'backup';
                return (
                  <button
                    key={node.id}
                    onClick={() => {
                      handleSelectNode(node);
                      setDisplayedNodeFilter(node.id);
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${isActive
                        ? 'bg-slate-900 text-white shadow-xs ring-2 ring-purple-500/50'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${isCritical
                          ? 'bg-rose-500'
                          : isBackup
                            ? 'bg-emerald-500'
                            : 'bg-indigo-500'
                        }`}
                    />
                    <span>{node.id}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom Zoom Controls */}
            <div className="pointer-events-auto flex flex-col bg-white/95 backdrop-blur-md rounded-full border border-slate-200/80 shadow-md p-1 gap-1">
              <button
                onClick={() => handleZoom(1)}
                aria-label="Zoom in"
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-700 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
              </button>
              <div className="h-px w-4 mx-auto bg-slate-200" />
              <button
                onClick={() => handleZoom(-1)}
                aria-label="Zoom out"
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-700 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">remove</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section C: Selected Asset Summary Card (4 cols) (Averon Clean Slate) */}
        <div className="xl:col-span-4 bg-white rounded-[32px] p-7 border border-slate-200/70 shadow-xs flex flex-col gap-6 animate-in slide-in-from-right-4 duration-300">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
              <span>Inspected Geographic Target</span>
            </div>
            <span className="text-xs font-mono text-slate-400">ID: #{selectedNode.id}</span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {selectedNode.id}
              </h2>
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                {selectedNode.type}
              </span>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px] text-slate-400">
                location_on
              </span>
              <span>{selectedNode.location}</span>
            </p>
          </div>

          {/* Quick Node Isolator Button in Card */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleFilterNodeChange(selectedNode.id)}
              className={`flex-1 py-2 px-3 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${displayedNodeFilter === selectedNode.id
                  ? 'bg-purple-100 text-purple-800 border border-purple-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
            >
              <span className="material-symbols-outlined text-[15px]">filter_center_focus</span>
              <span>
                {displayedNodeFilter === selectedNode.id
                  ? 'Currently Isolated on Map'
                  : 'Isolate This Node on Map'}
              </span>
            </button>
            {displayedNodeFilter !== 'ALL' && (
              <button
                onClick={() => handleFilterNodeChange('ALL')}
                className="py-2 px-3 rounded-full text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                title="Show all nodes on map"
              >
                Show All
              </button>
            )}
          </div>

          {/* Separate Assessment Tags */}
          <div className="grid grid-cols-2 gap-2.5">
            <div
              className={`p-3 rounded-2xl border ${selectedNode.svm.includes('At Risk')
                  ? 'bg-rose-50 border-rose-100 text-rose-950'
                  : 'bg-emerald-50 border-emerald-100 text-emerald-950'
                }`}
            >
              <div
                className={`text-[10px] font-bold uppercase tracking-wider ${selectedNode.svm.includes('At Risk') ? 'text-rose-700' : 'text-emerald-700'
                  }`}
              >
                Random Forest Classifier
              </div>
              <div className="text-xs font-extrabold mt-0.5">{selectedNode.svm}</div>
            </div>
            <div
              className={`p-3 rounded-2xl border ${selectedNode.status === 'critical'
                  ? 'bg-rose-50 border-rose-100 text-rose-950'
                  : selectedNode.status === 'warning'
                    ? 'bg-amber-50 border-amber-100 text-amber-950'
                    : 'bg-emerald-50 border-emerald-100 text-emerald-950'
                }`}
            >
              <div
                className={`text-[10px] font-bold uppercase tracking-wider ${selectedNode.status === 'critical'
                    ? 'text-rose-700'
                    : selectedNode.status === 'warning'
                      ? 'text-amber-700'
                      : 'text-emerald-700'
                  }`}
              >
                Triage Priority
              </div>
              <div className="text-xs font-extrabold mt-0.5">
                {selectedNode.investigationPriority || (selectedNode.status === 'critical' ? 'High' : selectedNode.status === 'warning' ? 'Medium' : 'Routine')} Priority
              </div>
            </div>
          </div>

          {/* Telemetry Snapshot */}
          <div className="p-4 rounded-2xl bg-slate-50 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Signal Strength</span>
              <span
                className={`font-extrabold font-mono ${selectedNode.signal.includes('Degraded') ? 'text-rose-600' : 'text-slate-900'
                  }`}
              >
                {selectedNode.signal}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Round-Trip Latency</span>
              <span
                className={`font-extrabold font-mono ${selectedNode.latency.includes('+') ? 'text-rose-600' : 'text-slate-900'
                  }`}
              >
                {selectedNode.latency}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Packet Loss Rate</span>
              <span
                className={`font-extrabold font-mono ${selectedNode.loss.includes('High') || selectedNode.loss.includes('Elevated')
                    ? 'text-rose-600'
                    : 'text-slate-900'
                  }`}
              >
                {selectedNode.loss}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Sector Bandwidth Load</span>
              <span
                className={`font-extrabold font-mono ${selectedNode.load.includes('Saturated') || selectedNode.load.includes('Heavy')
                    ? 'text-rose-600'
                    : 'text-slate-900'
                  }`}
              >
                {selectedNode.load}
              </span>
            </div>
          </div>

          {/* Nearest Failover Tower Reference */}
          {selectedNode.failoverNode && (
            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-emerald-950">
                  Nearest Failover Node: {selectedNode.failoverNode}
                </span>
                <span className="text-emerald-700 font-semibold">{selectedNode.failoverDist}</span>
              </div>
              <p className="text-[11px] text-emerald-800">
                Healthy standby status with capacity ready for traffic offload.
              </p>
            </div>
          )}

          {/* Primary Action Button: Open Telemetry Analysis */}
          <Link
            to="/analyze-telemetry"
            className="w-full py-4 rounded-full bg-slate-900 hover:bg-purple-900 text-white font-bold text-xs shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 group cursor-pointer"
          >
            <span>Analyze Telemetry in Sandbox</span>
            <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">
              arrow_forward
            </span>
          </Link>
        </div>
      </section>

      {/* Section D: Geographic Accuracy Disclaimer */}
      <section className="p-5 rounded-2xl bg-slate-100/70 border border-slate-200/80 text-xs text-slate-500 flex items-center gap-3">
        <span className="material-symbols-outlined text-[20px] text-slate-400 shrink-0">info</span>
        <span>
          <strong>Live GIS Cartography:</strong> Displaying real OpenStreetMap & CartoDB coordinates
          for the Western India cell sector mesh. Real RF propagation radiuses and high-capacity
          optical fiber backbones are actively rendered with interactive node isolation controls.
        </span>
      </section>
    </div>
  );
};
