import React, { createContext, useContext, useState, useEffect } from 'react';
import { NetworkCell, NetworkAsset, NetworkLink, Alert, Incident, TelemetryFormInput, AssetStatus } from '../types/telecom';
import { INITIAL_CELLS, INITIAL_ASSETS, INITIAL_LINKS, INITIAL_ALERTS, INITIAL_INCIDENTS } from '../data/mockTelecomData';

interface TelemetryContextType {
  cells: NetworkCell[];
  assets: NetworkAsset[];
  links: NetworkLink[];
  alerts: Alert[];
  incidents: Incident[];
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
  acknowledgeIncident: (id: string) => void;
  assignIncident: (id: string, operator: string) => void;
  investigateIncident: (id: string) => void;
  resolveIncident: (id: string) => void;
  escalateIncident: (id: string) => void;
  createIncident: (cellId: string) => void;
  findCellById: (id: string) => NetworkCell | undefined;
  ingestNetworkData: (input: TelemetryFormInput) => void;
  submitCompanyData: (input: TelemetryFormInput) => void;
  runAiAnalysis: () => void;
}

const TelemetryContext = createContext<TelemetryContextType | undefined>(undefined);

export const TelemetryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cells, setCells] = useState<NetworkCell[]>(INITIAL_CELLS);
  const [assets] = useState<NetworkAsset[]>(INITIAL_ASSETS);
  const [links] = useState<NetworkLink[]>(INITIAL_LINKS);
  const [alerts, setAlerts] = useState<Alert[]>(INITIAL_ALERTS);
  const [incidents, setIncidents] = useState<Incident[]>(INITIAL_INCIDENTS);
  const [selectedCell, setSelectedCell] = useState<NetworkCell | null>(INITIAL_CELLS[0]); // default MH-PN-102
  const [isLive, setIsLive] = useState<boolean>(true);
  const [lastTelemetryTime, setLastTelemetryTime] = useState<string>('2 seconds ago');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Simulated live telemetry loop
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      setCells(prevCells =>
        prevCells.map(cell => {
          // Slight realistic telemetry jitter
          const latencyDelta = Math.floor((Math.random() - 0.48) * 3);
          const packetDelta = parseFloat(((Math.random() - 0.48) * 0.2).toFixed(1));
          const newLatency = Math.max(15, cell.latency + latencyDelta);
          const newPacketLoss = Math.max(0.2, parseFloat((cell.packetLoss + packetDelta).toFixed(1)));

          return {
            ...cell,
            latency: newLatency,
            packetLoss: newPacketLoss,
            lastUpdated: 'Just now'
          };
        })
      );

      setLastTelemetryTime('Just now');
    }, 3000);

    return () => clearInterval(interval);
  }, [isLive]);

  const findCellById = (id: string) => {
    return cells.find(c => c.id.toLowerCase() === id.toLowerCase() || c.name.toLowerCase().includes(id.toLowerCase()));
  };

  const acknowledgeIncident = (id: string) => {
    setIncidents(prev =>
      prev.map(inc => {
        if (inc.id === id) {
          return {
            ...inc,
            status: 'ACKNOWLEDGED',
            timeline: [
              ...inc.timeline,
              { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), event: 'Incident acknowledged by operator', type: 'action' }
            ]
          };
        }
        return inc;
      })
    );
  };

  const assignIncident = (id: string, operator: string) => {
    setIncidents(prev =>
      prev.map(inc => {
        if (inc.id === id) {
          return {
            ...inc,
            assignedOperator: operator,
            timeline: [
              ...inc.timeline,
              { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), event: `Assigned to ${operator}`, type: 'action' }
            ]
          };
        }
        return inc;
      })
    );
  };

  const investigateIncident = (id: string) => {
    setIncidents(prev =>
      prev.map(inc => {
        if (inc.id === id) {
          return {
            ...inc,
            status: 'INVESTIGATING',
            timeline: [
              ...inc.timeline,
              { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), event: 'Operator initiated deep telemetry investigation', type: 'action' }
            ]
          };
        }
        return inc;
      })
    );
  };

  const resolveIncident = (id: string) => {
    setIncidents(prev =>
      prev.map(inc => {
        if (inc.id === id) {
          return {
            ...inc,
            status: 'RESOLVED',
            timeline: [
              ...inc.timeline,
              { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), event: 'Incident marked as RESOLVED by NOC Operator', type: 'action' }
            ]
          };
        }
        return inc;
      })
    );
  };

  const escalateIncident = (id: string) => {
    setIncidents(prev =>
      prev.map(inc => {
        if (inc.id === id) {
          return {
            ...inc,
            status: 'ESCALATED',
            severity: 'CRITICAL',
            timeline: [
              ...inc.timeline,
              { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), event: 'Escalated to Tier-3 Network Engineering Team', type: 'critical' }
            ]
          };
        }
        return inc;
      })
    );
  };

  const createIncident = (cellId: string) => {
    const targetCell = cells.find(c => c.id === cellId);
    const newId = `INC-${Math.floor(2050 + Math.random() * 100)}`;
    const newInc: Incident = {
      id: newId,
      severity: targetCell?.status === 'critical' ? 'CRITICAL' : 'HIGH',
      assetId: cellId,
      region: targetCell?.region || 'Unknown',
      detectedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      detectionSource: 'Manual Dispatch',
      supportingDetection: 'SVM & DBSCAN Alert',
      status: 'OPEN',
      assignedOperator: 'NOC Operator 01',
      timeline: [
        { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), event: `Incident manually dispatched for asset ${cellId}`, type: 'action' }
      ]
    };
    setIncidents([newInc, ...incidents]);
  };

  const ingestNetworkData = (input: TelemetryFormInput) => {
    let svmScore = 15;
    let svmCat: 'Normal' | 'At Risk' = 'Normal';
    let mainFactor = 'Optimal Baseline Telemetry';

    if (input.latency > 100 || input.packetLoss > 5 || input.trafficLoad > 88 || input.callDropRate > 5) {
      svmScore = Math.min(98.5, 85 + Math.random() * 12);
      svmCat = 'At Risk';
      mainFactor = input.latency > 100 ? 'High Latency Bottleneck' : input.packetLoss > 5 ? 'Severe Packet Loss' : 'Capacity Exhaustion';
    } else if (input.latency > 60 || input.packetLoss > 2 || input.trafficLoad > 75) {
      svmScore = Math.min(78, 50 + Math.random() * 20);
      svmCat = 'Normal';
      mainFactor = 'Elevated Load';
    }

    let dbscanClass: 'Normal' | 'Anomaly' = 'Normal';
    let dbscanScore = 0.22;
    if (input.latency > 115 || input.packetLoss > 6 || input.callDropRate > 4 || input.signalStrength < -103) {
      dbscanClass = 'Anomaly';
      dbscanScore = parseFloat((0.85 + Math.random() * 0.12).toFixed(2));
    }

    // Determine status for marker color: 🟢 Healthy | 🟡 Warning | 🔴 At Risk / Critical | 🟣 Anomaly
    let status: AssetStatus = 'healthy';
    if (dbscanClass === 'Anomaly') status = 'anomaly';
    else if (svmCat === 'At Risk') status = 'critical';
    else if (input.latency > 60 || input.packetLoss > 2 || input.trafficLoad > 75) status = 'warning';

    const lat = input.latitude || 18.5204;
    const lng = input.longitude || 73.8567;
    const ts = input.timestamp || new Date().toLocaleString();

    const newCell: NetworkCell = {
      id: input.cellId,
      name: `${input.location} ${input.assetType.toUpperCase()}`,
      assetType: input.assetType,
      region: input.location,
      city: input.location,
      lat,
      lng,
      users: input.connectedUsers,
      latency: input.latency,
      packetLoss: input.packetLoss,
      trafficLoad: input.trafficLoad,
      throughput: input.throughput,
      signalStrength: input.signalStrength,
      callDropRate: input.callDropRate,
      resourceUtil: input.resourceUtil,
      timestamp: ts,
      status,
      svmRiskScore: parseFloat(svmScore.toFixed(1)),
      svmRiskCategory: svmCat,
      svmMainFactor: mainFactor,
      dbscanClassification: dbscanClass,
      dbscanAnomalyScore: dbscanScore,
      lastUpdated: 'Just now (Company Ingested)',
      isCompanyIngested: true
    };

    setCells(prev => {
      const idx = prev.findIndex(c => c.id.toLowerCase() === input.cellId.toLowerCase());
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx] = newCell;
        return copy;
      }
      return [newCell, ...prev];
    });

    setSelectedCell(newCell);

    // Trigger alert if critical/anomaly
    if (status === 'critical' || status === 'anomaly') {
      const newAlert: Alert = {
        id: `ALT-${Math.floor(110 + Math.random() * 90)}`,
        severity: 'critical',
        title: `Company Data Alert: ${input.cellId}`,
        assetId: input.cellId,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        detectionSource: svmCat === 'At Risk' ? 'SVM' : 'DBSCAN',
        status: 'Open'
      };
      setAlerts(prev => [newAlert, ...prev]);
    }
  };

  const [submittedCell, setSubmittedCell] = useState<NetworkCell | null>(INITIAL_CELLS[0]);
  const [submittedRawInput, setSubmittedRawInput] = useState<TelemetryFormInput | null>(null);
  const [submittedState, setSubmittedState] = useState<'idle' | 'submitted' | 'analyzed'>('analyzed');
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<number>(1);

  const submitCompanyData = (input: TelemetryFormInput) => {
    setSubmittedRawInput(input);
    const draftCell: NetworkCell = {
      id: input.cellId,
      name: `${input.location} ${input.assetType.toUpperCase()}`,
      assetType: input.assetType,
      region: input.location,
      city: input.location,
      lat: input.latitude || 18.5204,
      lng: input.longitude || 73.8567,
      users: input.connectedUsers,
      latency: input.latency,
      packetLoss: input.packetLoss,
      trafficLoad: input.trafficLoad,
      throughput: input.throughput,
      signalStrength: input.signalStrength,
      callDropRate: input.callDropRate,
      resourceUtil: input.resourceUtil,
      timestamp: input.timestamp || new Date().toLocaleString(),
      status: 'warning',
      svmRiskScore: 0,
      svmRiskCategory: 'Normal',
      svmMainFactor: 'Pending AI Analysis',
      dbscanClassification: 'Normal',
      dbscanAnomalyScore: 0,
      lastUpdated: 'Just now (Submitted)',
      isCompanyIngested: true
    };
    setSubmittedCell(draftCell);
    setSubmittedState('submitted');
    setActiveWorkflowStep(1);
  };

  const runAiAnalysis = () => {
    const input = submittedRawInput || {
      cellId: submittedCell?.id || 'MH-PN-102',
      assetType: submittedCell?.assetType || 'cell',
      latitude: submittedCell?.lat || 18.5204,
      longitude: submittedCell?.lng || 73.8567,
      location: submittedCell?.region || 'Pune',
      signalStrength: submittedCell?.signalStrength || -104,
      latency: submittedCell?.latency || 182,
      packetLoss: submittedCell?.packetLoss || 11.8,
      throughput: submittedCell?.throughput || 4.2,
      connectedUsers: submittedCell?.users || 1820,
      trafficLoad: submittedCell?.trafficLoad || 95,
      callDropRate: submittedCell?.callDropRate || 6.2,
resourceUtil: submittedCell?.resourceUtil || 96,
      timestamp: submittedCell?.timestamp || '2026-09-15 17:38:12'
    };

    ingestNetworkData(input);
    setSubmittedState('analyzed');
    setActiveWorkflowStep(2);
  };

  return (
    <TelemetryContext.Provider
      value={{
        cells,
        assets,
        links,
        alerts,
        incidents,
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
        acknowledgeIncident,
        assignIncident,
        investigateIncident,
        resolveIncident,
        escalateIncident,
        createIncident,
        findCellById,
        ingestNetworkData,
        submitCompanyData,
        runAiAnalysis
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
