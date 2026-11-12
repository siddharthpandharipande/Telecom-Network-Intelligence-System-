"""
NEXUSNET Backend API Test Suite
================================
Validates health check, model info metadata, asset decision-support lookups,
and missing asset 404 responses.
"""

import pytest
from fastapi.testclient import TestClient
from backend.main import app, load_backend_data, ASSET_RECORDS, MODEL_SUMMARY


@pytest.fixture(scope="session", autouse=True)
def setup_test_data():
    """Ensure data is loaded once before running test suite."""
    count = load_backend_data()
    assert count == 6000, f"Expected 6,000 records, loaded {count}"


@pytest.fixture
def client():
    """Returns a TestClient instance."""
    with TestClient(app) as test_client:
        yield test_client


def test_health_endpoint(client):
    """GET /health must return status: ok with HTTP 200."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_models_info_endpoint(client):
    """GET /models/info must return asset counts and models used."""
    response = client.get("/models/info")
    assert response.status_code == 200
    data = response.json()

    assert data["assets_loaded"] == 6000
    assert data["investigate_count"] == 1024
    assert data["monitor_count"] == 4976
    assert isinstance(data["models_used"], list)
    assert len(data["models_used"]) >= 2


def test_valid_asset_high_priority(client):
    """GET /assets/{asset_id}/health for AS-CHN-SHA-SH-RT-00001 (Investigate)."""
    asset_id = "AS-CHN-SHA-SH-RT-00001"
    response = client.get(f"/assets/{asset_id}/health")
    assert response.status_code == 200
    data = response.json()

    # Exact 14 required fields
    required_fields = [
        "asset_id",
        "asset_type",
        "investigation_priority",
        "priority_reason",
        "what_happened",
        "why_flagged",
        "what_to_do_next",
        "not_evaluated",
        "limitation",
        "classifier_prediction",
        "classifier_confidence",
        "anomaly_score",
        "is_anomalous",
        "final_decision_support_flag"
    ]
    assert list(data.keys()) == required_fields
    assert data["asset_id"] == asset_id
    assert data["asset_type"] == "Router"
    assert data["investigation_priority"] == "High"
    assert data["classifier_prediction"] == "High"
    assert data["final_decision_support_flag"] == "Investigate"
    assert isinstance(data["classifier_confidence"], float)
    assert isinstance(data["anomaly_score"], float)
    assert isinstance(data["is_anomalous"], bool)


def test_valid_asset_routine_monitor(client):
    """GET /assets/{asset_id}/health for AS-IND-PUN-MH-BS-00002 (Monitor)."""
    asset_id = "AS-IND-PUN-MH-BS-00002"
    response = client.get(f"/assets/{asset_id}/health")
    assert response.status_code == 200
    data = response.json()

    assert data["asset_id"] == asset_id
    assert data["asset_type"] == "Base Station"
    assert data["investigation_priority"] == "Routine"
    assert data["classifier_prediction"] == "Routine"
    assert data["is_anomalous"] is False
    assert data["final_decision_support_flag"] == "Monitor"


def test_valid_asset_anomaly_investigate(client):
    """GET /assets/{asset_id}/health for EU-ESP-MAD-MD-BS-00219 (Anomalous -> Investigate)."""
    asset_id = "EU-ESP-MAD-MD-BS-00219"
    response = client.get(f"/assets/{asset_id}/health")
    assert response.status_code == 200
    data = response.json()

    assert data["asset_id"] == asset_id
    assert data["is_anomalous"] is True
    assert data["final_decision_support_flag"] == "Investigate"


def test_invalid_asset_not_found(client):
    """GET /assets/{asset_id}/health for non-existent asset ID returns 404."""
    invalid_id = "NON_EXISTENT_ASSET_XYZ"
    response = client.get(f"/assets/{invalid_id}/health")
    assert response.status_code == 404
    data = response.json()

    assert data == {
        "error": "Asset not found",
        "asset_id": invalid_id
    }


def test_cors_headers(client):
    """Verify CORS preflight handling."""
    response = client.options(
        "/assets/AS-CHN-SHA-SH-RT-00001/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET"
        }
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") in ["*", "http://localhost:3000"]


def test_insights_overview_endpoint(client):
    """GET /api/insights/overview returns Box 1 problem size metrics."""
    response = client.get("/api/insights/overview")
    assert response.status_code == 200
    data = response.json()
    assert data["total_assets"] == 6000
    assert data["investigate_count"] == 1024
    assert data["monitor_count"] == 4976
    assert data["high_priority_count"] == 929
    assert data["anomalous_count"] == 300
    assert "require investigation" in data["suggestion"]


def test_insights_by_region_endpoint(client):
    """GET /api/insights/by-region returns Box 2 geographic distribution."""
    response = client.get("/api/insights/by-region")
    assert response.status_code == 200
    data = response.json()
    assert data["most_affected_city"] != "Unknown"
    assert data["city_high_priority_count"] > 0
    assert data["most_affected_country"] != "Unknown"
    assert data["country_high_priority_count"] > 0
    assert data["most_affected_continent"] != "Unknown"
    assert data["most_affected_asset_type"] != "Unknown"
    assert "Locate on Map" in data["suggestion"]


def test_insights_top_assets_endpoint(client):
    """GET /api/insights/top-assets returns Box 3 top 5 assets including test asset."""
    response = client.get("/api/insights/top-assets")
    assert response.status_code == 200
    data = response.json()
    assert "assets" in data
    assert len(data["assets"]) == 5
    # Verify primary test asset is present
    asset_ids = [a["asset_id"] for a in data["assets"]]
    assert "OC-AUS-SYD-NSW-GW-02451" in asset_ids
    # Verify required table fields
    first = data["assets"][0]
    for field in ["asset_id", "asset_type", "investigation_priority", "main_issue", "city", "action"]:
        assert field in first
    assert "Start with the highest-priority asset" in data["suggestion"]


def test_asset_location_found(client):
    """GET /api/assets/{asset_id}/location returns stored geographic details."""
    response = client.get("/api/assets/OC-AUS-SYD-NSW-GW-02451/location")
    assert response.status_code == 200
    data = response.json()
    assert data["asset_id"] == "OC-AUS-SYD-NSW-GW-02451"
    assert data["city"] == "Sydney"
    assert data["region"] == "NSW"
    assert data["country"] == "Australia"
    assert data["continent"] == "Oceania"
    assert data["latitude"] is not None
    assert data["longitude"] is not None


def test_asset_location_not_found(client):
    """GET /api/assets/{asset_id}/location returns 404 for unknown asset."""
    response = client.get("/api/assets/NON-EXISTENT-ASSET-XYZ/location")
    assert response.status_code == 404
    data = response.json()
    assert data["error"] == "Asset location not found"


def test_telemetry_analyze_known_asset(client):
    """POST /api/telemetry/analyze evaluates telemetry and attaches stored location."""
    payload = {
        "asset_id": "OC-AUS-SYD-NSW-GW-02451",
        "latency": 215.84,
        "loss": 4.5,
        "load": 91.2,
    }
    response = client.post("/api/telemetry/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["asset_id"] == "OC-AUS-SYD-NSW-GW-02451"
    assert data["investigation_priority"] == "High"
    assert data["final_decision_support_flag"] == "Investigate"
    assert "Latency" in data["main_issue"]
    assert len(data["recommended_actions"]) > 0
    assert data["city"] == "Sydney"
    assert data["region"] == "NSW"
    assert data["country"] == "Australia"
    assert data["latitude"] is not None
    assert data["longitude"] is not None
    assert data["location_message"] is None
    assert "investigation because severe" in data["box1_suggestion"]
    assert "transport-path latency" in data["box2_suggestion"]


def test_telemetry_analyze_no_id_missing_location(client):
    """POST /api/telemetry/analyze with no ID returns analysis but flags missing location."""
    payload = {
        "latency": 45.0,
        "loss": 0.5,
        "load": 50.0,
    }
    response = client.post("/api/telemetry/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["investigation_priority"] == "Routine"
    assert data["final_decision_support_flag"] == "Monitor"
    assert data["latitude"] is None
    assert data["longitude"] is None
    assert data["city"] is None
    assert "Location cannot be shown unless" in data["location_message"]


def test_telemetry_latest_and_reset(client):
    """GET and POST /api/telemetry/reset-analysis clear and retrieve state."""
    # Reset
    reset_res = client.post("/api/telemetry/reset-analysis")
    assert reset_res.status_code == 200

    # Get latest -> null
    get_res = client.get("/api/telemetry/latest-analysis")
    assert get_res.status_code == 200
    assert get_res.json() is None

    # Submit
    client.post("/api/telemetry/analyze", json={"asset_id": "OC-AUS-SYD-NSW-GW-02451", "latency": 190.0})
    get_res2 = client.get("/api/telemetry/latest-analysis")
    assert get_res2.status_code == 200
    assert get_res2.json()["asset_id"] == "OC-AUS-SYD-NSW-GW-02451"


def test_trend_filter_options(client):
    """GET /api/insights/trends/filter-options returns available filter choices."""
    response = client.get("/api/insights/trends/filter-options")
    assert response.status_code == 200
    data = response.json()
    assert "Router" in data["asset_types"]
    assert "Cell Tower" in data["asset_types"]
    assert "India" in data["countries_and_regions"]
    assert "High" in data["priorities"]


def test_trend_priority_unfiltered_and_filtered(client):
    """GET /api/insights/trends/priority returns 3 priority tiers and dynamic suggestion."""
    # Reset analysis to test baseline 6000 assets
    client.post("/telemetry/reset-analysis")

    # Unfiltered
    res = client.get("/api/insights/trends/priority")
    assert res.status_code == 200
    data = res.json()
    assert data["total_assets"] == 6000
    assert data["investigate_count"] == 1024
    assert len(data["items"]) == 3
    assert "assets need investigation. Start with High-priority assets." in data["suggestion"]

    # Filtered by asset_type=Router
    res_filt = client.get("/api/insights/trends/priority?asset_type=Router")
    assert res_filt.status_code == 200
    d_filt = res_filt.json()
    assert d_filt["total_assets"] == 1537
    assert d_filt["investigate_count"] > 0
    assert "assets need investigation. Start with High-priority assets." in d_filt["suggestion"]


def test_trend_by_asset_type(client):
    """GET /api/insights/trends/by-asset-type returns high priority % for the 4 asset types."""
    client.post("/telemetry/reset-analysis")
    res = client.get("/api/insights/trends/by-asset-type")
    assert res.status_code == 200
    data = res.json()
    assert len(data["items"]) == 4
    asset_types = [item["asset_type"] for item in data["items"]]
    assert "Router" in asset_types
    assert "Network Gateway" in asset_types
    assert "Cell Tower" in asset_types
    assert "Base Station" in asset_types
    assert "have the highest share of high-priority assets" in data["suggestion"]


def test_trend_by_location(client):
    """GET /api/insights/trends/by-location returns top cities by high priority assets."""
    client.post("/telemetry/reset-analysis")
    # Unfiltered
    res = client.get("/api/insights/trends/by-location")
    assert res.status_code == 200
    data = res.json()
    assert len(data["items"]) > 0
    assert data["top_location"] is not None
    assert "has the most high-priority assets. Use the Network Map to inspect this area." in data["suggestion"]

    # Filtered by Country=India
    res_india = client.get("/api/insights/trends/by-location?country_or_region=India")
    assert res_india.status_code == 200
    d_india = res_india.json()
    assert len(d_india["items"]) > 0
    assert "has the most high-priority assets. Use the Network Map to inspect this area." in d_india["suggestion"]


def test_trend_common_issues(client):
    """GET /api/insights/trends/common-issues returns breached measurement counts."""
    client.post("/telemetry/reset-analysis")
    res = client.get("/api/insights/trends/common-issues")
    assert res.status_code == 200
    data = res.json()
    assert len(data["items"]) > 0
    meas_names = [i["measurement"] for i in data["items"]]
    assert "Packet Loss" in meas_names
    assert "Latency" in meas_names
    assert "Traffic Load" in meas_names
    assert "Resource Utilization" in meas_names
    assert "is the most common issue." in data["suggestion"]


def test_manual_telemetry_incorporation_in_network_trends(client):
    """
    Submitting manual telemetry dynamically includes 1 extra record (6,001 total)
    in Network Trends calculations without modifying raw CSVs or saved predictions.
    When a new manual analysis is submitted, it replaces the previous temporary record.
    """
    # 1. Reset: verify baseline 6000 assets
    client.post("/telemetry/reset-analysis")
    baseline = client.get("/api/insights/trends/priority").json()
    assert baseline["total_assets"] == 6000
    assert baseline["investigate_count"] == 1024
    assert baseline["has_manual_analysis"] is False

    # 2. Submit high-priority manual telemetry with coordinates
    payload_high = {
        "asset_id": "TWR-IND-999",
        "asset_type": "Cell Tower 5G-NR",
        "latitude": 19.0760,
        "longitude": 72.8377,
        "latency_ms": 215.84,
        "packet_loss_pct": 4.5,
        "traffic_load_pct": 91.2,
        "resource_utilization_pct": 88.5,
    }
    analyze_res = client.post("/api/telemetry/analyze", json=payload_high)
    assert analyze_res.status_code == 200
    analysis = analyze_res.json()
    assert analysis["investigation_priority"] == "High"
    assert analysis["final_decision_support_flag"] == "Investigate"
    # Auto-resolved location from coordinates
    assert analysis["city"] == "Mumbai"

    # 3. Check Priority Trends: now 6,001 assets, 1,025 investigate count
    prio_res = client.get("/api/insights/trends/priority").json()
    assert prio_res["total_assets"] == 6001
    assert prio_res["investigate_count"] == 1025
    assert prio_res["has_manual_analysis"] is True
    assert prio_res["manual_asset_id"] == "TWR-IND-999"
    assert "1,025 assets need investigation" in prio_res["suggestion"]

    # 4. Check Asset Type Trends: Cell Tower count should be 1509 (was 1508)
    type_res = client.get("/api/insights/trends/by-asset-type").json()
    assert type_res["has_manual_analysis"] is True
    cell_tower_item = next(i for i in type_res["items"] if i["asset_type"] == "Cell Tower")
    assert cell_tower_item["total_count"] == 1509

    # 5. Check Location Trends: has_manual_analysis is True and filtered by India includes Mumbai
    loc_res = client.get("/api/insights/trends/by-location").json()
    assert loc_res["has_manual_analysis"] is True
    loc_res_india = client.get("/api/insights/trends/by-location?country_or_region=India").json()
    assert loc_res_india["has_manual_analysis"] is True
    mumbai_item = next(i for i in loc_res_india["items"] if i["location"] == "Mumbai")
    assert mumbai_item["total_count"] > 0

    # 6. Check Common Issues Trends: Latency count should have increased
    issues_res = client.get("/api/insights/trends/common-issues").json()
    assert issues_res["has_manual_analysis"] is True

    # 7. Replace with a second manual telemetry record (Routine / Normal)
    payload_routine = {
        "asset_id": "TWR-IND-001",
        "asset_type": "Router",
        "latitude": 19.2183,
        "longitude": 72.9781,
        "latency_ms": 25.0,
        "packet_loss_pct": 0.1,
        "traffic_load_pct": 40.0,
        "resource_utilization_pct": 35.0,
    }
    client.post("/api/telemetry/analyze", json=payload_routine)

    # Total must STILL be 6001 (replaces previous, does NOT stack to 6002)
    prio_res2 = client.get("/api/insights/trends/priority").json()
    assert prio_res2["total_assets"] == 6001
    assert prio_res2["investigate_count"] == 1024  # Routine record, not investigate
    assert prio_res2["has_manual_analysis"] is True
    assert prio_res2["manual_asset_id"] == "TWR-IND-001"

    # Reset cleans up
    client.post("/telemetry/reset-analysis")
    clean = client.get("/api/insights/trends/priority").json()
    assert clean["total_assets"] == 6000
    assert clean["has_manual_analysis"] is False


def test_generate_report_no_data_returns_400(client):
    """POST /api/report/generate returns 400 when no analysis exists and no payload provided."""
    client.post("/api/telemetry/reset-analysis")
    response = client.post("/api/report/generate")
    assert response.status_code == 400
    assert "error" in response.json()


def test_generate_report_sydney_gateway_pdf(client):
    """
    POST /api/report/generate generates an academic 4-page NOC PDF report
    with exact Sydney Gateway telemetry matching all 10 mandated sections.
    """
    import io
    import pypdf

    payload = {
        "asset_id": "OC-AUS-SYD-NSW-GW-02451",
        "asset_type": "Network Gateway",
        "latitude": -33.8688,
        "longitude": 151.2093,
        "signal_strength_dbm": -98.45,
        "latency_ms": 215.84,
        "packet_loss_pct": 7.69,
        "throughput_mbps": 103.99,
        "connected_users": 6893,
        "traffic_load_pct": 86.51,
        "call_drop_rate_pct": 1.41,
        "resource_utilization_pct": 100.00,
    }

    # 1. First analyze telemetry
    analyze_res = client.post("/api/telemetry/analyze", json=payload)
    assert analyze_res.status_code == 200
    analysis = analyze_res.json()
    assert analysis["investigation_priority"] == "High"
    assert analysis["final_decision_support_flag"] == "Investigate"
    assert analysis["city"] == "Sydney"
    assert len(analysis["not_evaluated"]) >= 2

    # 2. Generate PDF report using the endpoint
    report_res = client.post("/api/report/generate", json=payload)
    assert report_res.status_code == 200
    assert "application/pdf" in report_res.headers.get("content-type", "")
    assert "attachment" in report_res.headers.get("content-disposition", "")

    pdf_bytes = io.BytesIO(report_res.content)
    reader = pypdf.PdfReader(pdf_bytes)

    # 3. Exactly 4 pages
    assert len(reader.pages) == 4

    # 4. Check Page 1: Header, Executive Summary, 3 questions
    p1 = reader.pages[0].extract_text()
    assert "NEXUSNET Network Health Intelligence Report" in p1
    assert "OC-AUS-SYD-NSW-GW-02451" in p1
    assert "Network Gateway" in p1
    assert "Sydney, New South Wales, Australia" in p1
    assert "Question 1:" in p1
    assert "Question 2:" in p1
    assert "Question 3:" in p1
    assert "Page 1 of 4" in p1

    # 5. Check Page 2: Telemetry Table, Command Center Insights
    p2 = reader.pages[1].extract_text()
    assert "3. Current Telemetry Analysis" in p2
    assert "Severe breach" in p2
    assert "Not evaluated" in p2
    assert "4. Command Center Insights" in p2
    assert "Random Forest Model:" in p2
    assert "Page 2 of 4" in p2

    # 6. Check Page 3: Network Trends & Evidence
    p3 = reader.pages[2].extract_text()
    assert "5. Network Trends Insights" in p3
    assert "6,001 assets" in p3
    assert "6. Evidence and Explanation" in p3
    assert "Mandatory Governance Notice:" in p3
    assert "Page 3 of 4" in p3

    # 7. Check Page 4: Recommendations, Location Card, Disclaimer
    p4 = reader.pages[3].extract_text()
    assert "7. NOC Recommendations: Recommended Future Steps for NOC" in p4
    assert "[ ]" in p4
    assert "8. Location and Network Map" in p4
    assert "/network-map" in p4
    assert "9. Limitations and Disclaimer" in p4
    assert "Page 4 of 4" in p4


def test_env_config_loaded_safe(monkeypatch):
    """
    Validates that environment variables are loaded safely from backend/.env,
    GEMINI_API_KEY is recognized, placeholder is flagged as not configured,
    and secrets are never exposed in representations.
    """
    from backend.app.core.config import Settings

    monkeypatch.setenv("GEMINI_API_KEY", "your_gemini_api_key_here")
    s = Settings()
    assert s.GEMINI_MODEL in ("gemini-2.0-flash", "gemini-2.5-flash")
    assert s.BACKEND_PORT == 8000
    assert s.FRONTEND_URL == "http://localhost:5173"

    # Placeholder must be treated as unconfigured
    assert s.is_gemini_configured is False
    assert s.masked_api_key == "<NOT_CONFIGURED>"

    # Key must NEVER appear in __repr__
    repr_str = repr(s)
    assert "your_gemini_api_key_here" not in repr_str
    assert "GEMINI_API_KEY" not in repr_str
    assert "GEMINI_CONFIGURED=False" in repr_str


def test_env_config_with_custom_key(monkeypatch):
    """
    Validates that when a real key is present, is_gemini_configured is True,
    masked_api_key masks the secret, and __repr__ never leaks the key.
    """
    from backend.app.core.config import Settings

    test_key = "AIzaSyTestSecret123456789XYZ"
    monkeypatch.setenv("GEMINI_API_KEY", test_key)

    s = Settings()
    assert s.is_gemini_configured is True
    assert s.masked_api_key == "AIza...YZ"
    assert test_key not in repr(s)
    assert "GEMINI_CONFIGURED=True" in repr(s)


def test_chatbot_empty_question_returns_400(client):
    """
    Chatbot endpoint must reject empty or whitespace questions with 400 Bad Request.
    """
    resp1 = client.post("/api/chatbot/ask", json={"question": ""})
    assert resp1.status_code == 400
    assert "empty" in resp1.json()["detail"].lower()

    resp2 = client.post("/api/chatbot/ask", json={"question": "   \n\t  "})
    assert resp2.status_code == 400
    assert "empty" in resp2.json()["detail"].lower()


def test_chatbot_excessive_length_returns_400(client):
    """
    Chatbot endpoint must reject questions exceeding 1000 characters with 400 Bad Request.
    """
    long_q = "A" * 1001
    resp = client.post("/api/chatbot/ask", json={"question": long_q})
    assert resp.status_code == 400
    assert "1000" in resp.json()["detail"]


def test_chatbot_unconfigured_key_advisory(client, monkeypatch):
    """
    When Gemini API key is placeholder or unconfigured, the chatbot returns
    a friendly advisory message without crashing or exposing errors.
    """
    from backend.app.services.gemini_chat_service import get_gemini_chat_service

    svc = get_gemini_chat_service()
    # Temporarily force is_configured to return False
    monkeypatch.setattr(svc, "is_configured", lambda: False)

    resp = client.post(
        "/api/chatbot/ask",
        json={"question": "What is the status of the network?"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "Gemini API key is not configured" in data["answer"]
    assert "Environment Configuration" in data["sources"]
    assert "sessionId" in data
    assert "timestamp" in data


def test_chatbot_mocked_exchange_and_session_continuity(client, monkeypatch):
    """
    Validates end-to-end conversation flow, grounding context injection,
    and session history tracking with Sydney Gateway telemetry.
    """
    # 1. Post Sydney Gateway telemetry
    sydney_payload = {
        "asset_id": "OC-AUS-SYD-NSW-GW-02451",
        "asset_type": "Network Gateway",
        "region": "Australia",
        "city": "Sydney",
        "country": "Australia",
        "continent": "Oceania",
        "latitude": -33.8688,
        "longitude": 151.2093,
        "latency_ms": 178.5,
        "packet_loss_pct": 5.8,
        "resource_utilization_pct": 82.0,
        "traffic_load_mbps": 845.0,
        "signal_strength_dbm": -999.0,
        "call_drop_rate_pct": -999.0,
    }
    client.post("/api/telemetry/analyze", json=sydney_payload)

    from backend.app.services.gemini_chat_service import get_gemini_chat_service, SESSION_HISTORY

    svc = get_gemini_chat_service()
    monkeypatch.setattr(svc, "is_configured", lambda: True)

    async def mock_generate_sdk(system_prompt, history, user_question):
        return "Asset OC-AUS-SYD-NSW-GW-02451 indicates investigation priority due to severe latency (178.5 ms) and packet loss (5.8%)."

    monkeypatch.setattr(svc, "generate_response_gemini_sdk", mock_generate_sdk)

    session_id = "test-session-noc-001"
    resp = client.post(
        "/api/chatbot/ask",
        json={
            "question": "Why is this asset flagged for investigation?",
            "sessionId": session_id,
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["sessionId"] == session_id
    assert "178.5 ms" in data["answer"]
    assert "Current Manual Telemetry Analysis" in data["sources"]

    # Verify session history recorded the turn
    assert session_id in SESSION_HISTORY
    assert len(SESSION_HISTORY[session_id]) == 2
    assert SESSION_HISTORY[session_id][0]["role"] == "user"
    assert SESSION_HISTORY[session_id][1]["role"] == "model"

    # Test clear session endpoint
    clear_resp = client.post("/api/chatbot/clear", json={"sessionId": session_id})
    assert clear_resp.status_code == 200
    assert SESSION_HISTORY[session_id] == []



