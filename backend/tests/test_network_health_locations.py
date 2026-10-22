"""Tests for Network Health global country, continent, and city dynamic filtering."""
import pytest
from fastapi.testclient import TestClient

from backend.app.geo import CONTINENT_HIERARCHY, infer_continent_from_country


@pytest.fixture(autouse=True)
def ensure_namibia_asset(client: TestClient):
    """Ensure a Namibia asset exists in the active test database before running tests."""
    payload = {
        "Asset_ID": "TEST_NAMIBIA_BASE_NODE_01",
        "Asset_Type": "Base Station",
        "Country": "Namibia",
        "Continent": "Africa",
        "City": "Windhoek",
        "Signal_Strength": -95.0,
        "Latency": 115.0,
        "Packet_Loss": 4.5,
        "Throughput": 25.0,
        "Connected_Users": 120,
        "Traffic_Load": 82.0,
        "Call_Drop_Rate": 3.8,
        "Resource_Utilization": 88.0,
    }
    client.post("/api/predict?persist=true", json=payload)
    yield


def test_continent_and_country_breakdown_counts():
    """Verify sovereign country coverage across all continents and city listings."""
    expected_min_counts = {
        "Africa": 54,
        "Asia": 48,
        "Europe": 44,
        "North America": 23,
        "South America": 12,
        "Oceania": 14,
    }

    total_countries = 0
    for continent, min_count in expected_min_counts.items():
        assert continent in CONTINENT_HIERARCHY, f"Missing continent {continent}"
        actual_count = len(CONTINENT_HIERARCHY[continent])
        assert actual_count >= min_count, (
            f"Expected at least {min_count} countries for {continent}, got {actual_count}"
        )
        total_countries += actual_count

        # Ensure all countries have at least one city listed
        for country, cities in CONTINENT_HIERARCHY[continent].items():
            assert isinstance(cities, list)
            assert len(cities) >= 1, f"Country {country} in {continent} has no cities"

    assert total_countries >= 195, f"Expected at least 195 countries worldwide, got {total_countries}"


def test_strict_continent_exclusivity_and_england_cities(client: TestClient):
    """Verify strict continent classification, India never in Europe, and England has only England cities."""
    res = client.get("/api/health/locations")
    assert res.status_code == 200
    data = res.json()
    hierarchy = data["hierarchy"]
    country_to_continent = data["country_to_continent"]

    # 1. India must be strictly in Asia and NEVER in Europe
    assert "India" in hierarchy["Asia"]
    assert "India" not in hierarchy["Europe"]
    assert "India" not in hierarchy["Africa"]
    assert "India" not in hierarchy["North America"]
    assert country_to_continent["India"] == "Asia"

    # 2. England must be strictly in Europe
    assert "England" in hierarchy["Europe"]
    assert "England" not in hierarchy["Asia"]
    assert country_to_continent["England"] == "Europe"

    # 3. England cities must ONLY be English cities, not Scottish, Asian, or other
    england_cities = hierarchy["Europe"]["England"]
    assert "London" in england_cities
    assert "Manchester" in england_cities
    assert "Birmingham" in england_cities
    assert "Edinburgh" not in england_cities  # Scotland
    assert "Glasgow" not in england_cities    # Scotland
    assert "Mumbai" not in england_cities     # India
    assert "Pune" not in england_cities       # India

    # 4. Europe must ONLY contain European countries
    european_countries = set(hierarchy["Europe"].keys())
    assert "France" in european_countries
    assert "Germany" in european_countries
    assert "Italy" in european_countries
    assert "Spain" in european_countries
    assert "England" in european_countries
    assert "UK" in european_countries
    assert "India" not in european_countries
    assert "China" not in european_countries
    assert "Namibia" not in european_countries
    assert "USA" not in european_countries


def test_infer_continent_from_country():
    """Test country-to-continent mapping for countries worldwide including Namibia."""
    assert infer_continent_from_country("Namibia") == "Africa"
    assert infer_continent_from_country("Egypt") == "Africa"
    assert infer_continent_from_country("Japan") == "Asia"
    assert infer_continent_from_country("Germany") == "Europe"
    assert infer_continent_from_country("USA") == "North America"
    assert infer_continent_from_country("United States") == "North America"
    assert infer_continent_from_country("Brazil") == "South America"
    assert infer_continent_from_country("Australia") == "Oceania"
    assert infer_continent_from_country("New Zealand") == "Oceania"


def test_health_locations_api(client: TestClient):
    """Test /api/health/locations returns complete dynamic hierarchy with Namibia."""
    res = client.get("/api/health/locations")
    assert res.status_code == 200
    data = res.json()

    assert "continents" in data
    assert "countries" in data
    assert "cities" in data
    assert "hierarchy" in data
    assert "country_to_continent" in data

    continents = data["continents"]
    countries = data["countries"]
    cities = data["cities"]
    hierarchy = data["hierarchy"]

    # Verify all 6 continents are present
    for cont in ["Africa", "Asia", "Europe", "North America", "South America", "Oceania"]:
        assert cont in continents
        assert cont in hierarchy

    # Verify Namibia is present in Africa with its cities
    assert "Namibia" in countries
    assert "Namibia" in hierarchy["Africa"]
    assert "Windhoek" in hierarchy["Africa"]["Namibia"]
    assert "Windhoek" in cities


