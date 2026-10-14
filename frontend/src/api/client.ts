import {
  ApiError,
  ApiErrorPayload,
  AssetDetail,
  CityRisk,
  CorrelationData,
  DbscanExploreResponse,
  DistributionsData,
  HealthResponse,
  HourlyData,
  Incident,
  IngestionLogItem,
  IngestionReport,
  MapPoint,
  ModelCard,
  PaginatedAssets,
  PaginatedIncidents,
  PredictResponse,
  ReplayResponse,
  RiskAnomalyMatrix,
  ScatterPoint,
  StatsOverview,
  SystemConfig,
} from '../types/api';

const API_BASE_URL = ((import.meta as any).env?.VITE_API_BASE_URL as string) || 'http://localhost:8000';

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorPayload: ApiErrorPayload;
    try {
      errorPayload = await response.json();
    } catch {
      errorPayload = {
        detail: `Request failed with status ${response.status}`,
        code: 'HTTP_ERROR',
        errors: [response.statusText],
      };
    }
    throw new ApiError(errorPayload, response.statusText);
  }

  return response.json() as Promise<T>;
}

// ----------------------------------------------------------------------------
// API Endpoints
// ----------------------------------------------------------------------------

export async function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/api/health');
}

export async function getConfig(): Promise<SystemConfig> {
  return apiFetch<SystemConfig>('/api/config');
}

export async function getModelCard(): Promise<ModelCard> {
  return apiFetch<ModelCard>('/api/model/card');
}

