from pathlib import Path
import json, uuid, os, copy, secrets, time, gzip
from typing import Literal
from datetime import timedelta
from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, ConfigDict, field_validator
from app.timeutil import now, parse
from adapters.realtime import FeedClient, mtr
from routing.engine import route, RoutingError, should_reroute
from rules.hsr import check
from app.storage import Store

ROOT = Path(__file__).resolve().parents[1]
MODEL = json.loads((ROOT / "data/normalized/model.json").read_text())
feeds = FeedClient()
store = Store()
app = FastAPI(title="Hong Kong MaaS research API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5174", "http://localhost:5174"],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "X-Journey-Token", "X-Admin-Token"],
)


def envelope(result, state="PLAN_ONLY", warnings=None, as_of=None):
    return {
        "request_id": str(uuid.uuid4()),
        "generated_at": now().isoformat(),
        "as_of": as_of or now().isoformat(),
        "model_version": MODEL["version"],
        "data_state": state,
        "warnings": warnings or [],
        "result": result,
    }


@app.middleware("http")
async def limits(request: Request, call_next):
    try:
        declared = int(request.headers.get("content-length", "0"))
    except ValueError:
        return JSONResponse({"error": "INVALID_CONTENT_LENGTH"}, status_code=400)
    if declared < 0:
        return JSONResponse({"error": "INVALID_CONTENT_LENGTH"}, status_code=400)
    if declared > 65536:
        return JSONResponse({"error": "BODY_TOO_LARGE"}, status_code=413)
    if request.method in ["POST", "PUT", "PATCH"]:
        chunks = []
        size = 0
        async for chunk in request.stream():
            size += len(chunk)
            if size > 65536:
                return JSONResponse({"error": "BODY_TOO_LARGE"}, status_code=413)
            chunks.append(chunk)
        request._body = b"".join(chunks)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "same-origin"
    return response


@app.exception_handler(ValueError)
async def value_error(req, exc):
    return JSONResponse(
        envelope({"status": "INVALID_INPUT", "error": str(exc)}, "ERROR"),
        status_code=422,
    )


@app.get("/api/v1/health")
def health():
    return envelope({"status": "ok", "city_id": "hong_kong"})


@app.get("/api/v1/bootstrap")
def bootstrap():
    return envelope(dict(MODEL, sources=sources()["result"]["sources"]))


@app.get("/api/v1/venues")
def venues(q: str = "", city: str = "hong_kong"):
    if city != "hong_kong":
        return envelope({"venues": []})
    return envelope(
        {
            "venues": [
                v
                for v in MODEL["venues"]
                if q.lower() in json.dumps(v, ensure_ascii=False).lower()
            ]
        }
    )


@app.get("/api/v1/venues/{id}/model")
def venue(id: str, level: str | None = None):
    ns = [
        n
        for n in MODEL["nodes"]
        if n["venue_id"] == id and (not level or n["level_id"] == level)
    ]
    ids = {n["id"] for n in ns}
    return envelope(
        {
            "nodes": ns,
            "edges": [
                e for e in MODEL["edges"] if e["from_id"] in ids and e["to_id"] in ids
            ],
            "coordinate_system": "SCHEMATIC",
        }
    )


@app.get("/api/v1/venues/{id}/geometry")
def geometry(
    id: str,
    layer: Literal["levels", "units", "openings", "amenities"] = "levels",
    level: str | None = None,
):
    if id not in ["ADM", "AUS", "KOW"]:
        raise HTTPException(404, "Official geometry unavailable")
    suffix = {
        "levels": "mtr_level_polygon",
        "units": "mtr_unit_polygon",
        "openings": "mtr_opening_line",
        "amenities": "mtr_amenity_point",
    }[layer]
    p = ROOT / "data/raw" / f"{id}-{suffix}.json"
    packed = ROOT / "data/official" / (p.name + ".gz")
    if not p.exists() and not packed.exists():
        raise HTTPException(
            404, "Run scripts/fetch_sources.py explicitly to obtain official geometry"
        )
    d = (
        json.loads(p.read_text())
        if p.exists()
        else json.loads(gzip.decompress(packed.read_bytes()))
    )
    if len(d.get("features", [])) >= 5000:
        raise HTTPException(409, "POSSIBLY_TRUNCATED_GEOMETRY")
    if level:
        d["features"] = [
            f
            for f in d["features"]
            if f["properties"].get("level_short_name_en") == level
        ]
    d.update(
        source="Lands Department",
        attribution="Map from Lands Department; © Government of the Hong Kong SAR",
        terms_url="https://portal.csdi.gov.hk/csdi-webpage/doc/TNC",
        routing_warning="Geometry is not a validated routing graph",
    )
    return d


