import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  Database,
  CheckCircle2,
  FileSpreadsheet,
  AlertTriangle,
  XCircle,
  Eye,
  Save,
  Download,
  MapPin,
  RefreshCw,
  Sliders,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { predictRecord, ingestCsv, getAssets, getGeoLookup } from '../../api/client';
import { useTelemetry } from '../../context/TelemetryContext';
import { Reading, IngestionReport, PaginatedAssets } from '../../types/api';
import { getStatusStyle, useApiStatus } from '../../api/hooks';

export const CompanyDataInputPanel: React.FC = () => {
  const navigate = useNavigate();
  const { refreshData } = useTelemetry();
  const { isOnline } = useApiStatus();

  const [activeTab, setActiveTab] = useState<'manual' | 'csv'>('manual');

  // ---------------------------------------------------------
  // Manual Form State
  // ---------------------------------------------------------
  const [formData, setFormData] = useState({
    asset_id: 'MH-PN-999',
    asset_type: 'Cell Tower',
    continent: 'Asia',
    city: 'Pune',
    country: 'India',
    region: 'Maharashtra',
    latitude: 18.5204,
    longitude: 73.8567,
    signal_strength_dbm: -104,
    latency_ms: 182,
    packet_loss_pct: 11.8,
    throughput_mbps: 4.2,
    connected_users: 1820,
    traffic_load_pct: 95,
    call_drop_rate_pct: 6.2,
    resource_utilization_pct: 96,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
  });

  const [geoInfo, setGeoInfo] = useState<{
    continent: string | null;
    country: string | null;
    city: string | null;
    region: string | null;
    distance_km?: number | null;
  } | null>({
    continent: 'Asia',
    country: 'India',
    city: 'Pune',
    region: 'Maharashtra',
    distance_km: 0.4,
  });
  const [showLocationOverride, setShowLocationOverride] = useState<boolean>(false);
  const [isResolvingGeo, setIsResolvingGeo] = useState<boolean>(false);

  // Automatically reverse geocode GPS coordinates to continent, country, city
  useEffect(() => {
    const lat = Number(formData.latitude);
    const lng = Number(formData.longitude);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      setIsResolvingGeo(true);
      const timer = setTimeout(async () => {
        try {
          const res = await getGeoLookup(lat, lng);
          if (res && res.city) {
            setGeoInfo(res);
            setFormData((prev) => ({
              ...prev,
              continent: res.continent || prev.continent,
              country: res.country || prev.country,
              city: res.city || prev.city,
              region: res.region || prev.region,
            }));
          }
        } catch {
          // Fallback silently if network hiccup
        } finally {
          setIsResolvingGeo(false);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [formData.latitude, formData.longitude]);

  const [manualImpute, setManualImpute] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [manualErrors, setManualErrors] = useState<string[]>([]);
  const [manualWarnings, setManualWarnings] = useState<string[]>([]);
  const [previewResult, setPreviewResult] = useState<Reading | null>(null);
  const [persistSuccess, setPersistSuccess] = useState<boolean>(false);

  // ---------------------------------------------------------
  // CSV Ingestion State
  // ---------------------------------------------------------
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImpute, setCsvImpute] = useState<boolean>(true);
  const [isDryRunning, setIsDryRunning] = useState<boolean>(false);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [dryRunReport, setDryRunReport] = useState<IngestionReport | null>(null);
  const [confirmedReport, setConfirmedReport] = useState<IngestionReport | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);

  // ---------------------------------------------------------
  // Inventory Table State
  // ---------------------------------------------------------
  const [inventorySource, setInventorySource] = useState<string>('manual');
  const [inventoryPage, setInventoryPage] = useState<number>(1);
  const [inventoryLoading, setInventoryLoading] = useState<boolean>(false);
  const [inventoryData, setInventoryData] = useState<PaginatedAssets | null>(null);

  const loadInventory = useCallback(async () => {
    setInventoryLoading(true);
    try {
      const params: { source?: string; page: number; page_size: number } = {
        page: inventoryPage,
        page_size: 10,
      };
      if (inventorySource !== 'all') {
        params.source = inventorySource;
      }
      const data = await getAssets(params);
      setInventoryData(data);
    } catch (err: any) {
      console.error('Failed to load inventory assets:', err);
    } finally {
      setInventoryLoading(false);
    }
  }, [inventorySource, inventoryPage]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  // Demo presets
  const applyPreset = (preset: typeof formData) => {
    setFormData(preset);
    setManualErrors([]);
    setManualWarnings([]);
    setPreviewResult(null);
    setPersistSuccess(false);
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Submit manual form (preview or persist)
  const handleManualAction = async (persist: boolean) => {
    if (!isOnline) return;
    setIsSubmitting(true);
    setManualErrors([]);
    setManualWarnings([]);
    setPersistSuccess(false);

    try {
      const payload = {
        asset_id: formData.asset_id.trim(),
        asset_type: formData.asset_type,
        continent: (showLocationOverride ? formData.continent : (geoInfo?.continent || formData.continent))?.trim() || undefined,
        city: (showLocationOverride ? formData.city : (geoInfo?.city || formData.city))?.trim() || undefined,
        country: (showLocationOverride ? formData.country : (geoInfo?.country || formData.country))?.trim() || undefined,
        region: (showLocationOverride ? formData.region : (geoInfo?.region || formData.region))?.trim() || undefined,
        latitude: Number(formData.latitude),
        longitude: Number(formData.longitude),
        signal_strength_dbm: Number(formData.signal_strength_dbm),
        latency_ms: Number(formData.latency_ms),
        packet_loss_pct: Number(formData.packet_loss_pct),
        throughput_mbps: Number(formData.throughput_mbps),
        connected_users: Number(formData.connected_users),
        traffic_load_pct: Number(formData.traffic_load_pct),
        call_drop_rate_pct: Number(formData.call_drop_rate_pct),
        resource_utilization_pct: Number(formData.resource_utilization_pct),
        timestamp: formData.timestamp || undefined,
      };

      const res = await predictRecord(payload, persist, manualImpute);
      setPreviewResult(res.reading);
      if (res.validation?.warnings?.length) {
        setManualWarnings(res.validation.warnings);
      }
      if (persist) {
        setPersistSuccess(true);
        await refreshData();
        await loadInventory();
      }
    } catch (err: any) {
      if (err.errors && Array.isArray(err.errors)) {
        setManualErrors(err.errors);
      } else {
        setManualErrors([err.message || 'Validation or prediction failed']);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // CSV Dry Run
  const handleCsvDryRun = async () => {
    if (!csvFile || !isOnline) return;
    setIsDryRunning(true);
    setCsvError(null);
    setConfirmedReport(null);

    try {
      const report = await ingestCsv(csvFile, true, csvImpute);
      setDryRunReport(report);
    } catch (err: any) {
      setCsvError(err.message || 'Dry run validation failed');
    } finally {
      setIsDryRunning(false);
    }
  };

  // CSV Confirm Import
  const handleCsvConfirm = async () => {
    if (!csvFile || !isOnline) return;
    setIsConfirming(true);
    setCsvError(null);

    try {
      const report = await ingestCsv(csvFile, false, csvImpute);
      setConfirmedReport(report);
      await refreshData();
      await loadInventory();
    } catch (err: any) {
      setCsvError(err.message || 'Data ingestion failed');
    } finally {
      setIsConfirming(false);
    }
  };

  // Download rejected rows as CSV
  const handleDownloadRejectedRows = (rejectedRows: Array<{ row: number; reasons: string[] }>) => {
    const header = 'Row,Reasons\n';
    const lines = rejectedRows.map((r) => `${r.row},"${r.reasons.join('; ').replace(/"/g, '""')}"`).join('\n');
    const blob = new Blob([header + lines], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `rejected_rows_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] shadow-sm space-y-6">
      {/* Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-[#334155] pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Database className="text-blue-500" size={22} />
            <span>Telemetry Ingestion & Inference</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Submit telemetry records to the backend pipeline for SVM risk classification and DBSCAN anomaly detection.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-[#334155]">
          <button
            onClick={() => setActiveTab('manual')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'manual'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Manual Entry
          </button>
          <button
            onClick={() => setActiveTab('csv')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'csv'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            CSV Ingestion (Two-Step)
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MANUAL ENTRY TAB                                          */}
      {/* ========================================================= */}
      {activeTab === 'manual' && (
        <div className="space-y-6">
          {/* Demo Presets */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
            <span className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5">
              <Sliders size={14} className="text-blue-500" />
              <span>Demo presets (fills standard test parameters):</span>
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  applyPreset({
                    asset_id: 'MH-PN-SHIV-901',
                    asset_type: 'Cell Tower',
                    continent: 'Asia',
                    city: 'Pune',
                    country: 'India',
                    region: 'Maharashtra',
                    latitude: 18.5314,
                    longitude: 73.8446,
                    signal_strength_dbm: -106,
                    latency_ms: 185,
                    packet_loss_pct: 12.4,
                    throughput_mbps: 4.2,
                    connected_users: 1850,
                    traffic_load_pct: 96,
                    call_drop_rate_pct: 6.8,
                    resource_utilization_pct: 98,
                    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
                  })
                }
                className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <ShieldAlert size={14} />
                <span>Pune Shivajinagar</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  applyPreset({
                    asset_id: 'MH-MB-MAR-802',
                    asset_type: 'Base Station',
                    continent: 'Asia',
                    city: 'Mumbai',
                    country: 'India',
                    region: 'Maharashtra',
                    latitude: 18.922,
                    longitude: 72.8223,
                    signal_strength_dbm: -102,
                    latency_ms: 168,
                    packet_loss_pct: 10.8,
                    throughput_mbps: 3.8,
                    connected_users: 1940,
                    traffic_load_pct: 97,
                    call_drop_rate_pct: 7.2,
                    resource_utilization_pct: 96,
                    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
                  })
                }
                className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <ShieldAlert size={14} />
                <span>Mumbai Marine Drive</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  applyPreset({
                    asset_id: 'DL-DEL-CP-703',
                    asset_type: 'Router',
                    continent: 'Asia',
                    city: 'Delhi',
                    country: 'India',
                    region: 'Delhi',
                    latitude: 28.6315,
                    longitude: 77.2167,
                    signal_strength_dbm: -108,
                    latency_ms: 192,
                    packet_loss_pct: 14.2,
                    throughput_mbps: 2.5,
                    connected_users: 2100,
                    traffic_load_pct: 98.5,
                    call_drop_rate_pct: 8.5,
                    resource_utilization_pct: 99,
                    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
                  })
                }
                className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <ShieldAlert size={14} />
                <span>Delhi Connaught Place</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  applyPreset({
                    asset_id: 'KA-BL-101',
                    asset_type: 'Network Gateway',
                    continent: 'Asia',
                    city: 'Bangalore',
                    country: 'India',
                    region: 'Karnataka',
                    latitude: 12.9716,
                    longitude: 77.5946,
                    signal_strength_dbm: -65,
                    latency_ms: 24,
                    packet_loss_pct: 0.3,
                    throughput_mbps: 260.0,
                    connected_users: 140,
                    traffic_load_pct: 32,
                    call_drop_rate_pct: 0.2,
                    resource_utilization_pct: 38,
                    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
                  })
                }
                className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <ShieldCheck size={14} />
                <span>Bangalore Tech Hub</span>
              </button>
            </div>
          </div>

          {/* Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleManualAction(false);
            }}
            className="space-y-5"
          >
            {/* Section 1: Identification & Location */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <MapPin size={14} className="text-blue-500" />
                  <span>1. Asset Identity & GPS Coordinates (Auto-Geolocated)</span>
                </h3>
                <span className="text-[11px] text-slate-400">
                  Telecom GPS coordinates locate the asset on the global map
                </span>
              </div>

              {/* Primary GPS & Asset Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-medium block mb-1">Asset ID *</label>
                  <input
                    type="text"
                    required
                    value={formData.asset_id}
                    onChange={(e) => handleInputChange('asset_id', e.target.value)}
                    placeholder="e.g. MH-PN-999"
                    className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-[#0f172a] border border-slate-300 dark:border-[#334155] focus:border-blue-500 text-slate-900 dark:text-slate-100 font-medium focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-medium block mb-1">Asset Type *</label>
                  <select
                    value={formData.asset_type}
                    onChange={(e) => handleInputChange('asset_type', e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-[#0f172a] border border-slate-300 dark:border-[#334155] focus:border-blue-500 text-slate-900 dark:text-slate-100 font-medium focus:outline-none"
                  >
                    <option value="Base Station">Base Station</option>
                    <option value="Cell Tower">Cell Tower</option>
                    <option value="Network Gateway">Network Gateway</option>
                    <option value="Router">Router</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-medium block mb-1">Latitude (GPS) *</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formData.latitude}
                    onChange={(e) => handleInputChange('latitude', parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 18.5204"
                    className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-[#0f172a] border border-blue-400/50 dark:border-blue-500/50 focus:border-blue-500 text-slate-900 dark:text-slate-100 font-mono font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-medium block mb-1">Longitude (GPS) *</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formData.longitude}
                    onChange={(e) => handleInputChange('longitude', parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 73.8567"
                    className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-[#0f172a] border border-blue-400/50 dark:border-blue-500/50 focus:border-blue-500 text-slate-900 dark:text-slate-100 font-mono font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-medium block mb-1">Timestamp</label>
                  <input
                    type="text"
                    value={formData.timestamp}
                    onChange={(e) => handleInputChange('timestamp', e.target.value)}
                    placeholder="YYYY-MM-DD HH:MM:SS"
                    className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-[#0f172a] border border-slate-300 dark:border-[#334155] focus:border-blue-500 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* Auto-Resolved Location Banner */}
              <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        GPS Auto-Located Location:
                      </span>
                      {isResolvingGeo && <RefreshCw size={12} className="animate-spin text-blue-500" />}
                    </div>
                    <div className="font-mono text-blue-600 dark:text-blue-400 font-bold mt-0.5">
                      {(showLocationOverride ? formData.city : (geoInfo?.city || formData.city)) || 'Detecting City...'}, {(showLocationOverride ? formData.country : (geoInfo?.country || formData.country)) || 'Detecting Country...'} ({(showLocationOverride ? formData.continent : (geoInfo?.continent || formData.continent)) || 'Detecting Continent...'})
                      {geoInfo?.distance_km != null && (
                        <span className="text-[11px] font-normal text-slate-500 ml-2 font-sans">
                          &bull; ~{geoInfo.distance_km} km to regional centroid
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                    Map Position Ready
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowLocationOverride(!showLocationOverride)}
                    className="text-[11px] text-slate-600 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 underline font-medium"
                  >
                    {showLocationOverride ? 'Hide Details' : 'View / Override Names'}
                  </button>
                </div>
              </div>

              {/* Collapsible / Optional Name Overrides */}
              {showLocationOverride && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="text-slate-500 dark:text-slate-400 font-medium block mb-1">City Hub</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      placeholder="e.g. Pune"
                      className="w-full p-2 rounded-lg bg-white dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 dark:text-slate-400 font-medium block mb-1">Country</label>
                    <input
                      type="text"
                      value={formData.country}
                      onChange={(e) => handleInputChange('country', e.target.value)}
                      placeholder="e.g. India"
                      className="w-full p-2 rounded-lg bg-white dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 dark:text-slate-400 font-medium block mb-1">Continent</label>
                    <select
                      value={formData.continent}
                      onChange={(e) => handleInputChange('continent', e.target.value)}
                      className="w-full p-2 rounded-lg bg-white dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs focus:outline-none"
                    >
                      <option value="Asia">Asia</option>
                      <option value="Europe">Europe</option>
                      <option value="North America">North America</option>
                      <option value="South America">South America</option>
                      <option value="Africa">Africa</option>
                      <option value="Oceania">Oceania</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-500 dark:text-slate-400 font-medium block mb-1">Region / State</label>
                    <input
                      type="text"
                      value={formData.region}
                      onChange={(e) => handleInputChange('region', e.target.value)}
                      placeholder="e.g. Maharashtra"
                      className="w-full p-2 rounded-lg bg-white dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: Health & Performance Metrics */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                2. Telemetry Parameters (8 Metrics)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-medium block mb-1">Latency (ms) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={formData.latency_ms}
                    onChange={(e) => handleInputChange('latency_ms', parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-[#0f172a] border border-slate-300 dark:border-[#334155] focus:border-blue-500 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-medium block mb-1">Packet Loss (%) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.packet_loss_pct}
                    onChange={(e) => handleInputChange('packet_loss_pct', parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-[#0f172a] border border-slate-300 dark:border-[#334155] focus:border-blue-500 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-medium block mb-1">Traffic Load (%) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={formData.traffic_load_pct}
                    onChange={(e) => handleInputChange('traffic_load_pct', parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-[#0f172a] border border-slate-300 dark:border-[#334155] focus:border-blue-500 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-medium block mb-1">Signal Strength (dBm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.signal_strength_dbm}
                    onChange={(e) => handleInputChange('signal_strength_dbm', parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-[#0f172a] border border-slate-300 dark:border-[#334155] focus:border-blue-500 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-medium block mb-1">Throughput (Mbps)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.throughput_mbps}
                    onChange={(e) => handleInputChange('throughput_mbps', parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-[#0f172a] border border-slate-300 dark:border-[#334155] focus:border-blue-500 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-medium block mb-1">Connected Users</label>
                  <input
                    type="number"
                    value={formData.connected_users}
                    onChange={(e) => handleInputChange('connected_users', parseInt(e.target.value) || 0)}
                    className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-[#0f172a] border border-slate-300 dark:border-[#334155] focus:border-blue-500 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-medium block mb-1">Call Drop Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.call_drop_rate_pct}
                    onChange={(e) => handleInputChange('call_drop_rate_pct', parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-[#0f172a] border border-slate-300 dark:border-[#334155] focus:border-blue-500 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-medium block mb-1">Resource Utilization (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.resource_utilization_pct}
                    onChange={(e) => handleInputChange('resource_utilization_pct', parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-[#0f172a] border border-slate-300 dark:border-[#334155] focus:border-blue-500 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Imputation Checkbox & Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-200 dark:border-[#334155]">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={manualImpute}
                  onChange={(e) => setManualImpute(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Impute missing values with training medians (backend)</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSubmitting || !isOnline}
                  onClick={() => handleManualAction(false)}
                  className="px-4 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs border border-slate-300 dark:border-slate-700 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <Eye size={14} />}
                  <span>Preview Prediction</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting || !isOnline}
                  onClick={() => handleManualAction(true)}
                  className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Submit & Save Record</span>
                </button>
              </div>
            </div>
          </form>

          {/* Validation Errors */}
          {manualErrors.length > 0 && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <XCircle size={16} />
                <span>Validation Failure:</span>
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                {manualErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Validation Warnings */}
          {manualWarnings.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle size={16} />
                <span>Validation Warnings:</span>
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                {manualWarnings.map((warn, i) => (
                  <li key={i}>{warn}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Prediction Result Display */}
          {previewResult && (
            <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getStatusStyle(previewResult.status).hex }}
                  />
                  <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    Backend Pipeline Results for {previewResult.asset_id}
                  </h4>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {persistSuccess ? (
                    <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 size={13} />
                      <span>Record Persisted to Database</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                      Preview Only (Not Persisted)
                    </span>
                  )}
                </div>
              </div>

              {/* Badges and Scores */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155]">
                  <span className="text-slate-500 dark:text-slate-400 block mb-1">SVM Risk Classification</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        previewResult.is_at_risk
                          ? 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30'
                          : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {previewResult.risk_label}
                    </span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      Score: {(previewResult.risk_score * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155]">
                  <span className="text-slate-500 dark:text-slate-400 block mb-1">DBSCAN Anomaly Detection</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        previewResult.is_anomaly
                          ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30'
                          : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {previewResult.is_anomaly ? 'Anomaly' : 'Normal Cluster'}
                    </span>
                    <span className="font-mono text-slate-500 text-[11px]">
                      (Cluster: {previewResult.dbscan_cluster})
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155]">
                  <span className="text-slate-500 dark:text-slate-400 block mb-1">System Health Status</span>
                  <span
                    className="inline-block px-2.5 py-0.5 rounded text-xs font-bold uppercase"
                    style={{
                      color: getStatusStyle(previewResult.status).hex,
                      backgroundColor: `${getStatusStyle(previewResult.status).hex}20`,
                    }}
                  >
                    {previewResult.status}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155]">
                  <span className="text-slate-500 dark:text-slate-400 block mb-1">Model Version</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300 text-xs">
                    {previewResult.model_version || '2.0.0'}
                  </span>
                </div>
              </div>

              {/* Threshold breaches */}
              {previewResult.threshold_breaches?.length > 0 ? (
                <div className="space-y-1.5 text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Threshold breaches (rule-based):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {previewResult.threshold_breaches.map((b, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-mono text-[11px]"
                      >
                        {b.metric} {b.operator} {b.limit} (actual: {b.value})
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  ✓ No threshold breaches detected against configured operational limits.
                </div>
              )}

              {persistSuccess && (
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => navigate(`/map?asset=${previewResult.asset_id}`)}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5"
                  >
                    <MapPin size={14} />
                    <span>Locate on Map →</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* CSV INGESTION TAB                                         */}
      {/* ========================================================= */}
      {activeTab === 'csv' && (
        <div className="space-y-6">
          <div className="p-8 rounded-xl bg-slate-50 dark:bg-[#0f172a] border-2 border-dashed border-slate-300 dark:border-[#334155] hover:border-blue-500 transition-all text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-500">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Select Telemetry CSV File
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-lg mx-auto">
                Upload CSV file with asset identifiers and telemetry readings. Header aliases are automatically supported by the backend ingestion engine.
              </p>
            </div>

            <div className="flex flex-col items-center gap-3">
              <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs cursor-pointer transition-colors shadow-sm">
                <Upload size={16} />
                <span>{csvFile ? 'Change File' : 'Choose CSV File'}</span>
                <input
                  type="file"
                  accept=".csv, text/csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setCsvFile(file);
                    setDryRunReport(null);
                    setConfirmedReport(null);
                    setCsvError(null);
                  }}
                  className="hidden"
                />
              </label>

              {csvFile && (
                <div className="text-xs text-blue-500 font-medium">
                  Selected: <strong>{csvFile.name}</strong> ({(csvFile.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>
          </div>

          {/* Options & Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={csvImpute}
                onChange={(e) => setCsvImpute(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Impute missing values with training medians (impute=true)</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!csvFile || isDryRunning || !isOnline}
                onClick={handleCsvDryRun}
                className="px-4 py-2.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isDryRunning ? <RefreshCw size={14} className="animate-spin" /> : <Eye size={14} />}
                <span>Step 1: Run Dry-Run Validation</span>
              </button>

              <button
                type="button"
                disabled={!csvFile || !dryRunReport || isConfirming || !isOnline}
                onClick={handleCsvConfirm}
                className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isConfirming ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                <span>Step 2: Confirm & Ingest Records</span>
              </button>
            </div>
          </div>

          {/* CSV Error */}
          {csvError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <XCircle size={16} className="flex-shrink-0" />
              <span>{csvError}</span>
            </div>
          )}

          {/* Ingestion Report (Dry-Run or Confirmed) */}
          {(dryRunReport || confirmedReport) && (
            <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={18} className="text-blue-500" />
                  <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    Ingestion Report: {(confirmedReport || dryRunReport)?.filename}
                  </h4>
                </div>
                <span
                  className={`px-2.5 py-1 rounded text-xs font-semibold ${
                    confirmedReport
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {confirmedReport ? 'Import Confirmed (Saved in Database)' : 'Dry-Run Preview (No DB Changes)'}
                </span>
              </div>

              {/* Counters Grid */}
              {(() => {
                const rep = confirmedReport || dryRunReport;
                if (!rep) return null;
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                      <div className="p-3 rounded-lg bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155]">
                        <span className="text-slate-500 text-[11px] block">Total Rows</span>
                        <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          {rep.rows_total}
                        </span>
                      </div>
                      <div className="p-3 rounded-lg bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155]">
                        <span className="text-emerald-600 dark:text-emerald-400 text-[11px] block">Accepted</span>
                        <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                          {rep.accepted}
                        </span>
                      </div>
                      <div className="p-3 rounded-lg bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155]">
                        <span className="text-red-600 dark:text-red-400 text-[11px] block">Rejected</span>
                        <span className="text-lg font-bold text-red-600 dark:text-red-400">
                          {rep.rejected}
                        </span>
                      </div>
                      <div className="p-3 rounded-lg bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155]">
                        <span className="text-blue-500 text-[11px] block">Imputed</span>
                        <span className="text-lg font-bold text-blue-500">{rep.imputed}</span>
                      </div>
                      <div className="p-3 rounded-lg bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155]">
                        <span className="text-slate-500 text-[11px] block">Updated</span>
                        <span className="text-lg font-bold text-slate-700 dark:text-slate-300">
                          {rep.updated}
                        </span>
                      </div>
                      <div className="p-3 rounded-lg bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155]">
                        <span className="text-amber-500 text-[11px] block">Duplicates</span>
                        <span className="text-lg font-bold text-amber-500">
                          {rep.duplicates_in_file}
                        </span>
                      </div>
                    </div>

                    {/* Risk Summary */}
                    {rep.risk_summary && (
                      <div className="p-3 rounded-lg bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] text-xs space-y-2">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Inferred Risk & Anomaly Summary:
                        </span>
                        <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                          <span className="text-red-500 font-semibold">
                            At Risk: {rep.risk_summary.at_risk}
                          </span>
                          <span className="text-purple-500 font-semibold">
                            Anomalies: {rep.risk_summary.anomalies}
                          </span>
                          <span className="text-slate-400">|</span>
                          <span className="text-emerald-500">
                            Green: {rep.risk_summary.status_counts?.green || 0}
                          </span>
                          <span className="text-yellow-500">
                            Yellow: {rep.risk_summary.status_counts?.yellow || 0}
                          </span>
                          <span className="text-purple-500">
                            Purple: {rep.risk_summary.status_counts?.purple || 0}
                          </span>
                          <span className="text-red-500">
                            Red: {rep.risk_summary.status_counts?.red || 0}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Rejected Rows & Download button */}
                    {rep.rejected_rows && rep.rejected_rows.length > 0 && (
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                            <AlertTriangle size={15} />
                            <span>{rep.rejected_rows.length} rows rejected during validation</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDownloadRejectedRows(rep.rejected_rows)}
                            className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white font-semibold text-[11px] transition-colors flex items-center gap-1"
                          >
                            <Download size={13} />
                            <span>Download Rejected Rows (CSV)</span>
                          </button>
                        </div>

                        <div className="max-h-36 overflow-y-auto space-y-1 text-[11px] font-mono text-red-700 dark:text-red-300">
                          {rep.rejected_rows.slice(0, 10).map((r, i) => (
                            <div key={i} className="truncate">
                              Row {r.row}: {r.reasons.join('; ')}
                            </div>
                          ))}
                          {rep.rejected_rows.length > 10 && (
                            <div className="text-slate-400 italic">
                              ... and {rep.rejected_rows.length - 10} more rows (download CSV for full list)
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* INGESTED RECORDS TABLE                                    */}
      {/* ========================================================= */}
      <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-[#334155]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
              Ingested Records Inventory ({inventoryData?.total || 0} assets)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Source of truth records stored in the SQLite backend database.
            </p>
          </div>

          {/* Filter & Refresh */}
          <div className="flex items-center gap-2">
            <select
              value={inventorySource}
              onChange={(e) => {
                setInventorySource(e.target.value);
                setInventoryPage(1);
              }}
              className="p-1.5 text-xs rounded-lg bg-slate-50 dark:bg-[#0f172a] border border-slate-300 dark:border-[#334155] text-slate-900 dark:text-slate-100"
            >
              <option value="manual">Manual entries</option>
              <option value="csv">CSV imports</option>
              <option value="seed">Seed dataset</option>
              <option value="all">All sources</option>
            </select>

            <button
              onClick={() => loadInventory()}
              disabled={inventoryLoading}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition-colors"
              title="Refresh inventory"
            >
              <RefreshCw size={13} className={inventoryLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#334155]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#334155] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#0f172a]">
                <th className="p-3 font-semibold">Asset ID</th>
                <th className="p-3 font-semibold">Type</th>
                <th className="p-3 font-semibold">Location</th>
                <th className="p-3 font-semibold">Latency</th>
                <th className="p-3 font-semibold">Packet Loss</th>
                <th className="p-3 font-semibold">Traffic Load</th>
                <th className="p-3 font-semibold">Risk Classification</th>
                <th className="p-3 font-semibold">DBSCAN Anomaly</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#334155] bg-white dark:bg-slate-900">
              {inventoryLoading ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500">
                    <RefreshCw size={18} className="animate-spin inline-block mr-2" />
                    Loading inventory records...
                  </td>
                </tr>
              ) : !inventoryData || inventoryData.items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500">
                    No records found for source &quot;{inventorySource}&quot;. Submit a record or upload a CSV file above.
                  </td>
                </tr>
              ) : (
                inventoryData.items.map((asset) => (
                  <tr key={asset.asset_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                    <td className="p-3 font-bold text-blue-500 font-mono">{asset.asset_id}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">{asset.asset_type}</td>
                    <td className="p-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      {asset.city ? `${asset.city}, ` : ''}{asset.country || 'N/A'}
                    </td>
                    <td className="p-3 font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {asset.latency_ms.toFixed(1)} ms
                    </td>
                    <td className="p-3 font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {asset.packet_loss_pct.toFixed(1)}%
                    </td>
                    <td className="p-3 font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {asset.traffic_load_pct.toFixed(1)}%
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          asset.is_at_risk
                            ? 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30'
                            : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {asset.risk_label} ({(asset.risk_score * 100).toFixed(0)}%)
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          asset.is_anomaly
                            ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30'
                            : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {asset.is_anomaly ? 'Anomaly' : 'Inlier'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                        style={{
                          color: getStatusStyle(asset.status).hex,
                          backgroundColor: `${getStatusStyle(asset.status).hex}20`,
                        }}
                      >
                        {asset.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => navigate(`/map?asset=${encodeURIComponent(asset.asset_id)}`)}
                        className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-700 dark:text-slate-300 font-medium text-[11px] transition-colors border border-slate-300 dark:border-slate-700 flex items-center gap-1 ml-auto"
                      >
                        <MapPin size={12} />
                        <span>Locate</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paging controls */}
        {inventoryData && inventoryData.total > 10 && (
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2">
            <span>
              Showing {((inventoryPage - 1) * 10) + 1} to {Math.min(inventoryPage * 10, inventoryData.total)} of{' '}
              {inventoryData.total} assets
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={inventoryPage <= 1}
                onClick={() => setInventoryPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 disabled:opacity-40 flex items-center gap-1"
              >
                <ChevronLeft size={14} />
                <span>Previous</span>
              </button>
              <span>
                Page {inventoryPage} of {Math.ceil(inventoryData.total / 10)}
              </span>
              <button
                disabled={inventoryPage >= Math.ceil(inventoryData.total / 10)}
                onClick={() => setInventoryPage((p) => p + 1)}
                className="px-3 py-1.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 disabled:opacity-40 flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
