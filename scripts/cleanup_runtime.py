"""Explicit retention cleanup of recoverable local feed snapshots only, never saved journeys."""

import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def cleanup(days=7):
    cutoff = time.time() - days * 86400
    removed = 0
    for p in (ROOT / "data/runtime").glob("*.json"):
        if p.stat().st_mtime < cutoff:
            p.unlink()
            removed += 1
    return removed


if __name__ == "__main__":
    print("Expired feed snapshots removed:", cleanup())
