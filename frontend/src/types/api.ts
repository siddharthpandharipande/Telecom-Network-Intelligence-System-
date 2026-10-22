/** API response and request TypeScript interfaces for NEXUSNET. */
export interface ApiErrorPayload {
  detail: string;
  code: string;
  errors: string[];
}

export class ApiError extends Error {
  code: string;
  errors: string[];

  constructor(payload: ApiErrorPayload, statusText?: string) {
    super(payload.detail || statusText || 'API Error');
    this.name = 'ApiError';
    this.code = payload.code || 'UNKNOWN_ERROR';
    this.errors = payload.errors || [];
  }
}

export interface HealthResponse {
  status: string;
  model_version: string;
  db_readings: number;
  db_assets: number;
  models_loaded: boolean;
}

export interface StatusLegendItem {
  status: 'red' | 'purple' | 'yellow' | 'green' | string;
  label: string;
  color_key: string;
  description: string;
}

export interface TelemetryRange {
  min: number;
  max: number;
  type: string;
}

export interface SystemConfig {
  version: string;
  decision: {
    shipped_variant: string;
    reason: string;
    limitation_text?: string;
  };
  label: {
    name: string;
    positive_class: string;
    negative_class: string;
    clauses: Array<{
      metric: string;
      op: string;
      limit: number;
      message: string;
    }>;
  };
  svm_features: {
    numeric: string[];
    categorical: string[];
  };
  dbscan: {
    features: string[];
    eps: number;
    min_samples: number;
  };
  ranges: Record<string, TelemetryRange>;
  status_legend: StatusLegendItem[];
  required_columns: string[];
  optional_columns: string[];
  dataset_note: string;
}

export interface ThresholdBreach {
  metric: string;
  value: number;
  limit: number;
  operator: string;
  message: string;
}

export interface Reading {
  asset_id: string;
  asset_type: string;
  continent: string | null;
  country: string | null;
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  timestamp: string;
  signal_strength_dbm: number;
  latency_ms: number;
  packet_loss_pct: number;
  throughput_mbps: number;
  connected_users: number;
  traffic_load_pct: number;
  call_drop_rate_pct: number;
  resource_utilization_pct: number;
  peak_hour: number;
  network_stress_index: number;
  signal_quality_score: number;
  throughput_per_user: number;
  risk_label: 'Normal' | 'At Risk';
  risk_score: number;
  is_at_risk: boolean;
  dbscan_cluster: number;
  is_anomaly: boolean;
  nearest_core_distance: number;
  status: 'green' | 'yellow' | 'purple' | 'red';
  threshold_breaches: ThresholdBreach[];
  model_version: string;
  source: string;
}

export interface PredictResponse {
  reading: Reading;
  validation: {
    warnings: string[];
    imputed: string[];
  };
}

export interface IngestionReport {
  ingestion_id: number | null;
  filename: string;
  rows_total: number;
  accepted: number;
  rejected: number;
  imputed: number;
  updated: number;
  duplicates_in_file: number;
  unlocated: number;
  warnings: string[];
  rejected_rows: Array<{
    row: number;
    reasons: string[];
  }>;
  risk_summary: {
    at_risk: number;
    anomalies: number;
    status_counts: {
      green: number;
      yellow: number;
      purple: number;
      red: number;
    };
  };
}

export interface IngestionLogItem {
  id: number;
  created_at: string;
  filename: string;
  source: string;
  rows_total: number;
  accepted: number;
  rejected: number;
  imputed: number;
  updated: number;
  duplicates_in_file: number;
  report: IngestionReport | Record<string, any>;
}

export interface PaginatedAssets {
  items: Reading[];
  total: number;
  page: number;
  page_size: number;
}

export interface MapPoint {
  asset_id: string;
  latitude: number;
  longitude: number;
  status: 'green' | 'yellow' | 'purple' | 'red';
  is_at_risk: boolean;
  is_anomaly: boolean;
  asset_type: string;
  city: string | null;
  country?: string | null;
  continent?: string | null;
}

export interface AssetDetail {
  asset: {
    asset_id: string;
    asset_type: string;
    continent: string | null;
    country: string | null;
    city: string | null;
    region: string | null;
    latitude: number | null;
    longitude: number | null;
    created_at: string;
    updated_at: string;
  };
  latest: Reading | null;
  history: Reading[];
}

