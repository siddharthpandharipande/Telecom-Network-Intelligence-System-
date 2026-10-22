import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  NetworkCell,
  NetworkAsset,
  NetworkLink,
  Alert,
  Incident,
  TelemetryFormInput,
  AssetStatus,
} from '../types/telecom';
import {
  Reading,
  Incident as ApiIncident,
  StatsOverview,
} from '../types/api';
import {
  getAssets,
  getIncidents,
  getStatsOverview,
  predictRecord,
  applyIncidentAction,
} from '../api/client';

export function readingToNetworkCell(r: Reading): NetworkCell {
  const statusMap: Record<string, AssetStatus> = {
    red: 'critical',
    purple: 'anomaly',
    yellow: 'warning',
    green: 'healthy',
  };

  const mainFactor =
    r.threshold_breaches && r.threshold_breaches.length > 0
      ? r.threshold_breaches[0].message
      : r.is_at_risk
      ? 'SLA Operational Stress'
      : r.is_anomaly
      ? 'Multivariate Density Outlier'
      : 'Optimal Baseline Telemetry';

  return {
    id: r.asset_id,
    name: `${r.city || r.region || 'Node'} ${r.asset_type.toUpperCase()}`,
    assetType: (r.asset_type.toLowerCase() as any) || 'cell',
    region: r.region || r.continent || 'Global',
    city: r.city || '',
    lat: r.latitude || 0,
    lng: r.longitude || 0,
    users: r.connected_users,
    latency: r.latency_ms,
    packetLoss: r.packet_loss_pct,
    trafficLoad: r.traffic_load_pct,
    throughput: r.throughput_mbps,
    signalStrength: r.signal_strength_dbm,
    callDropRate: r.call_drop_rate_pct,
    resourceUtil: r.resource_utilization_pct,
    timestamp: r.timestamp,
    networkAvailability: r.is_at_risk ? 94.2 : 99.8,
    status: statusMap[r.status] || 'healthy',
    svmRiskScore: Math.round(r.risk_score * 100),
    svmRiskCategory: r.risk_label,
    svmMainFactor: mainFactor,
    dbscanClassification: r.is_anomaly ? 'Anomaly' : 'Normal',
    dbscanAnomalyScore: parseFloat(r.nearest_core_distance.toFixed(3)),
    lastUpdated: r.timestamp,
    isCompanyIngested: r.source !== 'seed',
  };
}

