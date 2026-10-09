from fastapi.testclient import TestClient
from app.main import app

c = TestClient(app)


def test_envelope():
    d = c.get("/api/v1/bootstrap").json()
    assert all(
        k in d
        for k in [
            "request_id",
            "generated_at",
            "as_of",
            "model_version",
            "data_state",
            "warnings",
            "result",
        ]
    )


def test_input_validation():
    assert (
        c.post(
            "/api/v1/journeys/plan",
            json={"from_id": "a", "to_id": "b", "walk_speed": -2},
        ).status_code
        == 422
    )


def test_no_false_access():
    assert (
        c.post(
            "/api/v1/journeys/plan",
            json={
                "from_id": "ADM:entry",
                "to_id": "ADM:P7",
                "preference": "accessible",
            },
        ).json()["result"]["status"]
        == "UNVERIFIED_ACCESS"
    )


def test_simulated_eta():
    r = c.get("/api/v1/stops/ADM/departures?mode=SIMULATED").json()
    assert r["data_state"] == "SIMULATED"
    assert not r["result"]["predictions"]


def test_invalid_station():
    assert c.get("/api/v1/stops/NON/departures").status_code == 422


def test_admin_denied():
    assert c.post("/api/v1/scenarios", json={}).status_code == 403


def test_unknown_node():
    assert (
        c.post(
            "/api/v1/indoor-route", json={"from_id": "unknown", "to_id": "ADM:P7"}
        ).json()["result"]["status"]
        == "UNKNOWN_NODE"
    )


def test_bus_services():
    assert len(c.get("/api/v1/bus/services").json()["result"]["services"]) >= 8


def test_simplified_search():
    assert c.get("/api/v1/venues?q=金钟").json()["result"]["venues"][0]["id"] == "ADM"


def test_empty_venue():
    assert not c.get("/api/v1/venues?city=beijing").json()["result"]["venues"]


def test_hsr_result():
    r = c.post(
        "/api/v1/hsr/check",
        json={
            "arrival_at": "2026-10-09T11:17:00+08:00",
            "departure_at": "2026-10-09T12:00:00+08:00",
        },
    )
    assert r.json()["result"]["status"] == "BOUNDARY"


def test_nan_rejected():
    r = c.post(
        "/api/v1/journeys/plan",
        content='{"from_id":"ADM:entry","to_id":"ADM:P7","queue_minutes":NaN}',
        headers={"content-type": "application/json"},
    )
    assert r.status_code == 422


def test_oversized_rejected():
    assert c.post("/api/v1/journeys/plan", content="x" * 65537).status_code == 413