export interface StatsOverview {
  total_assets: number;
  total_readings: number;
  located_assets: number;
  unlocated_assets: number;
  status_counts: {
    green: number;
    yellow: number;
    purple: number;
    red: number;
  };
  risk_counts: {
    normal: number;
    at_risk: number;
  };
  anomaly_count: number;
  both_count: number;
  by_asset_type: Array<{
    asset_type: string;
    count: number;
    at_risk: number;
  }>;
  top_countries: Array<{
    country: string;
    count: number;
    at_risk: number;
  }>;
  avg_metrics: {
    signal_strength_dbm: number;
    latency_ms: number;
    packet_loss_pct: number;
    throughput_mbps: number;
    connected_users: number;
    traffic_load_pct: number;
    call_drop_rate_pct: number;
    resource_utilization_pct: number;
    network_stress_index: number;
    signal_quality_score: number;
  };
  time_range: {
    min: string | null;
    max: string | null;
  };
  last_ingestion: {
    id: number;
    filename: string;
    source: string;
    created_at: string;
    rows_total: number;
    accepted: number;
  } | null;
  open_incidents: number;
  model_version: string;
}

export interface CorrelationData {
  labels: string[];
  values: number[][];
}

export interface HourlyData {
  metric: string;
  hourly: Array<{
    hour: number;
    mean: number;
    count: number;
  }>;
  effect_size: number;
  meaningful: boolean;
}

export interface DistributionsData {
  metric: string;
  bins: string[];
  groups: Record<string, number[]>;
}

export interface CityRisk {
  city: string;
  total_assets: number;
  at_risk_count: number;
  at_risk_pct: number;
}

export interface RiskAnomalyMatrix {
  normal_inlier: number;
  normal_anomaly: number;
  at_risk_inlier: number;
  at_risk_anomaly: number;
  total: number;
}

export interface ScatterPoint {
  asset_id: string;
  x: number;
  y: number;
  dbscan_cluster: number;
  is_anomaly: boolean;
  is_at_risk: boolean;
}

export interface DbscanExploreResponse {
  eps: number;
  min_samples: number;
  n_clusters: number;
  noise_count: number;
  noise_pct: number;
}

export interface ReplayResponse {
  items: Reading[];
  next_cursor: number;
  has_more: boolean;
}

export interface ModelCard {
  model_version: string;
  dataset: {
    rows: number;
    date_range: string;
    synthetic: boolean;
    note: string;
  };
  label: {
    name: string;
    description: string;
    clauses: Array<any>;
    prevalence: {
      Normal: number;
      At_Risk: number;
      Normal_pct: number;
      At_Risk_pct: number;
    };
  };
  decision: {
    shipped_variant: string;
    reason: string;
  };
  svm: {
    features: string[];
    best_params: Record<string, any>;
    cv_metrics: Record<string, any>;
    test_metrics: {
      accuracy: number;
      precision: number;
      recall: number;
      f1: number;
      roc_auc: number;
      pr_auc: number;
      brier_score: number;
    };
    confusion_matrix: {
      tn: number;
      fp: number;
      fn: number;
      tp: number;
      matrix: number[][];
    };
  };
  ablation: Array<{
    experiment: string;
    model: string;
    acc_mean: number;
    acc_std: number;
    prec_mean: number;
    prec_std: number;
    rec_mean: number;
    rec_std: number;
    f1_mean: number;
    f1_std: number;
    roc_auc_mean: number;
    roc_auc_std: number;
    pr_auc_mean: number;
    pr_auc_std: number;
  }>;
  dbscan: {
    features: string[];
    eps: number;
    min_samples: number;
    n_clusters: number;
    noise_count: number;
    noise_pct: number;
    sweep_table: Array<{
      eps: number;
      min_samples: number;
      n_clusters: number;
      n_noise: number;
      noise_pct: number;
    }>;
  };
  risk_anomaly_matrix: {
    normal_inlier: number;
    normal_anomaly: number;
    at_risk_inlier: number;
    at_risk_anomaly: number;
    total: number;
  };
  training_medians: Record<string, number>;
  limitations: string[];
}

export interface IncidentEvent {
  id: number;
  incident_id: number;
  ts: string;
  actor: string;
  action: string;
  note: string | null;
  from_status: string | null;
  to_status: string | null;
}

export interface Incident {
  id: number;
  asset_id: string;
  reading_id: number | null;
  severity: 'critical' | 'high' | 'medium';
  title: string;
  status: 'open' | 'acknowledged' | 'assigned' | 'investigating' | 'resolved' | 'escalated';
  assignee: string | null;
  source: string;
  created_at: string;
  updated_at: string;
  events: IncidentEvent[];
}

