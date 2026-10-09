import copy, json, pytest
from datetime import timedelta
from pathlib import Path
from app.timeutil import parse, service_time, calendar_active
from routing.engine import route, validate, RoutingError, should_reroute
from adapters.realtime import mtr, bus, FeedClient
from adapters.spatial import validate_features, map_external
from rules.hsr import check
from app.storage import Store

ROOT = Path(__file__).resolve().parents[1]
MODEL = json.loads((ROOT / "data/normalized/model.json").read_text())
D = "2026-10-09T11:00:00+08:00"


def tiny():
    return {
        "version": "test",
        "nodes": [
            {
                "id": x,
                "venue_id": "test",
                "level_id": "G",
                "name_tc": x,
                "paid_area": None,
            }
            for x in ["a", "b"]
        ],
        "edges": [
            {
                "id": "ab",
                "from_id": "a",
                "to_id": "b",
                "kind": "walk",
                "minutes": 2,
                "evidence": "VERIFIED",
                "access_evidence": "verified",
            }
        ],
    }


def test_T01_external_ids():
    r = [
        dict(provider="KMB", entity_type="stop", external_id="a", internal_id="a"),
        dict(provider="CTB", entity_type="stop", external_id="a", internal_id="b"),
    ]
    assert len(map_external(r)) == 2
    with pytest.raises(ValueError):
        map_external(r + [dict(r[0], internal_id="wrong")])


def test_T02_truncation():
    with pytest.raises(ValueError, match="TRUNCATED"):
        validate_features({"type": "FeatureCollection", "features": [{}] * 5000})


def test_T03_cross_floor():
    m = tiny()
    m["nodes"][1]["level_id"] = "B1"
    assert any("VERTICAL" in x for x in validate(m))


def test_T04_direction():
    p = route(MODEL, "ADM:entry", "ADM:P7", D)
    assert p["legs"][-1]["to_id"] == "ADM:P7"
    assert next(n for n in MODEL["nodes"] if n["id"] == "ADM:P7")["direction"] == "UP"


def test_T05_paid_reentry():
    m = tiny()
    m["nodes"] = [
        dict(m["nodes"][0], id=x, paid_area=p)
        for x, p in [("a", "paid"), ("b", None), ("c", "paid")]
    ]
    m["edges"] += [dict(m["edges"][0], id="bc", from_id="b", to_id="c")]
    with pytest.raises(RoutingError):
        route(m, "a", "c", D, allow_exit_reentry=False)


def test_T06_visual_scale():
    before = route(MODEL, "ADM:entry", "ADM:P7", D)["total_minutes"]
    m = copy.deepcopy(MODEL)
    for n in m["nodes"]:
        n["y"] *= 10
    assert route(m, "ADM:entry", "ADM:P7", D)["total_minutes"] == before


def test_T07_closed_entry():
    m = tiny()
    m["edges"][0]["open_rule"] = {"open": D, "close": D, "semantics": "entry"}
    with pytest.raises(RoutingError):
        route(m, "a", "b", D)


def test_T08_whole_passage():
    m = tiny()
    m["edges"][0]["open_rule"] = {
        "open": D,
        "close": "2026-10-09T11:01:00+08:00",
        "semantics": "whole",
    }
    with pytest.raises(RoutingError):
        route(m, "a", "b", D)


def test_T09_unknown_access():
    with pytest.raises(RoutingError, match="UNVERIFIED_ACCESS"):
        route(MODEL, "ADM:entry", "ADM:P7", D, "accessible")


def test_T10_scenario_isolation():
    old = copy.deepcopy(MODEL)
    route(MODEL, "ADM:entry", "ADM:P7", D, closed_facilities=["ADM:entrance-lift"])
    assert MODEL == old


def sample():
    return {
        "status": 1,
        "curr_time": "2026-10-09 11:00:00",
        "data": {
            "EAL-ADM": {
                "UP": [
                    {
                        "time": "2026-10-09 11:03:00",
                        "plat": "7",
                        "dest": "LOW",
                        "seq": "1",
                        "timeType": "A",
                    }
                ]
            }
        },
    }


def test_T11_business_error():
    assert (
        mtr({"status": 0, "message": "alert"}, "EAL", "ADM", parse(D))["state"]
        == "UPSTREAM_ERROR"
    )


def test_T12_arrival_semantics():
    assert (
        mtr(sample(), "EAL", "ADM", parse(D))["predictions"][0]["event_type"]
        == "arrival"
    )


def test_T13_sequence_not_id():
    assert mtr(sample(), "EAL", "ADM", parse(D))["predictions"][0]["vehicle_id"] is None