export async function predictRecord(
  payload: Record<string, any>,
  persist: boolean = false,
  impute: boolean = false
): Promise<PredictResponse> {
  const params = new URLSearchParams({
    persist: String(persist),
    impute: String(impute),
  });
  return apiFetch<PredictResponse>(`/api/predict?${params.toString()}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function ingestCsv(
  file: File,
  dryRun: boolean = false,
  impute: boolean = false
): Promise<IngestionReport> {
  const formData = new FormData();
  formData.append('file', file);

  const params = new URLSearchParams({
    dry_run: String(dryRun),
    impute: String(impute),
  });

  return apiFetch<IngestionReport>(`/api/ingest/csv?${params.toString()}`, {
    method: 'POST',
    body: formData,
  });
}

export async function getIngestionLogs(limit: number = 20): Promise<IngestionLogItem[]> {
  return apiFetch<IngestionLogItem[]>(`/api/ingest/log?limit=${limit}`);
}

export async function getAssets(params: {
  country?: string;
  city?: string;
  asset_type?: string;
  status?: string;
  is_at_risk?: boolean;
  is_anomaly?: boolean;
  source?: string;
  q?: string;
  page?: number;
  page_size?: number;
  sort?: string;
} = {}): Promise<PaginatedAssets> {
  const query = new URLSearchParams();
  if (params.country) query.set('country', params.country);
  if (params.city) query.set('city', params.city);
  if (params.asset_type) query.set('asset_type', params.asset_type);
  if (params.status) query.set('status', params.status);
  if (params.is_at_risk !== undefined) query.set('is_at_risk', String(params.is_at_risk));
  if (params.is_anomaly !== undefined) query.set('is_anomaly', String(params.is_anomaly));
  if (params.source) query.set('source', params.source);
  if (params.q) query.set('q', params.q);
  if (params.page) query.set('page', String(params.page));
  if (params.page_size) query.set('page_size', String(params.page_size));
  if (params.sort) query.set('sort', params.sort);

  return apiFetch<PaginatedAssets>(`/api/assets?${query.toString()}`);
}

export async function getMapPoints(params: {
  country?: string;
  city?: string;
  asset_type?: string;
  status?: string;
  is_at_risk?: boolean;
  is_anomaly?: boolean;
  source?: string;
  q?: string;
} = {}): Promise<MapPoint[]> {
  const query = new URLSearchParams();
  if (params.country) query.set('country', params.country);
  if (params.city) query.set('city', params.city);
  if (params.asset_type) query.set('asset_type', params.asset_type);
  if (params.status) query.set('status', params.status);
  if (params.is_at_risk !== undefined) query.set('is_at_risk', String(params.is_at_risk));
  if (params.is_anomaly !== undefined) query.set('is_anomaly', String(params.is_anomaly));
  if (params.source) query.set('source', params.source);
  if (params.q) query.set('q', params.q);

  return apiFetch<MapPoint[]>(`/api/map/points?${query.toString()}`);
}

export async function getAssetDetail(assetId: string): Promise<AssetDetail> {
  return apiFetch<AssetDetail>(`/api/assets/${encodeURIComponent(assetId)}`);
}

export async function getStatsOverview(): Promise<StatsOverview> {
  return apiFetch<StatsOverview>('/api/stats/overview');
}

export async function getCorrelation(): Promise<CorrelationData> {
  return apiFetch<CorrelationData>('/api/analytics/correlation');
}

export async function getHourlyAnalytics(metric: string = 'traffic_load_pct'): Promise<HourlyData> {
  return apiFetch<HourlyData>(`/api/analytics/hourly?metric=${encodeURIComponent(metric)}`);
}

export async function getDistributions(
  metric: string = 'latency_ms',
  by: string = 'asset_type',
  bins: number = 20
): Promise<DistributionsData> {
  const query = new URLSearchParams({
    metric,
    by,
    bins: String(bins),
  });
  return apiFetch<DistributionsData>(`/api/analytics/distributions?${query.toString()}`);
}

export async function getCitiesAnalytics(top: number = 10, minN: number = 10): Promise<CityRisk[]> {
  return apiFetch<CityRisk[]>(`/api/analytics/cities?top=${top}&min_n=${minN}`);
}

export async function getRiskAnomalyMatrix(): Promise<RiskAnomalyMatrix> {
  return apiFetch<RiskAnomalyMatrix>('/api/analytics/risk_anomaly_matrix');
}

export async function getScatterData(
  x: string = 'latency_ms',
  y: string = 'packet_loss_pct',
  n: number = 1500
): Promise<ScatterPoint[]> {
  const query = new URLSearchParams({
    x,
    y,
    n: String(n),
  });
  return apiFetch<ScatterPoint[]>(`/api/analytics/scatter?${query.toString()}`);
}

export async function getDbscanExplore(
  eps: number = 1.6,
  minSamples: number = 16
): Promise<DbscanExploreResponse> {
  const query = new URLSearchParams({
    eps: String(eps),
    min_samples: String(minSamples),
  });
  return apiFetch<DbscanExploreResponse>(`/api/dbscan/explore?${query.toString()}`);
}

export async function getReplay(cursor: number = 0, n: number = 5): Promise<ReplayResponse> {
  return apiFetch<ReplayResponse>(`/api/replay?cursor=${cursor}&n=${n}`);
}

export async function getIncidents(params: {
  status?: string;
  severity?: string;
  asset_id?: string;
  page?: number;
  page_size?: number;
} = {}): Promise<PaginatedIncidents> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.severity) query.set('severity', params.severity);
  if (params.asset_id) query.set('asset_id', params.asset_id);
  if (params.page) query.set('page', String(params.page));
  if (params.page_size) query.set('page_size', String(params.page_size));

  return apiFetch<PaginatedIncidents>(`/api/incidents?${query.toString()}`);
}

export async function getIncident(incidentId: number): Promise<Incident> {
  return apiFetch<Incident>(`/api/incidents/${incidentId}`);
}

export async function applyIncidentAction(
  incidentId: number,
  payload: {
    action: string;
    assignee?: string;
    note?: string;
    actor?: string;
  }
): Promise<Incident> {
  return apiFetch<Incident>(`/api/incidents/${incidentId}/action`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