export interface PaginatedIncidents {
  items: Incident[];
  total: number;
  page: number;
  page_size: number;
}

// ----------------------------------------------------------------------------
// Authentication & RBAC Interfaces
// ----------------------------------------------------------------------------
export interface User {
  id: number;
  username: string;
  full_name: string;
  role: 'noc_analyst' | 'network_engineer' | 'admin' | string;
  is_active: boolean;
  created_at: string;
}

export interface LoginResponse {
  token: string;
  user_id: number;
  username: string;
  full_name: string;
  role: string;
  expires_at: string;
}

// ----------------------------------------------------------------------------
// Network Topology Link Interfaces
// ----------------------------------------------------------------------------
export interface NetworkLink {
  id: number;
  link_id: string;
  source_asset_id: string;
  destination_asset_id: string;
  source_lat: number | null;
  source_lng: number | null;
  dest_lat: number | null;
  dest_lng: number | null;
  source_city: string | null;
  dest_city: string | null;
  link_type: 'fiber' | 'microwave' | 'satellite' | string;
  capacity_gbps: number;
  utilization_pct: number;
  status: 'up' | 'degraded' | 'down' | string;
  is_synthetic: boolean;
  created_at: string;
}

// ----------------------------------------------------------------------------
// Simulated Replay Interfaces
// ----------------------------------------------------------------------------
export interface ReplayMeta {
  start_time: string;
  end_time: string;
  distinct_hours: number[];
  total_readings: number;
  is_snapshot: boolean;
  snapshot_date: string;
}

export interface ReplaySlice {
  hour: number;
  timestamp_sample: string;
  count: number;
  readings: MapPoint[];
}

// ----------------------------------------------------------------------------
// Network Health Dashboard Interfaces
// ----------------------------------------------------------------------------
export interface HealthDashboardKPIs {
  total_assets: number;
  normal_assets: number;
  at_risk_assets: number;
  at_risk_pct: number;
  anomaly_count: number;
  anomaly_pct: number;
  availability_pct: number;
  avg_signal_strength_dbm: number;
  avg_latency_ms: number;
  avg_packet_loss_pct: number;
  avg_traffic_load_pct: number;
  avg_resource_utilization_pct: number;
  avg_nsi: number;
  aggregate_health_score: number;
  health_category: 'Healthy' | 'Warning' | 'Critical' | string;
}

export interface HealthDashboardData {
  kpis: HealthDashboardKPIs;
  charts: {
    svm_distribution: Array<{ name: string; value: number; color: string }>;
    dbscan_distribution: Array<{ name: string; value: number; color: string }>;
    nsi_distribution: Array<{ bin: string; count: number }>;
    latency_packet_loss: Array<{
      asset_type: string;
      latency_ms: number;
      packet_loss_pct: number;
      traffic_load_pct: number;
      resource_util_pct: number;
      total: number;
      at_risk: number;
    }>;
    signal_distribution: Array<{ tier: string; count: number }>;
    risk_by_region: Array<{ region: string; total: number; at_risk: number; optimal: number }>;
  };
  documentation: {
    nsi_formula: string;
    health_score_formula: string;
    availability_note: string;
    data_scope: string;
  };
  filter_options: {
    countries: string[];
    continents: string[];
    cities: string[];
    asset_types: string[];
    hierarchy?: Record<string, Record<string, string[]>>;
    country_to_continent?: Record<string, string>;
  };
  timestamp: string;
}

export interface HealthLocationsResponse {
  continents: string[];
  countries: string[];
  cities: string[];
  hierarchy: Record<string, Record<string, string[]>>;
  country_to_continent?: Record<string, string>;
}

// ----------------------------------------------------------------------------
// Historical Analytics Trends Interfaces
// ----------------------------------------------------------------------------
export interface HistoricalTrendPoint {
  timestamp: string;
  date: string;
  hour: number;
  avg_latency: number;
  avg_packet_loss: number;
  avg_traffic: number;
  avg_resource: number;
  avg_nsi: number;
  avg_signal: number;
  at_risk_count: number;
  anomaly_count: number;
  reading_count: number;
}

export interface HistoricalTrendsData {
  timeline: HistoricalTrendPoint[];
  available_range: {
    min_date: string | null;
    max_date: string | null;
  };
  coverage_note: string;
}
