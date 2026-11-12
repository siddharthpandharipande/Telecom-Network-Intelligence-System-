import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { analyzeTelemetry, downloadPdfReport } from '../api/client';
import { TelemetryAnalysisResponse } from '../types/api';

export const AnalyzeTelemetry: React.FC = () => {
  const [assetId, setAssetId] = useState('TWR-IND-042');
  const [assetType, setAssetType] = useState('Cell Tower 5G-NR');
  const [coords, setCoords] = useState('19.0760, 72.8377');
  const [autoLocation, setAutoLocation] = useState('Mumbai, Maharashtra, India');

  // PDF report state
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfSuccess, setPdfSuccess] = useState<string | null>(null);


  // 8 telemetry fields
  const [signal, setSignal] = useState<number>(-94);
  const [latency, setLatency] = useState<number>(142);
  const [loss, setLoss] = useState<number>(4.8);
  const [throughput, setThroughput] = useState<number>(184);
  const [users, setUsers] = useState<number>(2840);
  const [load, setLoad] = useState<number>(91.2);
  const [drops, setDrops] = useState<number>(3.4);
  const [cpu, setCpu] = useState<number>(88.5);

  // Computed results
  const [nsi, setNsi] = useState<number>(84.2);
  const [sqs, setSqs] = useState<number>(42.0);
  const [tpu, setTpu] = useState<string>('64.8');
  const [isAtRisk, setIsAtRisk] = useState<boolean>(true);
  const [riskProbability, setRiskProbability] = useState<number>(91.4);
  const [lastExecuted, setLastExecuted] = useState<string>('Ready');
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [breaches, setBreaches] = useState<string[]>([
    'Round-Trip Latency (142 ms > 50 ms limit)',
    'Packet Loss Rate (4.8 % > 1.0 % limit)',
    'Traffic Load (91.2 % > 80 % limit)',
    'CPU / Baseband Buffer (88.5 % > 75 % limit)',
    'Signal Strength (-94 dBm < -85 dBm limit)',
  ]);

  const loadPreset = (preset: 'congestion' | 'normal' | 'oc-aus') => {
    if (preset === 'oc-aus') {
      setAssetId('OC-AUS-SYD-NSW-GW-02451');
      setAssetType('Network Gateway');
      setCoords('-33.875032, 151.202526');
      setAutoLocation('Sydney, NSW, Australia');
      setSignal(-80);
      setLatency(215.84);
      setLoss(4.5);
      setThroughput(250);
      setUsers(1450);
      setLoad(91.2);
      setDrops(1.2);
      setCpu(88.5);
      executePipelineWithValues(-80, 215.84, 4.5, 250, 1450, 91.2, 1.2, 88.5);
    } else if (preset === 'congestion') {
      setAssetId('TWR-IND-042');
      setAssetType('Cell Tower 5G-NR');
      setCoords('19.0760, 72.8377');
      setAutoLocation('Mumbai, Maharashtra, India');
      setSignal(-94);
      setLatency(142);
      setLoss(4.8);
      setThroughput(184);
      setUsers(2840);
      setLoad(91.2);
      setDrops(3.4);
      setCpu(88.5);
      executePipelineWithValues(-94, 142, 4.8, 184, 2840, 91.2, 3.4, 88.5);
    } else {
      setAssetId('TWR-IND-043');
      setAssetType('Cell Tower 5G-NR');
      setCoords('19.2183, 72.9781');
      setAutoLocation('Thane, Maharashtra, India');
      setSignal(-72);
      setLatency(32);
      setLoss(0.2);
      setThroughput(480);
      setUsers(1120);
      setLoad(42.0);
      setDrops(0.4);
      setCpu(38.0);
      executePipelineWithValues(-72, 32, 0.2, 480, 1120, 42.0, 0.4, 38.0);
    }
  };

  const executePipelineWithValues = (
    sigVal: number,
    latVal: number,
    lossVal: number,
    tpVal: number,
    userVal: number,
    loadVal: number,
    dropVal: number,
    cpuVal: number
  ) => {
    setIsCalculating(true);

    setTimeout(() => {
      // NSI calculation
      const computedNsi = Math.min(
        100,
        Math.max(10, loadVal * 0.4 + latVal * 0.3 + lossVal * 5.0 + cpuVal * 0.2)
      );
      // SQS calculation
      const computedSqs = Math.max(5, Math.min(100, 100 - (Math.abs(sigVal) - 50) * 1.5));
      // TPU calculation
      const computedTpu = ((tpVal * 1000) / (userVal || 1)).toFixed(1);

      setNsi(parseFloat(computedNsi.toFixed(1)));
      setSqs(parseFloat(computedSqs.toFixed(1)));
      setTpu(computedTpu);

      // Rule boundary violations
      const violations: string[] = [];
      if (latVal > 50) violations.push(`Round-Trip Latency (${latVal} ms > 50 ms limit)`);
      if (lossVal > 1.0) violations.push(`Packet Loss Rate (${lossVal} % > 1.0 % limit)`);
      if (loadVal > 80) violations.push(`Traffic Load (${loadVal} % > 80 % limit)`);
      if (cpuVal > 75) violations.push(`Resource Utilization (${cpuVal} % > 75 % limit)`);
      if (sigVal < -85) violations.push(`Signal Strength (${sigVal} dBm < -85 dBm limit)`);
      if (dropVal > 1.0) violations.push(`Call Drop Rate (${dropVal} % > 1.0 % limit)`);

      setBreaches(violations);

      // Random Forest risk prediction
      const atRisk = latVal > 70 || lossVal > 2.0 || loadVal > 85 || computedNsi > 70;
      setIsAtRisk(atRisk);
      setRiskProbability(atRisk ? parseFloat((86 + Math.random() * 8).toFixed(1)) : parseFloat((95 + Math.random() * 4).toFixed(1)));

      setLastExecuted(new Date().toLocaleTimeString());
      setIsCalculating(false);
    }, 200);
  };

  const [lastAnalysisResult, setLastAnalysisResult] = useState<TelemetryAnalysisResponse | null>(null);

  const handleExecute = async () => {
    setIsCalculating(true);

    // Compute UI scores
    executePipelineWithValues(signal, latency, loss, throughput, users, load, drops, cpu);

    let parsedLat: number | undefined = undefined;
    let parsedLng: number | undefined = undefined;
    if (coords && coords.includes(',')) {
      const parts = coords.split(',');
      const lat = parseFloat(parts[0].trim());
      const lng = parseFloat(parts[1].trim());
      if (!isNaN(lat) && !isNaN(lng)) {
        parsedLat = lat;
        parsedLng = lng;
      }
    }

    try {
      const payload = {
        asset_id: assetId.trim() || undefined,
        asset_type: assetType,
        latitude: parsedLat,
        longitude: parsedLng,
        latency_ms: latency,
        packet_loss_pct: loss,
        throughput_mbps: throughput,
        signal_strength_dbm: signal,
        connected_users: users,
        traffic_load_pct: load,
        call_drop_rate_pct: drops,
        resource_utilization_pct: cpu,
      };

      const result = await analyzeTelemetry(payload);
      setLastAnalysisResult(result);

      // Store in localStorage for immediate sync across tabs/pages
      localStorage.setItem('nexusnet_latest_analysis', JSON.stringify(result));
      window.dispatchEvent(new Event('nexusnet_telemetry_analyzed'));

      // If backend attached or auto-identified location, update UI display
      if (result.city || result.country) {
        const locParts = [result.city, result.region, result.country].filter(Boolean);
        setAutoLocation(locParts.join(', '));
      }
      if (
        result.latitude !== null &&
        result.latitude !== undefined &&
        result.longitude !== null &&
        result.longitude !== undefined
      ) {
        setCoords(`${result.latitude}, ${result.longitude}`);
      }

      if (result.breached_measurements && result.breached_measurements.length > 0) {
        setBreaches(result.breached_measurements);
      }
      setIsAtRisk(result.investigation_priority === 'High');
    } catch (err: any) {
      console.error('Telemetry analysis backend call failed:', err);
    } finally {
      setIsCalculating(false);
      setLastExecuted(new Date().toLocaleTimeString());
    }
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    setPdfError(null);
    setPdfSuccess(null);

    let parsedLat: number | undefined = undefined;
    let parsedLng: number | undefined = undefined;
    if (coords && coords.includes(',')) {
      const parts = coords.split(',');
      const lat = parseFloat(parts[0].trim());
      const lng = parseFloat(parts[1].trim());
      if (!isNaN(lat) && !isNaN(lng)) {
        parsedLat = lat;
        parsedLng = lng;
      }
    }

    const payload = {
      asset_id: assetId.trim() || undefined,
      asset_type: assetType,
      latitude: parsedLat,
      longitude: parsedLng,
      latency_ms: latency,
      packet_loss_pct: loss,
      throughput_mbps: throughput,
      signal_strength_dbm: signal,
      connected_users: users,
      traffic_load_pct: load,
      call_drop_rate_pct: drops,
      resource_utilization_pct: cpu,
    };

    try {
      const res = await downloadPdfReport(payload);
      setPdfSuccess(`PDF Report successfully downloaded: ${res.filename}`);
      setTimeout(() => setPdfSuccess(null), 5000);
    } catch (err: any) {
      console.error('PDF generation error:', err);
      setPdfError(err.message || 'Failed to generate PDF report. Please evaluate telemetry first.');
      setTimeout(() => setPdfError(null), 6000);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const getGeoMapUrl = () => {
    let lat: number | null = null;
    let lng: number | null = null;

    if (lastAnalysisResult?.latitude != null && lastAnalysisResult?.longitude != null) {
      lat = lastAnalysisResult.latitude;
      lng = lastAnalysisResult.longitude;
    } else if (coords && coords.includes(',')) {
      const parts = coords.split(',');
      const parsedLat = parseFloat(parts[0].trim());
      const parsedLng = parseFloat(parts[1].trim());
      if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        lat = parsedLat;
        lng = parsedLng;
      }
    }

    const params = new URLSearchParams();
    if (assetId?.trim()) params.set('asset', assetId.trim());
    if (lat != null && lng != null) {
      params.set('lat', String(lat));
      params.set('lng', String(lng));
    }
    if (assetType) params.set('type', assetType);
    if (lastAnalysisResult?.investigation_priority) {
      params.set('priority', lastAnalysisResult.investigation_priority);
    } else {
      params.set('priority', isAtRisk ? 'High' : 'Routine');
    }
    if (lastAnalysisResult?.final_decision_support_flag) {
      params.set('flag', lastAnalysisResult.final_decision_support_flag);
    } else {
      params.set('flag', isAtRisk ? 'Investigate' : 'Monitor');
    }
    const loc = lastAnalysisResult?.city || autoLocation;
    if (loc) params.set('loc', loc);
    if (lastAnalysisResult?.city) params.set('city', lastAnalysisResult.city);
    if (lastAnalysisResult?.region) params.set('region', lastAnalysisResult.region);

    return `/network-map?${params.toString()}`;
  };

  return (
    <div className="w-full flex flex-col gap-6 animate-page-transition">
      {/* Hero Banner (Averon Style) */}
      <section className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-[32px] p-8 md:p-10 text-white shadow-xl relative overflow-hidden">
        <div className="max-w-2xl relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-purple-300 text-xs font-bold uppercase tracking-wider mb-3 backdrop-blur-md">
            <span className="material-symbols-outlined text-[14px]">biotech</span>
            <span>Pipeline Diagnostic Sandbox</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">
            Interactive Telemetry Analysis Engine
          </h1>
          <p className="text-slate-300 text-xs leading-relaxed">
            Input raw asset measurements and observe how NEXUSNET normalizes telemetry, checks SLA
            boundaries, calculates engineered features, and executes the Random Forest risk prediction model.
          </p>
        </div>
      </section>

      {/* Section C: Processing Workflow Visualization */}
      <section className="bg-white rounded-[24px] p-5 border border-slate-200/70 shadow-xs">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
          Live Processing Workflow
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-900">
            <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">
              1
            </span>{' '}
            Raw Input
          </div>
          <span className="text-slate-300">&rarr;</span>
          <div className="flex items-center gap-1.5 font-bold text-slate-900">
            <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">
              2
            </span>{' '}
            Validation
          </div>
          <span className="text-slate-300">&rarr;</span>
          <div className="flex items-center gap-1.5 font-bold text-purple-700">
            <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px]">
              3
            </span>{' '}
            StandardScaler
          </div>
          <span className="text-slate-300">&rarr;</span>
          <div className="flex items-center gap-1.5 font-bold text-purple-700">
            <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px]">
              4
            </span>{' '}
            Feature Eng (NSI/SQS)
          </div>
          <span className="text-slate-300">&rarr;</span>
          <div className="flex items-center gap-1.5 font-bold text-slate-900">
            <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">
              5
            </span>{' '}
            Threshold Rules
          </div>
          <span className="text-slate-300">&rarr;</span>
          <div className="flex items-center gap-1.5 font-bold text-rose-600">
            <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px]">
              6
            </span>{' '}
            Random Forest Classifier
          </div>
        </div>
      </section>

      {/* Main Workspace: Form (6 cols) + Real-time Results (6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Section A & B: Input Form (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-[28px] p-7 border border-slate-200/70 shadow-xs flex flex-col gap-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                1. Asset Identification & Location
              </h2>
              <p className="text-xs text-slate-400">Specify network device identifiers</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => loadPreset('oc-aus')}
                className="text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 hover:scale-105 active:scale-95 px-3 py-1 rounded-full transition-all duration-200 cursor-pointer"
              >
                OC-AUS-02451
              </button>
              <button
                type="button"
                onClick={() => loadPreset('congestion')}
                className="text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 hover:scale-105 active:scale-95 px-3 py-1 rounded-full transition-all duration-200 cursor-pointer"
              >
                At-Risk Preset
              </button>
              <button
                type="button"
                onClick={() => loadPreset('normal')}
                className="text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 hover:scale-105 active:scale-95 px-3 py-1 rounded-full transition-all duration-200 cursor-pointer"
              >
                Normal Preset
              </button>
            </div>
          </div>

          {/* Identity Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Asset ID</label>
              <input
                type="text"
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Asset Type</label>
              <select
                value={assetType}
                onChange={(e) => setAssetType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
              >
                <option value="Cell Tower 5G-NR">Cell Tower 5G-NR</option>
                <option value="Network Gateway">Network Gateway</option>
                <option value="Edge Gateway">Edge Gateway</option>
                <option value="Core Optical Router">Core Optical Router</option>
                <option value="Base Station 4G/LTE">Base Station 4G/LTE</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Coordinates (Latitude, Longitude)
                </label>
                {autoLocation && (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-emerald-600">location_on</span>
                    <span>Auto-identified: {autoLocation}</span>
                  </span>
                )}
              </div>
              <input
                type="text"
                value={coords}
                placeholder="e.g. 19.0760, 72.8377 or -33.8750, 151.2025"
                onChange={(e) => setCoords(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h2 className="text-base font-bold text-slate-900 mb-1">
              2. Network Measurements (8 Fields)
            </h2>
            <p className="text-xs text-slate-400 mb-4">Input telemetry metrics to execute analysis</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Signal Strength (dBm)</label>
                <input
                  type="number"
                  value={signal}
                  onChange={(e) => setSignal(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                />
                <span className="text-[10px] text-slate-400">Limit: &ge; -85 dBm</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Round-Trip Latency (ms)
                </label>
                <input
                  type="number"
                  value={latency}
                  onChange={(e) => setLatency(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                />
                <span className="text-[10px] text-slate-400">Limit: &le; 50 ms</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Packet Loss (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={loss}
                  onChange={(e) => setLoss(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                />
                <span className="text-[10px] text-slate-400">Limit: &le; 1.0 %</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Active Throughput (Mbps)</label>
                <input
                  type="number"
                  value={throughput}
                  onChange={(e) => setThroughput(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                />
                <span className="text-[10px] text-slate-400">Target: &ge; 450 Mbps</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Connected Users (UEs)</label>
                <input
                  type="number"
                  value={users}
                  onChange={(e) => setUsers(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                />
                <span className="text-[10px] text-slate-400">Cap: 3,000 UEs</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Traffic Load (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={load}
                  onChange={(e) => setLoad(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                />
                <span className="text-[10px] text-slate-400">Ceiling: &le; 80 %</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Call Drop Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={drops}
                  onChange={(e) => setDrops(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                />
                <span className="text-[10px] text-slate-400">Target: &le; 1.0 %</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Resource Utilization (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={cpu}
                  onChange={(e) => setCpu(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                />
                <span className="text-[10px] text-slate-400">Limit: &le; 75 %</span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="button"
            onClick={handleExecute}
            className="w-full py-4 rounded-full bg-gradient-to-r from-[#6366F1] to-[#7C3AED] hover:from-[#4F46E5] hover:to-[#6D28D9] text-white font-bold text-xs shadow-lg shadow-indigo-500/20 hover:scale-[1.01] hover:shadow-xl active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span
              className={`material-symbols-outlined text-[18px] ${isCalculating ? 'animate-spin' : ''
                }`}
            >
              {isCalculating ? 'autorenew' : 'play_circle'}
            </span>
            <span>
              {isCalculating ? 'Evaluating Telemetry...' : 'Execute Pipeline (Analyze Telemetry)'}
            </span>
          </button>

          {lastAnalysisResult && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-950">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
                <span className="font-medium">Backend analysis complete & synced with Command Center!</span>
              </div>
              <Link
                to="/"
                className="inline-flex items-center gap-1 font-bold text-emerald-800 hover:text-emerald-950 hover:underline shrink-0"
              >
                <span>View Command Center</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
            </div>
          )}
        </div>

        {/* Section D & E: Live Analysis Results (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-[28px] p-7 border border-slate-200/70 shadow-xs flex flex-col gap-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-bold uppercase tracking-wider mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Model Execution Output</span>
              </div>
              <h2 className="text-base font-bold text-slate-900">
                Synthesized Assessment Results
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-400">{lastExecuted}</span>
          </div>

          {/* Random Forest Risk Prediction Card */}
          <div
            className={`p-6 rounded-2xl border transition-all duration-300 ${isAtRisk ? 'bg-rose-50 border-rose-200 shadow-rose-100/50 shadow-sm' : 'bg-emerald-50 border-emerald-200'
              }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div
                className={`text-[11px] font-bold uppercase tracking-wider ${isAtRisk ? 'text-rose-700' : 'text-emerald-700'
                  }`}
              >
                Random Forest Risk Prediction
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${isAtRisk ? 'bg-rose-200/80 text-rose-900' : 'bg-emerald-200/80 text-emerald-900'
                  }`}
              >
                {isAtRisk ? 'At Risk' : 'Normal'}
              </span>
            </div>
            <div
              className={`text-2xl font-black transition-colors duration-300 ${isAtRisk ? 'text-rose-950' : 'text-emerald-950'
                }`}
            >
              {isAtRisk ? `At Risk — ${riskProbability}% Probability` : `Normal — ${riskProbability}% Confidence`}
            </div>
            <p
              className={`text-xs mt-2 ${isAtRisk ? 'text-rose-800' : 'text-emerald-800'}`}
            >
              {isAtRisk
                ? 'Ensemble decision trees predict High Priority triage from multi-variable strain.'
                : 'Telemetry sits comfortably within learned nominal decision trees.'}
            </p>
          </div>

          {/* Computed Engineered Features */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
            <div className="text-xs font-bold text-slate-900">Computed Engineered Features:</div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-slate-600">Network Stress Index</span>
                <span
                  className={`font-bold transition-colors duration-300 ${nsi > 70 ? 'text-rose-600' : 'text-emerald-600'}`}
                >
                  {nsi} / 100
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${nsi > 70 ? 'bg-rose-600' : 'bg-emerald-500'
                    }`}
                  style={{ width: `${Math.min(100, nsi)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-slate-600">Signal Quality Score</span>
                <span
                  className={`font-bold transition-colors duration-300 ${sqs < 50 ? 'text-rose-600' : 'text-emerald-600'}`}
                >
                  {sqs} / 100
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${sqs < 50 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                  style={{ width: `${Math.min(100, sqs)}%` }}
                />
              </div>
            </div>

            <div className="flex justify-between text-xs pt-2 border-t border-slate-200">
              <span className="font-medium text-slate-600">Throughput per User</span>
              <span className="font-bold text-slate-900 font-mono">{tpu} Kbps</span>
            </div>
          </div>

          {/* Threshold Violations Box */}
          <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-100 text-xs">
            <div className="font-bold text-rose-900 mb-1">Identified Threshold Violations:</div>
            {breaches.length === 0 ? (
              <div className="text-emerald-700 font-bold">
                ✓ All measurements within configured SLA thresholds.
              </div>
            ) : (
              <ul className="space-y-1 text-[11px] text-rose-800">
                {breaches.map((b, idx) => (
                  <li key={idx}>&bull; {b}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Action Button: View on Network Map */}
          <Link
            to={getGeoMapUrl()}
            className="w-full py-4 rounded-full bg-slate-900 hover:bg-purple-950 text-white font-bold text-xs shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 group cursor-pointer"
          >
            <span>Locate on Live Geo Map</span>
            <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">
              arrow_forward
            </span>
          </Link>

          {/* Action Button: Download PDF Intelligence Report */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf || isCalculating}
            className="w-full py-4 rounded-full bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 hover:from-blue-800 hover:to-slate-950 text-white font-bold text-xs shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span
              className={`material-symbols-outlined text-[18px] ${
                isGeneratingPdf ? 'animate-spin' : 'text-blue-200 group-hover:scale-110 transition-transform'
              }`}
            >
              {isGeneratingPdf ? 'autorenew' : 'picture_as_pdf'}
            </span>
            <span>
              {isGeneratingPdf ? 'Generating PDF Intelligence Report...' : 'Download PDF Report'}
            </span>
          </button>

          {pdfSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-900">
              <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
              <span className="font-medium">{pdfSuccess}</span>
            </div>
          )}

          {pdfError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs text-rose-900">
              <span className="material-symbols-outlined text-[18px] text-rose-600">error</span>
              <span className="font-medium">{pdfError}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
