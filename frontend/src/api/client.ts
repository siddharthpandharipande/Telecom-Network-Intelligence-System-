import {
  ApiError,
  ApiErrorPayload,
  AssetDetail,
  AssetHealthResponse,
  CityRisk,
  CorrelationData,
  DbscanExploreResponse,
  DistributionsData,
  HealthDashboardData,
  HealthLocationsResponse,
  HealthResponse,
  HistoricalTrendsData,
  HourlyData,
  Incident,
  IngestionLogItem,
  IngestionReport,
  InsightsByRegion,
  InsightsOverview,
  InsightsTopAssets,
  TelemetryAnalysisRequest,
  TelemetryAnalysisResponse,
  ChatbotAskRequest,
  ChatbotAskResponse,
  AssetLocationResponse,
  TrendFilterParams,
  TrendFilterOptions,
  PriorityTrendsData,
  AssetTypeTrendsData,
  LocationTrendsData,
  CommonIssuesTrendsData,
  LoginResponse,
  MapPoint,
  ModelCard,
  NetworkLink,
  PaginatedAssets,
  PaginatedIncidents,
  PredictResponse,
  ReplayMeta,
  ReplayResponse,
  ReplaySlice,
  RiskAnomalyMatrix,
  ScatterPoint,
  StatsOverview,
  SystemConfig,
  User,
} from '../types/api';

