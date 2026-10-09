"""Official operator adapters. Never label HTTP success alone as LIVE."""

import json, hashlib, time, threading, urllib.request
from datetime import timedelta
from urllib.parse import urlencode
from pathlib import Path
from app.timeutil import parse, now

ROOT = Path(__file__).resolve().parents[1]
ALLOWED = {"ADM": ["EAL", "TWL", "ISL", "SIL"], "AUS": ["TML"], "KOW": ["TCL", "AEL"]}


def state(predictions, source_time, received, threshold):
    if source_time is None:
        return "SOURCE_TIME_UNKNOWN"
    age = (received - parse(source_time)).total_seconds()
    if age < -60:
        return "UPSTREAM_ERROR"
    if age > threshold:
        return "STALE"
    return "LIVE" if predictions else "NO_PREDICTION"


def mtr(data, line, station, received=None):
    received = received or now()
    base = {
        "provider": "MTR",
        "predictions": [],
        "source_time": None,
        "received_at": received.isoformat(),
    }
    if str(data.get("status")) != "1":
        return dict(
            base,
            state="UPSTREAM_ERROR",
            error=data.get("message", "Business status not normal"),
        )
    block = data.get("data", {}).get(line + "-" + station)
    if not isinstance(block, dict):
        return dict(
            base, state="UPSTREAM_ERROR", error="Expected line/station response missing"
        )
    source = block.get("curr_time") or data.get("curr_time")
    pred = []
    for direction in ["UP", "DOWN"]:
        for p in block.get(direction, []):
            if not all(p.get(k) is not None for k in ["dest", "plat", "time"]):
                continue
            try:
                t = parse(p["time"])
            except (ValueError, TypeError):
                continue
            if t < received - timedelta(seconds=60) or t > received + timedelta(
                hours=24
            ):
                continue
            typ = p.get("timeType", p.get("timetype"))
            event = (
                "arrival"
                if typ == "A"
                else ("departure" if typ == "D" else "arrival_or_departure")
            )
            pred.append(
                {
                    "id": hashlib.sha256(
                        (line + station + direction + str(p)).encode()
                    ).hexdigest()[:16],
                    "service_key": f"MTR:{line}:{direction}",
                    "dest": p["dest"],
                    "platform": str(p["plat"]),
                    "event_time": t.isoformat(),
                    "event_type": event,
                    "direction": direction,
                    "observed_at": None,
                    "vehicle_id": None,
                    "sequence": p.get("seq"),
                }
            )
    return dict(
        base,
        source_time=parse(source).isoformat() if source else None,
        predictions=pred,
        state=state(pred, source, received, 60),
        warnings=["Sequence is not a train ID; arrival is not a confirmed departure."],
    )


def bus(data, provider, route=None, direction=None, service_type=None, received=None):
    received = received or now()
    pred = []
    source = data.get("generated_timestamp")
    if not isinstance(data.get("data"), list):
        return {
            "provider": provider,
            "state": "UPSTREAM_ERROR",
            "predictions": [],
            "source_time": None,
            "error": "Invalid operator schema",
        }
    for p in data["data"]:
        if route and p.get("route") != route:
            continue
        if direction and p.get("dir") != direction:
            continue
        if service_type and str(p.get("service_type", "1")) != str(service_type):
            continue
        if not p.get("eta"):
            continue
        t = parse(p["eta"])
        if t < received - timedelta(seconds=60) or t > received + timedelta(hours=24):
            continue
        pred.append(
            {
                "event_time": t.isoformat(),
                "event_type": "arrival",
                "dest": p.get("dest_tc", p.get("dest_en", "")),
                "platform": None,
                "route": p.get("route"),
                "direction": p.get("dir"),
                "service_type": str(p.get("service_type", "1")),
                "service_key": f"{provider}:{p.get('route')}:{p.get('dir')}:{p.get('service_type','1')}",
                "observed_at": None,
                "vehicle_id": None,
                "source_time": p.get("data_timestamp"),
                "remark": p.get("rmk_tc") or p.get("rmk_en"),
            }
        )
    # Old per-record times cannot be rejuvenated by the response timestamp.
    times = [parse(p["source_time"]) for p in pred if p.get("source_time")]
    effective = min(times).isoformat() if times else source
    return {
        "provider": provider,
        "predictions": pred,
        "source_time": effective,
        "received_at": received.isoformat(),
        "state": state(pred, effective, received, 180),
        "warnings": ["No ETA does not mean service has closed."],
    }