export function apiIncidentToUiIncident(inc: ApiIncident): Incident {
  const timeStr = new Date(inc.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return {
    id: String(inc.id),
    severity: inc.severity.toUpperCase() as any,
    assetId: inc.asset_id,
    region: 'NOC Region',
    detectedTime: timeStr,
    detectionSource: inc.source === 'auto' ? 'Automated SLA Monitor' : 'Manual Dispatch',
    supportingDetection: 'Backend Pipeline Audit',
    status: inc.status.toUpperCase() as any,
    assignedOperator: inc.assignee || undefined,
    timeline: (inc.events || []).map((e) => ({
      time: new Date(e.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      event: `${e.action.toUpperCase()}: ${
        e.note || (e.from_status ? `Transition from ${e.from_status} to ${e.to_status}` : 'Event recorded')
      }`,
      type: e.action === 'escalate' ? 'critical' : e.action === 'resolve' ? 'info' : 'action',
    })),
  };
}

interface TelemetryContextType {
  cells: NetworkCell[];
  assets: NetworkAsset[];
  links: NetworkLink[];
  alerts: Alert[];
  incidents: Incident[];
  stats: StatsOverview | null;
  isLoading: boolean;
  error: string | null;
  selectedCell: NetworkCell | null;
  setSelectedCell: (cell: NetworkCell | null) => void;
  submittedCell: NetworkCell | null;
  submittedState: 'idle' | 'submitted' | 'analyzed';
  activeWorkflowStep: number;
  setActiveWorkflowStep: (step: number) => void;
  isLive: boolean;
  setIsLive: (live: boolean) => void;
  lastTelemetryTime: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  refreshData: () => Promise<void>;
  addAlert: (alert: Alert) => void;
  dismissAlert: (alertId: string) => void;
  clearAllAlerts: () => void;
  acknowledgeIncident: (id: string) => Promise<void>;
  assignIncident: (id: string, operator: string) => Promise<void>;
  investigateIncident: (id: string) => Promise<void>;
  resolveIncident: (id: string) => Promise<void>;
  escalateIncident: (id: string) => Promise<void>;
  createIncident: (cellId: string) => void;
  findCellById: (id: string) => NetworkCell | undefined;
  ingestNetworkData: (input: TelemetryFormInput) => Promise<void>;
  submitCompanyData: (input: TelemetryFormInput) => Promise<void>;
  runAiAnalysis: () => Promise<void>;
}

const TelemetryContext = createContext<TelemetryContextType | undefined>(undefined);

export const TelemetryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cells, setCells] = useState<NetworkCell[]>([]);
  const [assets, setAssets] = useState<NetworkAsset[]>([]);
  const [links] = useState<NetworkLink[]>([]); // No mock links in backend
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCell, setSelectedCell] = useState<NetworkCell | null>(null);
  const [submittedCell, setSubmittedCell] = useState<NetworkCell | null>(null);
  const [submittedRawInput, setSubmittedRawInput] = useState<TelemetryFormInput | null>(null);
  const [submittedState, setSubmittedState] = useState<'idle' | 'submitted' | 'analyzed'>('idle');
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<number>(1);
  const [isLive, setIsLive] = useState<boolean>(false); // No artificial jitter
  const [lastTelemetryTime, setLastTelemetryTime] = useState<string>('Static snapshot');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const addAlert = useCallback((newAlert: Alert) => {
    setAlerts((prev) => {
      if (prev.some((a) => a.id === newAlert.id || (a.assetId === newAlert.assetId && a.status === 'Open'))) {
        return prev;
      }
      return [newAlert, ...prev];
    });
  }, []);

  const dismissAlert = useCallback((alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }, []);

  const clearAllAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [assetsData, incidentsData, statsData, atRiskData] = await Promise.all([
        getAssets({ page: 1, page_size: 100 }),
        getIncidents({ page: 1, page_size: 50 }),
        getStatsOverview().catch(() => null),
        getAssets({ is_at_risk: true, page: 1, page_size: 25 }).catch(() => null),
      ]);

      const mappedCells = assetsData.items.map(readingToNetworkCell);
      setCells(mappedCells);

      if (mappedCells.length > 0 && !selectedCell) {
        setSelectedCell(mappedCells[0]);
      }

      // Map assets list
      const mappedAssets: NetworkAsset[] = assetsData.items.map((r) => ({
        id: r.asset_id,
        name: `${r.city || r.region || 'Asset'} ${r.asset_type.toUpperCase()}`,
        type: (r.asset_type.toLowerCase() as any) || 'cell',
        region: r.region || r.country || 'Global',
        lat: r.latitude || 0,
        lng: r.longitude || 0,
        status: (r.status === 'red'
          ? 'critical'
          : r.status === 'purple'
          ? 'anomaly'
          : r.status === 'yellow'
          ? 'warning'
          : 'healthy') as AssetStatus,
        currentLoad: r.traffic_load_pct,
        lastUpdate: r.timestamp,
      }));
      setAssets(mappedAssets);

      // Map incidents
      const mappedIncidents = incidentsData.items.map(apiIncidentToUiIncident);
      setIncidents(mappedIncidents);

      // Derive alerts from open incidents
      const derivedAlerts: Alert[] = incidentsData.items
        .filter((i) => i.status !== 'resolved')
        .map((i) => ({
          id: `ALT-${i.id}`,
          severity: (i.severity as any) || 'high',
          title: i.title,
          assetId: i.asset_id,
          timestamp: new Date(i.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          detectionSource: i.source === 'auto' ? 'SVM Classifier' : 'Health Monitor',
          status: i.status === 'open' ? 'Open' : i.status === 'investigating' ? 'Investigating' : 'Resolved',
        }));

      // Also include active at-risk assets flagged by SVM that don't have explicit incident tickets yet
      const seenAssetIds = new Set(derivedAlerts.map((a) => a.assetId));
      if (atRiskData?.items) {
        for (const r of atRiskData.items) {
          if (!seenAssetIds.has(r.asset_id)) {
            seenAssetIds.add(r.asset_id);
            derivedAlerts.push({
              id: `RISK-${r.asset_id}`,
              severity: 'critical',
              title: `Critical Risk: Node ${r.asset_id} (${r.city || r.country || 'NOC'}) Flagged At-Risk`,
              assetId: r.asset_id,
              timestamp: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              detectionSource: 'SVM Predictive Pipeline',
              status: 'Open',
            });
          }
        }
      }

      setAlerts(derivedAlerts);

      if (statsData) {
        setStats(statsData);
        if (statsData.time_range.min && statsData.time_range.max) {
          setLastTelemetryTime(`${statsData.time_range.min} to ${statsData.time_range.max}`);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch telemetry data from backend');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCell]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const findCellById = (id: string) => {
    return cells.find(
      (c) => c.id.toLowerCase() === id.toLowerCase() || c.name.toLowerCase().includes(id.toLowerCase())
    );
  };

  const handleIncidentAction = async (id: string, action: string, operator?: string) => {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) return;

    try {
      const updated = await applyIncidentAction(numericId, {
        action,
        assignee: operator,
        note: `Action ${action} executed by operator`,
      });

      setIncidents((prev) =>
        prev.map((inc) => (inc.id === id ? apiIncidentToUiIncident(updated) : inc))
      );
    } catch (err: any) {
      alert(`Incident transition failed: ${err.message}`);
    }
  };

  const acknowledgeIncident = async (id: string) => {
    await handleIncidentAction(id, 'acknowledge');
  };

  const assignIncident = async (id: string, operator: string) => {
    await handleIncidentAction(id, 'assign', operator);
  };

  const investigateIncident = async (id: string) => {
    await handleIncidentAction(id, 'investigate');
  };

  const resolveIncident = async (id: string) => {
    await handleIncidentAction(id, 'resolve');
  };

  const escalateIncident = async (id: string) => {
    await handleIncidentAction(id, 'escalate');
  };

  const createIncident = (_cellId: string) => {
    // Backend creates incidents automatically via the ingestion pipeline
  };

  const submitCompanyData = async (input: TelemetryFormInput) => {
    setSubmittedRawInput(input);
    try {
      const payload = {
        Asset_ID: input.cellId || 'PREVIEW',
        Asset_Type: input.assetType,
        Latitude: input.latitude,
        Longitude: input.longitude,
        City: input.location,
        Signal_Strength_dBm: input.signalStrength,
        Latency_ms: input.latency,
        Packet_Loss_pct: input.packetLoss,
        Throughput_Mbps: input.throughput,
        Connected_Users: input.connectedUsers,
        Traffic_Load_pct: input.trafficLoad,
        Call_Drop_Rate_pct: input.callDropRate,
        Resource_Utilization_pct: input.resourceUtil,
        Timestamp: input.timestamp || new Date().toISOString(),
      };

      // Preview mode
      const res = await predictRecord(payload, false, false);
      const previewCell = readingToNetworkCell(res.reading);
      setSubmittedCell(previewCell);
      setSelectedCell(previewCell);
      setSubmittedState('submitted');
      setActiveWorkflowStep(1);
    } catch (err: any) {
      alert(`Validation error: ${err.message}`);
    }
  };

  const runAiAnalysis = async () => {
    if (!submittedRawInput && !submittedCell) return;
    const input = submittedRawInput || {
      cellId: submittedCell?.id || 'PREVIEW-NODE',
      assetType: (submittedCell?.assetType as any) || 'cell',
      latitude: submittedCell?.lat || 18.5204,
      longitude: submittedCell?.lng || 73.8567,
      location: submittedCell?.city || 'Pune',
      signalStrength: submittedCell?.signalStrength || -80,
      latency: submittedCell?.latency || 45,
      packetLoss: submittedCell?.packetLoss || 1.2,
      throughput: submittedCell?.throughput || 100,
      connectedUsers: submittedCell?.users || 200,
      trafficLoad: submittedCell?.trafficLoad || 50,
      callDropRate: submittedCell?.callDropRate || 1.0,
      resourceUtil: submittedCell?.resourceUtil || 55,
      timestamp: submittedCell?.timestamp || new Date().toISOString(),
    };

    await ingestNetworkData(input);
    setSubmittedState('analyzed');
    setActiveWorkflowStep(2);
  };

  const ingestNetworkData = async (input: TelemetryFormInput) => {
    const payload = {
      Asset_ID: input.cellId,
      Asset_Type: input.assetType,
      Latitude: input.latitude,
      Longitude: input.longitude,
      City: input.location,
      Signal_Strength_dBm: input.signalStrength,
      Latency_ms: input.latency,
      Packet_Loss_pct: input.packetLoss,
      Throughput_Mbps: input.throughput,
      Connected_Users: input.connectedUsers,
      Traffic_Load_pct: input.trafficLoad,
      Call_Drop_Rate_pct: input.callDropRate,
      Resource_Utilization_pct: input.resourceUtil,
      Timestamp: input.timestamp || new Date().toISOString(),
    };

    try {
      const res = await predictRecord(payload, true, false);
      const savedCell = readingToNetworkCell(res.reading);

      setCells((prev) => {
        const idx = prev.findIndex((c) => c.id.toLowerCase() === savedCell.id.toLowerCase());
        if (idx !== -1) {
          const copy = [...prev];
          copy[idx] = savedCell;
          return copy;
        }
        return [savedCell, ...prev];
      });

      setSelectedCell(savedCell);
      setSubmittedCell(savedCell);

      // Check if newly ingested asset is at-risk or anomaly, and trigger immediate top-right notification
      if (res.reading.is_at_risk || res.reading.status === 'red' || res.reading.is_anomaly) {
        const newAlert: Alert = {
          id: `RISK-${Date.now()}-${res.reading.asset_id}`,
          severity: res.reading.status === 'red' || res.reading.is_at_risk ? 'critical' : 'high',
          title: res.reading.is_at_risk
            ? `🚨 CRITICAL RISK: Asset ${res.reading.asset_id} (${res.reading.city || 'Network Node'}) Flagged At-Risk`
            : `⚠️ ANOMALY ALERT: Node ${res.reading.asset_id} Density Outlier`,
          assetId: res.reading.asset_id,
          timestamp: 'Just now',
          detectionSource: res.reading.is_at_risk ? 'SVM Classifier' : 'DBSCAN Anomaly Monitor',
          status: 'Open',
        };
        addAlert(newAlert);
      }

      // Refresh overview stats and incidents in background
      getStatsOverview().then(setStats).catch(() => {});
      getIncidents({ page: 1, page_size: 50 }).then((inc) => {
        setIncidents(inc.items.map(apiIncidentToUiIncident));
      }).catch(() => {});
    } catch (err: any) {
      alert(`API Ingestion Error: ${err.message}`);
    }
  };

  return (
    <TelemetryContext.Provider
      value={{
        cells,
        assets,
        links,
        alerts,
        incidents,
        stats,
        isLoading,
        error,
        selectedCell,
        setSelectedCell,
        submittedCell,
        submittedState,
        activeWorkflowStep,
        setActiveWorkflowStep,
        isLive,
        setIsLive,
        lastTelemetryTime,
        searchQuery,
        setSearchQuery,
        refreshData: loadData,
        addAlert,
        dismissAlert,
        clearAllAlerts,
        acknowledgeIncident,
        assignIncident,
        investigateIncident,
        resolveIncident,
        escalateIncident,
        createIncident,
        findCellById,
        ingestNetworkData,
        submitCompanyData,
        runAiAnalysis,
      }}
    >
      {children}
    </TelemetryContext.Provider>
  );
};

export const useTelemetry = () => {
  const context = useContext(TelemetryContext);
  if (!context) throw new Error('useTelemetry must be used within a TelemetryProvider');
  return context;
};
