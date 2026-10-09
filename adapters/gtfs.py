"""Safe local GTFS Schedule importer preserving service dates and frequency semantics."""

import csv, io, zipfile
from app.timeutil import service_time, calendar_active

TABLES = [
    "stops",
    "routes",
    "trips",
    "stop_times",
    "calendar",
    "calendar_dates",
    "frequencies",
]


def load(path):
    result = {}
    with zipfile.ZipFile(path) as z:
        if sum(i.file_size for i in z.infolist()) > 100_000_000:
            raise ValueError("GTFS_TOO_LARGE")
        for name in TABLES:
            file = name + ".txt"
            if file in z.namelist():
                result[name] = list(
                    csv.DictReader(io.StringIO(z.read(file).decode("utf-8-sig")))
                )
    trips = {x["trip_id"] for x in result.get("trips", [])}
    stops = {x["stop_id"] for x in result.get("stops", [])}
    for row in result.get("stop_times", []):
        if row["trip_id"] not in trips or row["stop_id"] not in stops:
            raise ValueError("GTFS_MISSING_REFERENCE")
        service_time("2026-01-01", row["departure_time"])
    for row in result.get("frequencies", []):
        if int(row["headway_secs"]) <= 0:
            raise ValueError("INVALID_HEADWAY")
        row["prediction_kind"] = (
            "SCHEDULE" if row.get("exact_times") == "1" else "FREQUENCY_RANGE"
        )
    return result
