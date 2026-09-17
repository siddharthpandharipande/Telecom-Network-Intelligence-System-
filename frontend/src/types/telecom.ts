export type AssetStatus = 'healthy' | 'warning' | 'critical' | 'anomaly';
export type AssetType = 'cell' | 'tower' | 'basestation' | 'router';

export interface NetworkCell {
  id: string;
  name: string;
  assetType: AssetType;
  region: string;
  city: string;
  lat: number;
  lng: number;
  users: number;
  latency: number; // ms
  packetLoss: number; // %
  trafficLoad: number; // %
  throughput: number; // Mbps
  signalStrength: number; // dBm
  callDropRate: number; // %
  resourceUtil: number; // %
  timestamp?: string;
  networkAvailability?: number; // %
  status: AssetStatus;
  svmRiskScore: number; // 0-100%
  svmRiskCategory: 'Normal' | 'At Risk';
  svmMainFactor: string;
  dbscanClassification: 'Normal' | 'Anomaly';
  dbscanAnomalyScore: number; // 0.0 - 1.0
  lastUpdated: string;
  isCompanyIngested?: boolean;
}

export interface TelemetryFormInput {
  cellId: string;
  assetType: AssetType;
  latitude: number;
  longitude: number;
  location: string;
  signalStrength: number;
  latency: number;
  packetLoss: number;
  throughput: number;
  connectedUsers: number;
  trafficLoad: number;
  callDropRate: number;
  resourceUtil: number;
  timestamp: string;
}

export interface NetworkAsset {
  id: string;
  name: string;
  type: AssetType;
  region: string;
  lat: number;
  lng: number;
  status: AssetStatus;
  currentLoad: number; // %
  lastUpdate: string;
}

export interface NetworkLink {
  id: string;
  fromId: string;
  toId: string;
  fromCoords: [number, number];
  toCoords: [number, number];
  status: AssetStatus;
  utilization: number; // %
}

export interface SVMInputFactor {
  factor: string;
  value: string;
  normalRange: string;
  status: 'normal' | 'elevated' | 'critical';
}

export interface DBSCANPoint {
  cellId: string;
  region: string;
  latency: number;
  packetLoss: number;
  trafficLoad: number;
  cluster: number; // -1 for outlier/noise, 0..N for clusters
  clusterName: string;
  isOutlier: boolean;
  anomalyScore: number;
}

export interface Alert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  assetId: string;
  timestamp: string;
  detectionSource: 'SVM' | 'DBSCAN' | 'Health Monitor';
  status: 'Open' | 'Investigating' | 'Resolved';
}

export interface IncidentTimelineEvent {
  time: string;
  event: string;
  type: 'info' | 'warning' | 'anomaly' | 'critical' | 'action';
}

export interface Incident {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  assetId: string;
  region: string;
  detectedTime: string;
  detectionSource: string;
  supportingDetection: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'RESOLVED' | 'ESCALATED';
  assignedOperator?: string;
  timeline: IncidentTimelineEvent[];
}
