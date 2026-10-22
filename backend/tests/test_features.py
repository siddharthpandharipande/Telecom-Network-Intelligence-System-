"""Automated integration tests for new features: Auth & RBAC, Topology, Replay, Health Dashboard, and History."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_auth_login_and_logout(client: TestClient):
    """Test authentication flow for admin, engineer, and analyst, plus invalid credentials."""
    # 1. Invalid login
    res_bad = client.post("/api/auth/login", json={"username": "admin", "password": "WrongPassword"})
    assert res_bad.status_code == 401
    assert res_bad.json()["code"] == "INVALID_CREDENTIALS"

    # 2. Valid admin login
    res_admin = client.post("/api/auth/login", json={"username": "admin", "password": "NocAdmin@2026"})
    assert res_admin.status_code == 200
    data = res_admin.json()
    assert "token" in data
    assert data["role"] == "admin"
    admin_token = data["token"]

    # 3. /api/auth/me with Bearer token
    res_me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_me.status_code == 200
    assert res_me.json()["username"] == "admin"

    # 4. /api/auth/users (admin only)
    res_users = client.get("/api/auth/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_users.status_code == 200
    assert len(res_users.json()) >= 3

    # 5. Analyst login and attempt to access /api/auth/users (should be forbidden 403)
    res_analyst = client.post("/api/auth/login", json={"username": "analyst", "password": "Analyst@2026"})
    assert res_analyst.status_code == 200
    analyst_token = res_analyst.json()["token"]

    res_forbidden = client.get("/api/auth/users", headers={"Authorization": f"Bearer {analyst_token}"})
    assert res_forbidden.status_code == 403
    assert res_forbidden.json()["code"] == "FORBIDDEN"

    # 6. Logout
    res_logout = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_logout.status_code == 200

    # 7. Post-logout /me should fail with 401
    res_post_logout = client.get("/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_post_logout.status_code == 401


def test_topology_links_api(client: TestClient):
    """Test network topology links query, validation, and demo labeling."""
    # 1. Query seeded topology links
    res = client.get("/api/topology/links")
    assert res.status_code == 200
    links = res.json()
    assert len(links) >= 10
    first = links[0]
    assert "source_lat" in first
    assert "dest_lat" in first
    assert first["is_synthetic"] is True  # Critical data-integrity check: must be explicitly labeled synthetic!

    # 2. Filter by link type
    res_fiber = client.get("/api/topology/links?link_type=fiber")
    assert res_fiber.status_code == 200
    for l in res_fiber.json():
        assert l["link_type"] == "fiber"

    # 3. Create link with invalid self-link (should return 400)
    res_admin = client.post("/api/auth/login", json={"username": "admin", "password": "NocAdmin@2026"})
    admin_token = res_admin.json()["token"]

    res_self = client.post(
        "/api/topology/links",
        json={
            "link_id": "TEST-SELF-LINK",
            "source_asset_id": first["source_asset_id"],
            "destination_asset_id": first["source_asset_id"],
            "link_type": "fiber",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_self.status_code == 400
    assert res_self.json()["code"] == "INVALID_SELF_LINK"


def test_simulated_replay_endpoints(client: TestClient):
    """Test simulated historical replay metadata and hour-by-hour slicing."""
    # 1. Replay metadata
    res_meta = client.get("/api/replay/meta")
    assert res_meta.status_code == 200
    meta = res_meta.json()
    assert meta["snapshot_date"] == "2026-09-16"
    assert len(meta["distinct_hours"]) == 24
    assert meta["total_readings"] >= 6000

    # 2. Replay slice for hour 12
    res_slice = client.get("/api/replay/slice?hour=12")
    assert res_slice.status_code == 200
    data = res_slice.json()
    assert data["hour"] == 12
    assert data["count"] > 0
    assert len(data["readings"]) > 0
    point = data["readings"][0]
    assert "latitude" in point
    assert "longitude" in point
    assert "status" in point


def test_health_dashboard_overview(client: TestClient):
    """Test comprehensive network health dashboard KPIs, formulas, and filters."""
    # 1. Full database health dashboard
    res = client.get("/api/health/dashboard")
    assert res.status_code == 200
    data = res.json()

    kpis = data["kpis"]
    assert kpis["total_assets"] >= 6000
    assert kpis["normal_assets"] + kpis["at_risk_assets"] == kpis["total_assets"]
    assert 0 <= kpis["aggregate_health_score"] <= 100
    assert kpis["health_category"] in ["Healthy", "Warning", "Critical"]
    assert "avg_nsi" in kpis
    assert "avg_signal_strength_dbm" in kpis
    assert "avg_latency_ms" in kpis

    # Check charts and documentation
    charts = data["charts"]
    assert "svm_distribution" in charts
    assert "dbscan_distribution" in charts
    assert "nsi_distribution" in charts
    assert "latency_packet_loss" in charts

    doc = data["documentation"]
    assert "NSI = (Traffic Load + Resource Utilization + Packet Loss + Call Drop Rate) / 4" in doc["nsi_formula"]

    # 2. Filtered query by country=India
    res_india = client.get("/api/health/dashboard?country=India")
    assert res_india.status_code == 200
    kpis_india = res_india.json()["kpis"]
    assert kpis_india["total_assets"] > 0
    assert kpis_india["total_assets"] < kpis["total_assets"]


def test_historical_analytics_trends(client: TestClient):
    """Test historical trends endpoint."""
    res = client.get("/api/analytics/history")
    assert res.status_code == 200
    data = res.json()
    assert "timeline" in data
    assert len(data["timeline"]) > 0
    first = data["timeline"][0]
    assert "avg_latency" in first
    assert "avg_nsi" in first
    assert "at_risk_count" in first