@app.get("/api/v1/bus/services")
def bus_services():
    p = ROOT / "data/normalized/bus_services.json"
    return envelope(
        {"services": json.loads(p.read_text()) if p.exists() else []}, "STATIC_VERIFIED"
    )


@app.get("/api/v1/stops/{id}/departures")
def departures(
    id: str,
    line: str = "EAL",
    provider: Literal["MTR", "KMB", "CTB"] = "MTR",
    route: str | None = None,
    direction: str | None = None,
    service_type: str | None = None,
    mode: Literal["LIVE", "REPLAY", "SIMULATED"] = "LIVE",
    clock: str | None = None,
):
    if mode == "SIMULATED":
        return envelope(
            {
                "state": "SIMULATED",
                "predictions": [],
                "warnings": ["Simulation contains no fabricated ETA."],
            },
            "SIMULATED",
        )
    if mode == "REPLAY":
        if provider == "KMB":
            if len(id) != 16 or any(c not in "0123456789ABCDEF" for c in id):
                raise HTTPException(422, "Invalid KMB stop")
            from adapters.realtime import bus

            result = feeds.replay(
                f"kmb-eta-{id}.json",
                clock or now().isoformat(),
                lambda d, c: bus(d, "KMB", route, direction, service_type, c),
            )
            return envelope(result, "REPLAY", as_of=result.get("source_time"))
        if provider == "CTB":
            return envelope(
                {"state": "REPLAY", "predictions": [], "error": "NO_CITYBUS_SNAPSHOT"},
                "REPLAY",
            )
        if id not in ["ADM", "AUS", "KOW"] or line not in [
            "EAL",
            "TWL",
            "ISL",
            "SIL",
            "TML",
            "TCL",
            "AEL",
        ]:
            raise HTTPException(422, "Invalid replay key")
        result = feeds.replay(
            f"mtr-{line}-{id}.json",
            clock or now().isoformat(),
            lambda d, c: mtr(d, line, id, c),
        )
    else:
        result = (
            feeds.departures(id, line)
            if provider == "MTR"
            else (
                feeds.kmb(id, route, direction, service_type)
                if provider == "KMB"
                else feeds.citybus(id, route or "")
            )
        )
    return envelope(result, result["state"], as_of=result.get("source_time"))


@app.get("/api/v1/sources/status")
def sources():
    p = ROOT / "docs/source-probes.json"
    records = json.loads(p.read_text()) if p.exists() else []
    return envelope(
        {
            "sources": list(feeds.health.values()),
            "probe_records": records,
            "static_sources": [
                {
                    "id": "CSDI",
                    "url": "https://portal.csdi.gov.hk/csdi-webpage/apidoc/3d-indoor-mtr-station-map",
                    "status": "GEOMETRY_RECEIVED_ROUTING_AUDIT_PENDING",
                },
                {
                    "id": "MTR-LAYOUT",
                    "url": "https://www.mtr.com.hk/en/customer/services/system_map.html",
                    "status": "DOCUMENTED_TOPOLOGY",
                },
                {
                    "id": "MTR-HSR",
                    "url": "https://www.highspeed.mtr.com.hk/en/guide/process-departure.html",
                    "status": "RULES_CHECKED_2026-10-09",
                },
            ],
        }
    )


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Plan(StrictModel):
    from_id: str = Field(max_length=100)
    to_id: str = Field(max_length=100)
    departure_at: str = Field(default_factory=lambda: now().isoformat())
    preference: Literal["fast", "few_stairs", "accessible"] = "fast"
    mode: Literal["LIVE", "REPLAY", "SIMULATED"] = "SIMULATED"
    closed_facilities: list[str] = Field(default_factory=list, max_length=50)
    hsr_departure: str | None = None
    queue_minutes: float = Field(default=8, ge=0, le=240)
    walk_speed: float = Field(default=1.2, ge=0.3, le=3)
    allow_provisional: bool = True
    allow_exit_reentry: bool = True
    save: bool = False
    virtual_clock: str | None = None

    @field_validator("departure_at", "hsr_departure", "virtual_clock")
    @classmethod
    def datetime_valid(cls, v):
        if v is not None:
            parse(v)
        return v


