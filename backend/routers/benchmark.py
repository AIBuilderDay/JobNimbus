"""Live benchmark endpoint — judge-proof for the qualification gate.

Runs the same logic as `tests/integration/test_benchmark_accuracy.py` but
against live Google Solar so the frontend can render a real-time
"X/5 within ±10%" panel. The 5 reference addresses are the ones we've
verified offline; the response includes our measured value, the two
reference measurements, the pct error against each, and a pass/fail flag.

CACHE: results are cached in memory for the process lifetime (Solar +
Geocoding don't change minute-to-minute and we want to spare the quota
when the page reloads). Cache busted with `?refresh=true`.
"""
import asyncio
import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from logger import get_logger
from services.google.geocoding import geocode
from services.google.solar import get_solar_data
from settings import settings

log = get_logger(__name__)
router = APIRouter(prefix="/api/benchmark", tags=["benchmark"])

TOLERANCE = 0.10
PASS_THRESHOLD = 4

_REFERENCES_PATH = Path(__file__).parent.parent / "tests" / "fixtures" / "benchmark_references.json"

_results_cache: dict[str, Any] | None = None


def _load_references() -> dict:
    return json.loads(_REFERENCES_PATH.read_text())


async def _measure_one(entry: dict) -> dict:
    """Resolve one fixture address against live Solar. Always returns a row,
    even on failure (status='error') — the UI needs to render *something*
    for every reference."""
    addr = entry["address"]
    log.info("benchmark measuring address=%s", addr)
    try:
        coords = await geocode(addr)
        if not coords:
            return {**entry, "status": "error", "error": "geocode returned no results"}
        solar = await get_solar_data(coords["lat"], coords["lng"])
        if solar is None:
            return {**entry, "status": "no_coverage", "error": "no Solar coverage at this location"}
    except Exception as e:
        log.exception("benchmark measure failed address=%s", addr)
        return {**entry, "status": "error", "error": str(e)}

    measured = solar["total_roof_area_sq_ft"]
    err_a = abs(measured - entry["reference_a_sqft"]) / entry["reference_a_sqft"]
    err_b = abs(measured - entry["reference_b_sqft"]) / entry["reference_b_sqft"]
    best = min(err_a, err_b)
    passed = best <= TOLERANCE

    log.info(
        "benchmark address=%s measured=%.0f refA=%s refB=%s err_min=%.2f%% passed=%s",
        addr, measured, entry["reference_a_sqft"], entry["reference_b_sqft"], best * 100, passed,
    )

    return {
        "address": addr,
        "pitch": entry["pitch"],
        "reference_a_sqft": entry["reference_a_sqft"],
        "reference_b_sqft": entry["reference_b_sqft"],
        "measured_sqft": round(measured, 1),
        "error_vs_a_pct": round(err_a * 100, 2),
        "error_vs_b_pct": round(err_b * 100, 2),
        "best_error_pct": round(best * 100, 2),
        "passed": passed,
        "imagery_quality": solar.get("imagery_quality"),
        "segments": len(solar["segments"]),
        "status": "ok",
        "location": {"lat": coords["lat"], "lng": coords["lng"]},
    }


@router.get("/results")
async def benchmark_results(
    refresh: bool = Query(False, description="Force re-fetch (bypass in-memory cache)."),
) -> dict[str, Any]:
    """Run the qualification benchmark live and return per-address results.

    Returns:
        - `tolerance_pct`: 10
        - `pass_threshold`: 4 (out of 5)
        - `pass_count`: how many of the 5 came in within ±10%
        - `total`: 5
        - `qualified`: pass_count >= pass_threshold
        - `results`: list of per-address rows for the proof table
    """
    global _results_cache
    log.info("GET /api/benchmark/results refresh=%s", refresh)

    if not settings.GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=503, detail="GOOGLE_MAPS_API_KEY not configured.")

    if _results_cache is not None and not refresh:
        log.info("benchmark: serving from cache")
        return _results_cache

    refs = _load_references()
    rows = await asyncio.gather(*[_measure_one(e) for e in refs["examples"]])
    pass_count = sum(1 for r in rows if r.get("passed"))

    payload = {
        "tolerance_pct": int(TOLERANCE * 100),
        "pass_threshold": PASS_THRESHOLD,
        "total": len(rows),
        "pass_count": pass_count,
        "qualified": pass_count >= PASS_THRESHOLD,
        "results": rows,
    }
    _results_cache = payload
    log.info(
        "benchmark complete pass_count=%d/%d qualified=%s",
        pass_count, len(rows), payload["qualified"],
    )
    return payload


@router.get("/references")
def benchmark_references() -> dict[str, Any]:
    """Return just the reference fixture (no live calls). Cheap; useful for
    rendering the proof table skeleton before measurements come back."""
    log.info("GET /api/benchmark/references")
    return _load_references()