def test_T14_empty_bus():
    assert (
        bus({"data": [], "generated_timestamp": D}, "KMB", received=parse(D))["state"]
        == "NO_PREDICTION"
    )


def test_T15_stale():
    assert (
        mtr(sample(), "EAL", "ADM", parse(D) + timedelta(minutes=2))["state"] == "STALE"
    )


def test_T16_past_predictions():
    assert not mtr(sample(), "EAL", "ADM", parse(D) + timedelta(minutes=10))[
        "predictions"
    ]


def test_T17_gtfs_over24():
    assert (
        service_time("2026-10-09", "25:10:00").isoformat()
        == "2026-10-10T01:10:00+08:00"
    )


def test_T18_calendar():
    assert not calendar_active(
        {"start_date": "2026-01-01", "end_date": "2026-12-31", "weekdays": [1] * 7},
        "2026-10-09",
        [{"date": "2026-10-09", "exception_type": 2}],
    )


def test_T19_last_departure():
    m = tiny()
    m["edges"][0].update(kind="mtr", departures=["2026-10-09T10:59:00+08:00"])
    with pytest.raises(RoutingError, match="NO_VALID_SERVICE"):
        route(m, "a", "b", D)


def test_T20_frequency_range():
    m = tiny()
    m["edges"][0].update(kind="bus", headway_minutes=10)
    p = route(m, "a", "b", D)
    assert p["legs"][0]["time_state"] == "ESTIMATED_FREQUENCY"


def test_T21_verification_deadline():
    assert (
        check("2026-10-09T11:25:00+08:00", "2026-10-09T12:00:00+08:00", 8, 8, 10, 2, 0)[
            "status"
        ]
        == "HSR_DEADLINE_MISSED"
    )


def test_T22_queue_completion():
    assert (
        check("2026-10-09T11:20:00+08:00", "2026-10-09T12:00:00+08:00", 15, 0, 0, 0, 0)[
            "verification_margin_minutes"
        ]
        == -5
    )


def test_T23_gate_wait():
    assert (
        check("2026-10-09T10:00:00+08:00", "2026-10-09T12:00:00+08:00", 8, 8, 10, 2, 0)[
            "boarding_ready_at"
        ]
        == "2026-10-09T11:45:00+08:00"
    )


def test_T24_boundary():
    assert (
        check("2026-10-09T11:17:00+08:00", "2026-10-09T12:00:00+08:00", 8, 8, 10, 2, 5)[
            "status"
        ]
        == "BOUNDARY"
    )


def test_T25_unknown_fare():
    assert route(MODEL, "ADM:entry", "ADM:P7", D)["fare_hkd"] is None


def test_T26_hysteresis():
    assert not should_reroute(10, 9)
    assert should_reroute(10, 7)


def test_T27_replay_label():
    assert FeedClient().replay("nothing.json", D, lambda a, b: a)["state"] == "REPLAY"


def test_T28_no_future():
    assert (
        FeedClient().replay(
            "mtr-EAL-ADM.json", "2020-01-01T00:00:00+08:00", lambda a, b: a
        )["error"]
        == "NO_SNAPSHOT_AT_VIRTUAL_TIME"
    )


def test_T29_delete_saved(tmp_path):
    s = Store(tmp_path / "test.db")
    p = s.save({"legs": []}, "owner")
    assert s.read(p["id"], "owner")
    assert not s.read(p["id"], "other")
    s.delete(p["id"], "owner")
    assert not s.read(p["id"], "owner")


def test_T30_city_isolation():
    assert MODEL["city_id"] == "hong_kong"
    assert all("beijing" not in e["id"].lower() for e in MODEL["edges"])


def test_valid_model():
    assert not validate(MODEL)


def test_live_timestamp_future():
    assert (
        mtr(sample(), "EAL", "ADM", parse(D) - timedelta(minutes=5))["state"]
        == "UPSTREAM_ERROR"
    )


def test_lift_alternative():
    p = route(MODEL, "ADM:entry", "ADM:P7", D, "few_stairs")
    assert "lift" in [e["kind"] for e in p["legs"]]


def test_wait_allowed():
    m = tiny()
    m["edges"][0]["open_rule"] = {
        "open": "2026-10-09T11:05:00+08:00",
        "close": "2026-10-09T12:00:00+08:00",
        "allow_wait": True,
    }
    assert route(m, "a", "b", D)["total_minutes"] == 7


def test_prediction_window_fallback():
    m = tiny()
    m["edges"][0].update(
        kind="mtr",
        departures=["2026-10-09T10:59:00+08:00"],
        forecast_only=True,
        headway_minutes=6,
    )
    assert route(m, "a", "b", D)["legs"][0]["time_state"] == "ESTIMATED_FREQUENCY"