def calculate(body):
    model = copy.deepcopy(MODEL)
    warnings = []
    refs = []
    # Fuse only current, direction-specific departure events at the first mapped rail boarding.
    if (
        body.mode == "LIVE"
        and abs((parse(body.departure_at) - now()).total_seconds()) < 300
    ):
        for e in model["edges"]:
            if e["kind"] == "mtr" and e["from_id"] == "ADM:P7":
                feed = feeds.departures("ADM", "EAL")
                refs.append(
                    {
                        "state": feed["state"],
                        "source_time": feed.get("source_time"),
                        "snapshot_hash": feed.get("snapshot_hash"),
                    }
                )
                valid = [
                    p
                    for p in feed.get("predictions", [])
                    if p["direction"] == "UP"
                    and p["platform"] == "7"
                    and p["event_type"] == "departure"
                ]
                if feed["state"] == "LIVE" and valid:
                    e["departures"] = [p["event_time"] for p in valid]
                    e["time_state"] = "LIVE"
                    e["forecast_only"] = True
                else:
                    warnings.append(
                        "MTR arrival-only, stale or unavailable feed: rail waiting remains an estimated headway range."
                    )
    if (
        body.mode == "LIVE"
        and body.from_id.startswith("KMB:")
        and abs((parse(body.departure_at) - now()).total_seconds()) < 300
    ):
        for e in model["edges"]:
            if e["kind"] == "bus" and e["from_id"] == body.from_id:
                feed = feeds.kmb(
                    body.from_id.split(":")[1],
                    e["route"],
                    e["direction"],
                    e["service_type"],
                )
                refs.append(
                    {
                        "state": feed["state"],
                        "source_time": feed.get("source_time"),
                        "snapshot_hash": feed.get("snapshot_hash"),
                    }
                )
                if feed["state"] == "LIVE" and feed["predictions"]:
                    # Bus ETA is arrival; use explicit research 30 s boarding allowance, never call it confirmed departure.
                    e["departures"] = [
                        (parse(p["event_time"]) + timedelta(seconds=30)).isoformat()
                        for p in feed["predictions"]
                    ]
                    e["time_state"] = "LIVE_ARRIVAL_PLUS_BOARDING_ASSUMPTION"
                    e["forecast_only"] = True
                else:
                    warnings.append(
                        "Bus forecast unavailable; headway is an explicit research assumption."
                    )
    if body.mode == "REPLAY":
        warnings.append(
            "REPLAY: research topology and virtual clock; only snapshots received before virtual clock are eligible."
        )
    target = "WEK:verification" if body.hsr_departure else body.to_id
    try:
        result = route(
            model,
            body.from_id,
            target,
            body.virtual_clock or body.departure_at,
            body.preference,
            body.closed_facilities,
            body.allow_provisional,
            body.allow_exit_reentry,
            body.walk_speed,
        )
    except RoutingError as e:
        return {
            "status": e.code,
            "legs": [],
            "warnings": warnings + [str(e)],
            "data_state": body.mode,
            "total_minutes": None,
            "arrival_at": None,
            "id": str(uuid.uuid4()),
            "revision": 1,
        }
    result.update(
        id=str(uuid.uuid4()),
        revision=1,
        mode=body.mode,
        data_state=body.mode if body.mode != "LIVE" else "ESTIMATED",
        snapshot_refs=refs,
        rule_version="hsr-2026-10-09",
        request=body.model_dump(),
    )
    result["warnings"] += warnings
    result["warnings"] += [
        "Walking and train running times are uncalibrated estimates. Fares are unknown."
    ]
    if body.hsr_departure:
        result["hsr"] = check(
            result["arrival_at"], body.hsr_departure, body.queue_minutes
        )
        if result["hsr"]["status"] != "CONDITIONAL":
            result["status"] = result["hsr"]["status"]
    return result


@app.post("/api/v1/indoor-route")
@app.post("/api/v1/journeys/plan")
def plan(body: Plan, x_journey_token: str | None = Header(default=None)):
    result = calculate(body)
    if body.save:
        if not x_journey_token or len(x_journey_token) < 24:
            raise HTTPException(
                422,
                "Saving requires your random X-Journey-Token (at least 24 characters)",
            )
        result = store.save(result, x_journey_token)
    return envelope(
        result,
        result["data_state"],
        result.get("warnings"),
        body.virtual_clock or body.departure_at,
    )


class Replan(Plan):
    completed_legs: int = Field(default=0, ge=0)


