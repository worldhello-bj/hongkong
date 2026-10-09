import gzip, json
from pathlib import Path
import pytest
from adapters.network import load_graph, build_graph, route_graph, node_id

ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.parametrize("region,min_edges", [("ADM", 2500), ("HUB", 3500)])
def test_official_network_import(region, min_edges):
    g = load_graph(region)
    assert len(g["edges"]) >= min_edges
    assert all(e["length_m"] >= 0 for e in g["edges"])
    assert len({n["id"] for n in g["nodes"]}) == len(g["nodes"])
    assert all(
        e["direction"] != -1 for e in g["edges"] if not e["id"].endswith("reverse")
    )


def test_different_height_never_joined():
    assert node_id("ADM", [114.1, 22.1, 0]) != node_id("ADM", [114.1, 22.1, -5])


def test_geometry_does_not_fabricate_crossings():
    g = load_graph("ADM")
    assert all(len(e["geometry"]["coordinates"][0]) == 3 for e in g["edges"])


def test_real_network_route_and_closure():
    g = load_graph("ADM")
    e = next(
        e for e in g["edges"] if e["length_m"] > 10 and e["access_time_id"] is None
    )
    r = route_graph(g, e["from_id"], e["to_id"])
    assert r["status"] == "CONDITIONAL"
    assert r["distance_m"] > 0
    assert r["geometry"]["features"]
    closed = route_graph(g, e["from_id"], e["to_id"], closed=[e["id"]])
    assert e["id"] not in [x["id"] for x in closed["legs"]]


def test_accessibility_not_promised():
    g = load_graph("ADM")
    e = next(e for e in g["edges"] if e["kind"] == "lift")
    r = route_graph(g, e["from_id"], e["to_id"], "accessible")
    assert r["status"] in ["UNVERIFIED_ACCESS", "CONDITIONAL"]
    assert not any(x["kind"] == "lift" for x in r["legs"])


def test_source_pack_license():
    p = ROOT / "data/official/ADM-network.json.gz"
    d = json.loads(gzip.decompress(p.read_bytes()))
    assert "CSDI" in d["attribution"]
    assert d["expected_count"] == 1396


def test_documented_accessible_walk_is_allowed():
    g = load_graph("ADM")
    e = next(
        e
        for e in g["edges"]
        if e["kind"] == "walk"
        and e["wheelchair_barrier"] == 2
        and e["access_time_id"] is None
    )
    r = route_graph(g, e["from_id"], e["to_id"], "accessible")
    assert r["status"] == "CONDITIONAL"
    assert r["access_status"] == "DOCUMENTED_NOT_FIELD_VERIFIED"