const API_BASE_URL = ((import.meta as any).env?.VITE_API_BASE_URL as string) ?? '';

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});

  // Automatically attach stored session Bearer token if present
  const storedToken = localStorage.getItem('nexusnet_token');
  if (storedToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${storedToken}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  try {
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
      throw new ApiError(errorPayload, response.statusText, response.status);
    }

    return response.json() as Promise<T>;
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err;
    }
    // If relative proxy fetch failed and no base URL was set, fallback directly to 127.0.0.1:8000
    if (!API_BASE_URL && !url.startsWith('http')) {
      const fallbackUrl = `http://127.0.0.1:8000${endpoint}`;
      try {
        const fbRes = await fetch(fallbackUrl, { ...options, headers });
        if (fbRes.ok) {
          return fbRes.json() as Promise<T>;
        }
      } catch {
        // Fallback also failed, propagate original error
      }
    }
    throw err;
  }
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
  continent?: string;
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
  if (params.continent) query.set('continent', params.continent);
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
  continent?: string;
  city?: string;
  asset_type?: string;
  status?: string;
  is_at_risk?: boolean;
  is_anomaly?: boolean;
  source?: string;
  q?: string;
} = {}): Promise<MapPoint[]> {
  const query = new URLSearchParams();
  if (params.continent) query.set('continent', params.continent);
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

/**
 * Fetch asset health, Version 3 heuristic explanation, and ML model decision-support flags.
 * Calls GET /assets/{asset_id}/health (Requirement 3).
 */
export async function getAssetHealth(assetId: string): Promise<AssetHealthResponse> {
  const cleanId = encodeURIComponent(assetId.trim());
  return apiFetch<AssetHealthResponse>(`/assets/${cleanId}/health`);
}

/**
 * NOC Command Center Insights: Question 1
 * GET /api/insights/overview
 */
export async function getInsightsOverview(): Promise<InsightsOverview> {
  return apiFetch<InsightsOverview>('/api/insights/overview');
}

/**
 * NOC Command Center Insights: Question 2
 * GET /api/insights/by-region
 */
export async function getInsightsByRegion(): Promise<InsightsByRegion> {
  return apiFetch<InsightsByRegion>('/api/insights/by-region');
}

/**
 * NOC Command Center Insights: Question 3
 * GET /api/insights/top-assets
 */
export async function getInsightsTopAssets(): Promise<InsightsTopAssets> {
  return apiFetch<InsightsTopAssets>('/api/insights/top-assets');
}

/**
 * Analyze manual telemetry input in the Analyze Telemetry sandbox
 * POST /api/telemetry/analyze
 */
export async function analyzeTelemetry(
  payload: TelemetryAnalysisRequest
): Promise<TelemetryAnalysisResponse> {
  return apiFetch<TelemetryAnalysisResponse>('/api/telemetry/analyze', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Get latest manual telemetry analysis result for Command Center sync
 * GET /api/telemetry/latest-analysis
 */
export async function getLatestAnalysis(): Promise<TelemetryAnalysisResponse | null> {
  return apiFetch<TelemetryAnalysisResponse | null>('/api/telemetry/latest-analysis');
}

/**
 * Reset latest manual telemetry analysis result (for testing)
 * POST /api/telemetry/reset-analysis
 */
export async function resetLatestAnalysis(): Promise<{ status: string }> {
  return apiFetch<{ status: string }>('/api/telemetry/reset-analysis', {
    method: 'POST',
  });
}

/**
 * Download professional academic PDF report for the latest manual telemetry analysis
 * POST /api/report/generate
 */
export async function downloadPdfReport(
  payload?: TelemetryAnalysisRequest
): Promise<{ success: boolean; filename: string }> {
  const url = `${API_BASE_URL}/api/report/generate`;
  const options: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: payload ? JSON.stringify(payload) : undefined,
  };

  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (err) {
    if (!API_BASE_URL && !url.startsWith('http')) {
      response = await fetch(`http://127.0.0.1:8000/api/report/generate`, options);
    } else {
      throw err;
    }
  }

  if (!response.ok) {
    let errorMsg = `Report generation failed: HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson.detail) errorMsg = errJson.detail;
      else if (errJson.error) errorMsg = errJson.error;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  // Extract filename from Content-Disposition header if available
  let filename = 'NEXUSNET_Network_Health_Report.pdf';
  const disposition = response.headers.get('Content-Disposition');
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename=["']?([^"';]+)["']?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);

  return { success: true, filename };
}

/**
 * Get stored geographic location details for an asset ID
 * GET /api/assets/{asset_id}/location
 */
export async function getAssetLocation(assetId: string): Promise<AssetLocationResponse> {
  return apiFetch<AssetLocationResponse>(`/api/assets/${encodeURIComponent(assetId)}/location`);
}

// ----------------------------------------------------------------------------
// Network Trends Analytics API
// ----------------------------------------------------------------------------
function buildTrendQuery(params?: TrendFilterParams): string {
  if (!params) return '';
  const q = new URLSearchParams();
  if (params.asset_type && !params.asset_type.toLowerCase().startsWith('all')) {
    q.set('asset_type', params.asset_type);
  }
  if (params.country_or_region && !params.country_or_region.toLowerCase().startsWith('all')) {
    q.set('country_or_region', params.country_or_region);
  }
  if (params.priority && !params.priority.toLowerCase().startsWith('all')) {
    q.set('priority', params.priority);
  }
  const str = q.toString();
  return str ? `?${str}` : '';
}

export async function getTrendFilterOptions(): Promise<TrendFilterOptions> {
  return apiFetch<TrendFilterOptions>('/api/insights/trends/filter-options');
}

export async function getTrendsPriority(params?: TrendFilterParams): Promise<PriorityTrendsData> {
  return apiFetch<PriorityTrendsData>(`/api/insights/trends/priority${buildTrendQuery(params)}`);
}

export async function getTrendsByAssetType(params?: TrendFilterParams): Promise<AssetTypeTrendsData> {
  return apiFetch<AssetTypeTrendsData>(`/api/insights/trends/by-asset-type${buildTrendQuery(params)}`);
}

export async function getTrendsByLocation(params?: TrendFilterParams): Promise<LocationTrendsData> {
  return apiFetch<LocationTrendsData>(`/api/insights/trends/by-location${buildTrendQuery(params)}`);
}

export async function getTrendsCommonIssues(params?: TrendFilterParams): Promise<CommonIssuesTrendsData> {
  return apiFetch<CommonIssuesTrendsData>(`/api/insights/trends/common-issues${buildTrendQuery(params)}`);
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

// ----------------------------------------------------------------------------
// Authentication & RBAC API Endpoints
// ----------------------------------------------------------------------------
export async function loginUser(credentials: { username: string; password: string }): Promise<LoginResponse> {
  const data = await apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
  localStorage.setItem('nexusnet_token', data.token);
  localStorage.setItem('nexusnet_user', JSON.stringify(data));
  return data;
}

export async function logoutUser(): Promise<{ message: string; status: string }> {
  try {
    return await apiFetch<{ message: string; status: string }>('/api/auth/logout', {
      method: 'POST',
    });
  } finally {
    localStorage.removeItem('nexusnet_token');
    localStorage.removeItem('nexusnet_user');
  }
}

export async function getCurrentUser(): Promise<User> {
  return apiFetch<User>('/api/auth/me');
}

export async function listAllUsers(): Promise<User[]> {
  return apiFetch<User[]>('/api/auth/users');
}

// ----------------------------------------------------------------------------
// Topology Links API Endpoints
// ----------------------------------------------------------------------------
export async function getTopologyLinks(params: {
  link_type?: string;
  status?: string;
} = {}): Promise<NetworkLink[]> {
  const query = new URLSearchParams();
  if (params.link_type) query.set('link_type', params.link_type);
  if (params.status) query.set('status', params.status);
  return apiFetch<NetworkLink[]>(`/api/topology/links?${query.toString()}`);
}

export async function createTopologyLink(payload: {
  link_id: string;
  source_asset_id: string;
  destination_asset_id: string;
  link_type?: string;
  capacity_gbps?: number;
  utilization_pct?: number;
  status?: string;
}): Promise<NetworkLink> {
  return apiFetch<NetworkLink>('/api/topology/links', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ----------------------------------------------------------------------------
// Simulated Replay API Endpoints
// ----------------------------------------------------------------------------
export async function getReplayMeta(): Promise<ReplayMeta> {
  return apiFetch<ReplayMeta>('/api/replay/meta');
}

export async function getReplaySlice(hour: number): Promise<ReplaySlice> {
  return apiFetch<ReplaySlice>(`/api/replay/slice?hour=${hour}`);
}

// ----------------------------------------------------------------------------
// Network Health Dashboard & Locations API Endpoints
// ----------------------------------------------------------------------------
export async function getHealthLocations(): Promise<HealthLocationsResponse> {
  return apiFetch<HealthLocationsResponse>('/api/health/locations');
}

export async function getHealthDashboard(params: {
  country?: string;
  continent?: string;
  city?: string;
  asset_type?: string;
  status?: string;
  is_at_risk?: boolean;
  is_anomaly?: boolean;
} = {}): Promise<HealthDashboardData> {
  const query = new URLSearchParams();
  if (params.country && params.country !== 'All') query.set('country', params.country);
  if (params.continent && params.continent !== 'All') query.set('continent', params.continent);
  if (params.city && params.city !== 'All') query.set('city', params.city);
  if (params.asset_type && params.asset_type !== 'All') query.set('asset_type', params.asset_type);
  if (params.status && params.status !== 'All') query.set('status', params.status);
  if (params.is_at_risk !== undefined) query.set('is_at_risk', String(params.is_at_risk));
  if (params.is_anomaly !== undefined) query.set('is_anomaly', String(params.is_anomaly));

  return apiFetch<HealthDashboardData>(`/api/health/dashboard?${query.toString()}`);
}

// ----------------------------------------------------------------------------
// Historical Analytics Trends API Endpoint
// ----------------------------------------------------------------------------
export async function getHistoricalTrends(params: {
  start_date?: string;
  end_date?: string;
  asset_id?: string;
} = {}): Promise<HistoricalTrendsData> {
  const query = new URLSearchParams();
  if (params.start_date) query.set('start_date', params.start_date);
  if (params.end_date) query.set('end_date', params.end_date);
  if (params.asset_id) query.set('asset_id', params.asset_id);

  return apiFetch<HistoricalTrendsData>(`/api/analytics/history?${query.toString()}`);
}

// ----------------------------------------------------------------------------
// Reverse Geolocation Coordinate Lookup
// ----------------------------------------------------------------------------
export async function getGeoLookup(lat: number, lng: number): Promise<{
  continent: string | null;
  country: string | null;
  city: string | null;
  region: string | null;
  distance_km?: number | null;
}> {
  return apiFetch<{
    continent: string | null;
    country: string | null;
    city: string | null;
    region: string | null;
    distance_km?: number | null;
  }>(`/api/geo/lookup?lat=${lat}&lng=${lng}`);
}

export async function searchGeoLocation(query: string): Promise<Array<{
  city: string;
  country: string;
  region: string;
  continent: string;
  latitude: number;
  longitude: number;
  label: string;
}>> {
  return apiFetch<Array<{
    city: string;
    country: string;
    region: string;
    continent: string;
    latitude: number;
    longitude: number;
    label: string;
  }>>(`/api/geo/search?q=${encodeURIComponent(query)}`);
}

// ----------------------------------------------------------------------------
// Gemini NOC Assistant Chatbot
// ----------------------------------------------------------------------------
export async function askNocChatbot(payload: ChatbotAskRequest): Promise<ChatbotAskResponse> {
  return apiFetch<ChatbotAskResponse>('/api/chatbot/ask', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function clearNocChatbotSession(sessionId: string): Promise<{ status: string; sessionId: string }> {
  return apiFetch<{ status: string; sessionId: string }>('/api/chatbot/clear', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}