@app.post("/api/v1/journeys/{id}/replan")
def replan(id: str, body: Replan, x_journey_token: str = Header()):
    history = store.read(id, x_journey_token)
    if not history:
        raise HTTPException(404, "Saved journey not found")
    old = history[-1]
    done = old.get("legs", [])[: body.completed_legs]
    if body.completed_legs > len(old.get("legs", [])):
        raise HTTPException(422, "Invalid progress")
    if done:
        body.from_id = done[-1]["to_id"]
        body.departure_at = max(
            parse(body.departure_at), parse(done[-1]["arrival_at"])
        ).isoformat()
    result = calculate(body)
    result["remaining_minutes"] = result.get("total_minutes")
    if result.get("total_minutes") is not None:
        result["total_minutes"] += sum(e["minutes"] for e in done)
    result["completed_legs"] = done
    result["legs"] = done + result["legs"]
    result["previous_revision"] = old["revision"]
    result["recommend_reroute"] = should_reroute(
        old.get("total_minutes") or 0,
        result.get("total_minutes") or 0,
        old["status"] in ["OK", "CONDITIONAL"],
    )
    result = store.save(result, x_journey_token, id)
    return envelope(result, result["data_state"])


@app.get("/api/v1/journeys/{id}")
def read(id: str, x_journey_token: str = Header()):
    return envelope({"revisions": store.read(id, x_journey_token)})


@app.delete("/api/v1/journeys/{id}")
def delete(id: str, x_journey_token: str = Header()):
    return envelope({"deleted": bool(store.delete(id, x_journey_token))})


class HSR(StrictModel):
    arrival_at: str
    departure_at: str
    queue_minutes: float = Field(default=8, ge=0, le=240)
    security_minutes: float = Field(default=8, ge=0, le=240)
    immigration_minutes: float = Field(default=10, ge=0, le=240)
    walk_minutes: float = Field(default=2, ge=0, le=240)
    buffer_minutes: float = Field(default=5, ge=0, le=60)


@app.post("/api/v1/hsr/check")
def hsr(body: HSR):
    return envelope(
        check(
            body.arrival_at,
            body.departure_at,
            body.queue_minutes,
            body.security_minutes,
            body.immigration_minutes,
            body.walk_minutes,
            body.buffer_minutes,
        ),
        "SIMULATED",
    )


class Scenario(StrictModel):
    closed_facilities: list[str] = Field(default_factory=list, max_length=50)
    virtual_clock: str | None = None


@app.post("/api/v1/scenarios")
def scenario(body: Scenario, x_admin_token: str | None = Header(default=None)):
    expected = os.getenv("HK_ADMIN_TOKEN")
    if (
        not expected
        or not x_admin_token
        or not secrets.compare_digest(expected, x_admin_token)
    ):
        raise HTTPException(403, "Explicit local admin token required")
    id = str(uuid.uuid4())
    with store.connect() as c:
        c.execute("INSERT INTO scenarios VALUES(?,?)", (id, body.model_dump_json()))
        c.execute(
            "INSERT INTO audit_logs(kind,record_id) VALUES(?,?)",
            ("SIMULATED_SCENARIO", id),
        )
    return envelope({"id": id, "origin": "SIMULATED", **body.model_dump()}, "SIMULATED")


from adapters.network import load_graph, route_graph

NETWORK_CACHE = {}


def network_load(region):
    if region not in NETWORK_CACHE:
        NETWORK_CACHE[region] = load_graph(region)
    return NETWORK_CACHE[region]


@app.get("/api/v1/network/{region}")
def network(region: str):
    graph = network_load(region)
    return envelope(
        {
            "region": region,
            "nodes": graph["nodes"],
            "edge_count": len(graph["edges"]),
            "source_count": graph["source_count"],
            "warnings": graph["warnings"],
            "scope_bbox": graph["scope_bbox"],
        },
        "OFFICIAL_NETWORK",
    )


@app.get("/api/v1/network/{region}/geometry")
def network_geometry(region: str):
    graph = network_load(region)
    return {
        "type": "FeatureCollection",
        "features": graph["features"],
        "attribution": "Map from Lands Department; © Government of the Hong Kong SAR",
    }


class NetworkRoute(StrictModel):
    from_node: str
    to_node: str
    preference: Literal["fast", "few_stairs", "accessible"] = "fast"
    closed_facilities: list[str] = Field(default_factory=list, max_length=50)
    walk_speed: float = Field(default=1.2, ge=0.3, le=3)


@app.post("/api/v1/network/{region}/route")
def network_route(region: str, body: NetworkRoute):
    result = route_graph(
        network_load(region),
        body.from_node,
        body.to_node,
        body.preference,
        body.closed_facilities,
        body.walk_speed,
    )
    return envelope(result, "OFFICIAL_NETWORK_ESTIMATED_TIME", result["warnings"])


if (ROOT / "web/dist").exists():
    app.mount("/", StaticFiles(directory=ROOT / "web/dist", html=True), name="ui")