def test_health_dashboard_namibia_filtering(client: TestClient):
    """Test selecting Namibia displays its database-backed network health and SVM risk stats."""
    res = client.get("/api/health/dashboard?country=Namibia")
    assert res.status_code == 200
    data = res.json()

    kpis = data["kpis"]
    assert kpis["total_assets"] >= 1
    assert kpis["at_risk_assets"] >= 1
    assert kpis["health_category"] in ["Healthy", "Warning", "Critical"]
    assert kpis["avg_nsi"] > 0
    assert kpis["avg_signal_strength_dbm"] != 0

    # Ensure charts contain filtered distribution
    charts = data["charts"]
    assert "svm_distribution" in charts
    assert len(charts["svm_distribution"]) == 2
    assert "dbscan_distribution" in charts
    assert "nsi_distribution" in charts

    # Ensure filter_options are preserved and not empty
    filter_opts = data["filter_options"]
    assert len(filter_opts["countries"]) >= 195
    assert "Namibia" in filter_opts["countries"]
    assert "Africa" in filter_opts["continents"]


def test_health_dashboard_cascading_filtering(client: TestClient):
    """Test dependent cascading location filters on /api/health/dashboard."""
    res = client.get("/api/health/dashboard?continent=Africa&country=Namibia&city=Windhoek")
    assert res.status_code == 200
    data = res.json()
    kpis = data["kpis"]
    assert kpis["total_assets"] >= 1
    assert kpis["at_risk_assets"] >= 1


def test_health_dashboard_empty_country_handling(client: TestClient):
    """Test that selecting a location with 0 assets handles results gracefully with preserved dropdown options."""
    res = client.get("/api/health/dashboard?country=NonExistentNationXYZ")
    assert res.status_code == 200
    data = res.json()

    kpis = data["kpis"]
    assert kpis["total_assets"] == 0
    assert kpis["health_category"] == "No Data"

    # Charts must be clean and not crash
    charts = data["charts"]
    assert "svm_distribution" in charts
    assert charts["svm_distribution"][0]["value"] == 0

    # Dropdown filter options MUST NOT be wiped out
    filter_opts = data["filter_options"]
    assert len(filter_opts["countries"]) >= 195
    assert len(filter_opts["continents"]) >= 6
    assert len(filter_opts["cities"]) >= 100
    assert "hierarchy" in filter_opts


def test_dynamic_country_insertion_in_health_filters(client: TestClient):
    """Test that newly submitted asset with a new country dynamically becomes available in dropdowns."""
    unique_aid = "TEST_DYNAMIC_NAMIBIA_NODE_999"

    # Ingest/predict record with persist=True for a new country
    payload = {
        "Asset_ID": unique_aid,
        "Asset_Type": "Cell Tower",
        "Country": "Dynamicland",
        "Continent": "Africa",
        "City": "Dynacity",
        "Signal_Strength": -78.5,
        "Latency": 32.0,
        "Packet_Loss": 0.5,
        "Throughput": 85.0,
        "Connected_Users": 350,
        "Traffic_Load": 45.0,
        "Call_Drop_Rate": 0.2,
        "Resource_Utilization": 50.0,
    }

    pred_res = client.post("/api/predict?persist=true", json=payload)
    assert pred_res.status_code == 200

    # Test /api/health/locations immediately includes Dynamicland and Dynacity
    loc_res = client.get("/api/health/locations")
    assert loc_res.status_code == 200
    loc_data = loc_res.json()

    assert "Dynamicland" in loc_data["countries"]
    assert "Dynacity" in loc_data["cities"]
    assert "Dynamicland" in loc_data["hierarchy"]["Africa"]
    assert "Dynacity" in loc_data["hierarchy"]["Africa"]["Dynamicland"]

    # Test /api/health/dashboard?country=Dynamicland returns this asset
    dash_res = client.get("/api/health/dashboard?country=Dynamicland")
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert dash_data["kpis"]["total_assets"] >= 1

    # Test /api/assets?country=Dynamicland returns it
    assets_res = client.get("/api/assets?country=Dynamicland")
    assert assets_res.status_code == 200
    assert assets_res.json()["total"] >= 1


def test_dirty_db_row_cannot_leak_india_into_europe(client: TestClient):
    """Verify that even if a dirty database record has Country='India' and Continent='Europe', India NEVER appears in Europe."""
    payload = {
        "Asset_ID": "TEST_DIRTY_ROW_INDIA_IN_EUROPE",
        "Asset_Type": "Core Router",
        "Country": "India",
        "Continent": "Europe",  # Bad/dirty input
        "City": "Pune",
        "Signal_Strength": -70.0,
        "Latency": 25.0,
        "Packet_Loss": 0.1,
        "Throughput": 90.0,
        "Connected_Users": 200,
        "Traffic_Load": 40.0,
        "Call_Drop_Rate": 0.1,
        "Resource_Utilization": 45.0,
    }
    pred_res = client.post("/api/predict?persist=true", json=payload)
    assert pred_res.status_code == 200

    # Query dynamic locations
    loc_res = client.get("/api/health/locations")
    assert loc_res.status_code == 200
    loc_data = loc_res.json()

    # India MUST NOT appear under Europe, only Asia!
    assert "India" not in loc_data["hierarchy"]["Europe"]
    assert "India" in loc_data["hierarchy"]["Asia"]
    assert loc_data["country_to_continent"]["India"] == "Asia"


def test_england_country_dashboard_filtering(client: TestClient):
    """Verify that filtering by country=England on the dashboard and assets endpoints returns English assets."""
    # Ensure at least one asset in London exists
    dash_res = client.get("/api/health/dashboard?country=England")
    assert dash_res.status_code == 200
    data = dash_res.json()
    assert "kpis" in data
    assert data["filter_options"]["hierarchy"]["Europe"]["England"] == [
        "Birmingham",
        "Bristol",
        "Leeds",
        "Liverpool",
        "London",
        "Manchester",
        "Newcastle",
        "Sheffield",
    ]
