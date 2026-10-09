"""Time dependent multi-state Dijkstra with explicit provisional result status."""

import heapq, itertools
from datetime import timedelta
from app.timeutil import parse, service_time, calendar_active


class RoutingError(ValueError):
    def __init__(self, code):
        self.code = code
        super().__init__(code)


def validate(model):
    ns = {n["id"]: n for n in model["nodes"]}
    errors = []
    if len(ns) != len(model["nodes"]):
        errors.append("DUPLICATE_NODE")
    for e in model["edges"]:
        if e["from_id"] not in ns or e["to_id"] not in ns:
            errors.append("MISSING_ENDPOINT")
            continue
        a, b = ns[e["from_id"]], ns[e["to_id"]]
        if (
            e["minutes"] < 0
            or e.get("length_m", 0) is not None
            and e.get("length_m", 0) < 0
        ):
            errors.append("NEGATIVE_COST")
        if (
            a["venue_id"] == b["venue_id"]
            and a["level_id"] != b["level_id"]
            and e["kind"] not in ["mtr", "bus"]
            and not e.get("facility_id")
        ):
            errors.append("UNSUPPORTED_VERTICAL:" + e["id"])
    return errors


def next_service(edge, arrival):
    if edge.get("departures"):
        valid = [
            parse(x)
            for x in edge["departures"]
            if parse(x) >= arrival + timedelta(seconds=30)
        ]
        if valid:
            return (min(valid) - arrival).total_seconds() / 60, edge.get(
                "time_state", "PLAN_ONLY"
            )
        if not edge.get("forecast_only"):
            return None
    if edge.get("service_window"):
        start, end = [
            service_time(arrival.date().isoformat(), v) for v in edge["service_window"]
        ]
        if arrival >= end:
            return None
        arrival = max(arrival, start)
    return edge.get("headway_minutes", 0) / 2, "ESTIMATED_FREQUENCY"


def route(
    model,
    start,
    end,
    departure,
    preference="fast",
    closed_facilities=(),
    allow_provisional=True,
    allow_exit_reentry=True,
    walk_speed=1.2,
    completed_legs=(),
):
    ns = {n["id"]: n for n in model["nodes"]}
    if start not in ns or end not in ns:
        raise RoutingError("UNKNOWN_NODE")
    if not 0.3 <= walk_speed <= 3:
        raise RoutingError("INVALID_WALK_SPEED")
    departure = parse(departure)
    adj = {k: [] for k in ns}
    for e in model["edges"]:
        adj[e["from_id"]].append(e)
    # State includes paid-zone history and number of vehicle boardings.
    counter = itertools.count()
    origin = (start, False, 0)
    queue = [(0, 0, next(counter), origin, [])]
    best = {origin: 0}
    blocked = set()
    while queue:
        score, elapsed, _, state, legs = heapq.heappop(queue)
        node, exited, rides = state
        if score > best.get(state, float("inf")):
            continue
        if node == end:
            warnings = sorted(
                {e["evidence"] for e in legs if e.get("evidence") != "VERIFIED"}
            )
            return {
                "status": "CONDITIONAL" if warnings else "OK",
                "legs": legs,
                "total_minutes": round(elapsed, 2),
                "walking_minutes": round(
                    sum(
                        e["minutes"]
                        for e in legs
                        if e["kind"] in ["walk", "stairs", "lift", "transfer"]
                    ),
                    2,
                ),
                "arrival_at": (departure + timedelta(minutes=elapsed)).isoformat(),
                "warnings": warnings,
                "fare_hkd": None,
                "fare_state": "UNKNOWN",
                "transfers": max(0, rides - 1),
                "data_state": "ESTIMATED",
                "build_id": model["version"],
            }
        for e in adj[node]:
            if e["kind"] == "process":
                continue
            if (
                e.get("facility_id") in closed_facilities
                or e["id"] in closed_facilities
            ):
                blocked.add("CLOSED_PASSAGE")
                continue
            if preference == "accessible" and (
                e["kind"] == "stairs" or e.get("access_evidence") != "verified"
            ):
                blocked.add("UNVERIFIED_ACCESS")
                continue
            if not allow_provisional and e["evidence"] != "VERIFIED":
                blocked.add("UNVERIFIED_ACCESS")
                continue
            a, b = ns[node], ns[e["to_id"]]
            new_exited = exited or bool(a.get("paid_area") and not b.get("paid_area"))
            if (
                exited
                and not a.get("paid_area")
                and b.get("paid_area")
                and not allow_exit_reentry
            ):
                blocked.add("PAID_AREA_REENTRY")
                continue
            if e["kind"] in ["mtr", "bus"] and rides >= 4:
                continue
            minutes = (
                e["minutes"]
                if e.get("length_m") is None
                else e["length_m"] / walk_speed / 60
            )
            arrive = departure + timedelta(minutes=elapsed)
            waiting = 0
            time_state = e.get("time_state", "ESTIMATED")
            rule = e.get("open_rule")
            if rule:
                opens, closes = parse(rule["open"]), parse(rule["close"])
                if arrive < opens:
                    if (
                        not rule.get("allow_wait")
                        or (opens - arrive).total_seconds() > 3600
                    ):
                        blocked.add("CLOSED_PASSAGE")
                        continue
                    waiting = (opens - arrive).total_seconds() / 60
                    arrive = opens
                if (
                    arrive >= closes
                    or rule.get("semantics") == "whole"
                    and arrive + timedelta(minutes=minutes) > closes
                ):
                    blocked.add("CLOSED_PASSAGE")
                    continue
            if e["kind"] in ["mtr", "bus"]:
                service = next_service(e, arrive)
                if service is None:
                    blocked.add("NO_VALID_SERVICE")
                    continue
                wait, time_state = service
                waiting += wait
            duration = minutes + waiting
            penalty = (
                minutes * 2
                if preference == "few_stairs" and e["kind"] == "stairs"
                else 0
            )
            nextstate = (
                e["to_id"],
                new_exited,
                rides + int(e["kind"] in ["mtr", "bus"]),
            )
            nextscore = score + duration + penalty
            if nextscore >= best.get(nextstate, float("inf")):
                continue
            best[nextstate] = nextscore
            leg = dict(
                e,
                label=b["name_tc"],
                minutes=round(duration, 2),
                movement_minutes=round(minutes, 2),
                waiting_minutes=waiting,
                depart_at=arrive.isoformat(),
                arrival_at=(
                    departure + timedelta(minutes=elapsed + duration)
                ).isoformat(),
                time_state=time_state,
                fare_hkd=None,
            )
            heapq.heappush(
                queue,
                (nextscore, elapsed + duration, next(counter), nextstate, legs + [leg]),
            )
    raise RoutingError(
        "UNVERIFIED_ACCESS"
        if preference == "accessible"
        else next(iter(sorted(blocked)), "NO_ROUTE")
    )


def should_reroute(old_minutes, new_minutes, old_feasible=True, threshold=2):
    return not old_feasible or old_minutes - new_minutes >= threshold