class FeedClient:
    def __init__(self):
        self.cache = {}
        self.locks = {}
        self.guard = threading.Lock()
        self.health = {}

    def get(self, key, url, parser, ttl):
        with self.guard:
            lock = self.locks.setdefault(key, threading.Lock())
        with lock:
            old = self.cache.get(key)
            stamp = time.monotonic()
            if old and stamp - old[0] < ttl:
                return old[1]
            try:
                with urllib.request.urlopen(
                    urllib.request.Request(
                        url, headers={"User-Agent": "HongKong-MaaS-Research/0.1"}
                    ),
                    timeout=8,
                ) as r:
                    body = r.read(2_000_000)
                data = json.loads(body)
                result = parser(data)
                result["source_url"] = url
                result["snapshot_hash"] = hashlib.sha256(body).hexdigest()
                runtime = ROOT / "data/runtime"
                runtime.mkdir(parents=True, exist_ok=True)
                (runtime / (result["snapshot_hash"] + ".json")).write_bytes(body)
                if (
                    old
                    and old[1].get("source_time")
                    and result.get("source_time")
                    and parse(result["source_time"]) < parse(old[1]["source_time"])
                ):
                    return old[1]
            except Exception as e:
                result = {
                    "state": "UPSTREAM_ERROR",
                    "predictions": [],
                    "error": type(e).__name__ + ": " + str(e),
                    "source_url": url,
                    "source_time": None,
                }
            self.cache[key] = (stamp, result)
            self.health[key] = {
                "id": key,
                "state": result["state"],
                "last_checked_at": now().isoformat(),
                "source_time": result.get("source_time"),
                "url": url,
                "error": result.get("error"),
            }
            return result

    def departures(self, station, line):
        if station not in ALLOWED or line not in ALLOWED[station]:
            raise ValueError("Invalid line/station combination")
        return self.get(
            f"MTR:{line}:{station}",
            "https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?"
            + urlencode({"line": line, "sta": station}),
            lambda d: mtr(d, line, station),
            12,
        )

    def kmb(self, stop, route=None, direction=None, service_type=None):
        if len(stop) != 16 or any(c not in "0123456789ABCDEF" for c in stop):
            raise ValueError("Invalid KMB stop")
        return self.get(
            f"KMB:{stop}:{route}:{direction}:{service_type}",
            "https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/" + stop,
            lambda d: bus(d, "KMB", route, direction, service_type),
            60,
        )

    def citybus(self, stop, route):
        if not stop.isdigit() or not route.isalnum():
            raise ValueError("Invalid Citybus identifiers")
        return self.get(
            f"CTB:{stop}:{route}",
            f"https://rt.data.gov.hk/v2/transport/citybus/eta/CTB/{stop}/{route}",
            lambda d: bus(d, "CTB", route),
            60,
        )

    def replay(self, filename, clock, parser):
        # Only snapshots received at/before the virtual clock are available.
        index = ROOT / "docs/source-probes.json"
        records = json.loads(index.read_text()) if index.exists() else []
        candidates = [
            r
            for r in records
            if r["name"] == filename
            and r.get("status") == "RECEIVED"
            and parse(r["received_at"]) <= parse(clock)
        ]
        if not candidates:
            return {
                "state": "REPLAY",
                "predictions": [],
                "error": "NO_SNAPSHOT_AT_VIRTUAL_TIME",
                "virtual_clock": clock,
            }
        r = candidates[-1]
        p = ROOT / "data/raw" / r["name"]
        if not p.exists():
            return {
                "state": "REPLAY",
                "predictions": [],
                "error": "Run explicit source collector to obtain local snapshots",
                "virtual_clock": clock,
            }
        result = parser(json.loads(p.read_text()), parse(clock))
        result.update(
            state="REPLAY",
            sample_received_at=r["received_at"],
            virtual_clock=clock,
            snapshot_hash=r["sha256"],
        )
        return result
