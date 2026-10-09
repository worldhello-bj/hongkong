import json
from pathlib import Path
from datetime import timedelta
from app.timeutil import parse

RULE = json.loads((Path(__file__).with_name("hsr.json")).read_text())


def check(
    arrival,
    departure,
    queue_minutes=8,
    security_minutes=8,
    immigration_minutes=10,
    walk_minutes=2,
    buffer_minutes=5,
):
    values = [
        queue_minutes,
        security_minutes,
        immigration_minutes,
        walk_minutes,
        buffer_minutes,
    ]
    if any(not 0 <= x <= 240 for x in values):
        raise ValueError("Process durations must be between 0 and 240 minutes")
    a, d = parse(arrival), parse(departure)
    start = max(a, d - timedelta(minutes=RULE["process_open_before_min"]))
    verify = start + timedelta(minutes=queue_minutes)
    gate = verify + timedelta(
        minutes=security_minutes + immigration_minutes + walk_minutes
    )
    board = max(gate, d - timedelta(minutes=RULE["boarding_open_before_min"]))
    vm = (
        d
        - timedelta(minutes=RULE["verification_close_before_min"] + buffer_minutes)
        - verify
    ).total_seconds() / 60
    bm = (
        d
        - timedelta(minutes=RULE["boarding_close_before_min"] + buffer_minutes)
        - board
    ).total_seconds() / 60
    status = (
        "CONDITIONAL"
        if min(vm, bm) > 0
        else ("BOUNDARY" if min(vm, bm) == 0 else "HSR_DEADLINE_MISSED")
    )
    return {
        "status": status,
        "verification_margin_minutes": round(vm, 2),
        "boarding_margin_minutes": round(bm, 2),
        "verification_complete_at": verify.isoformat(),
        "boarding_ready_at": board.isoformat(),
        "wait_before_process_minutes": (start - a).total_seconds() / 60,
        "departure_at": d.isoformat(),
        "limiting_stage": "verification" if vm <= bm else "boarding",
        "rule_version": RULE["version"],
        "source_url": RULE["source_url"],
        "assumptions": dict(
            zip(
                [
                    "queue_minutes",
                    "security_minutes",
                    "immigration_minutes",
                    "walk_minutes",
                    "buffer_minutes",
                ],
                values,
            )
        ),
        "warnings": [
            RULE["warning"],
            "Conditional calculation does not assess immigration eligibility or guarantee boarding.",
        ],
    }
