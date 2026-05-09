"""Hackathon-qualification accuracy suite (live Google Solar).

Three things this protects:

1. Google Solar slanted-area path lands within ±10% of one of the two reference
   measurements for ≥4 of the 5 example properties.
2. Roof-area-not-footprint hard guard — if the disqualifying bug ever returns,
   this goes red.
3. Sanity check that nobody has wedged a pitch multiplier into Solar's parse
   path (Solar's `areaMeters2` is already slanted).

Skipped when `GOOGLE_MAPS_API_KEY` is unset / set to the test stub. Run locally
via `task backend:test` with secrets resolved.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from services.google.geocoding import geocode
from services.google.solar import get_solar_data
from settings import settings

REFERENCES = json.loads(
    (Path(__file__).parent.parent / "fixtures" / "benchmark_references.json").read_text()
)
TOLERANCE = 0.10
PASS_THRESHOLD = 4

pytestmark = pytest.mark.skipif(
    not settings.GOOGLE_MAPS_API_KEY or settings.GOOGLE_MAPS_API_KEY.startswith("test-"),
    reason="GOOGLE_MAPS_API_KEY not set (or stub) — skipping live Google API tests",
)

# Cache live results across tests so we hit each address exactly once per run.
_RESULTS: dict[str, dict] = {}


async def _measured(address: str) -> dict:
    if address in _RESULTS:
        return _RESULTS[address]
    coords = await geocode(address)
    if coords is None:
        pytest.skip(f"geocode returned None for {address}")
    solar = await get_solar_data(coords["lat"], coords["lng"])
    if solar is None:
        pytest.skip(f"no Solar coverage for {address}")
    _RESULTS[address] = {"coords": coords, "solar": solar}
    return _RESULTS[address]


def _within_tolerance(actual: float, ref_a: float, ref_b: float) -> bool:
    return (
        abs(actual - ref_a) / ref_a <= TOLERANCE
        or abs(actual - ref_b) / ref_b <= TOLERANCE
    )


@pytest.mark.asyncio
@pytest.mark.integration
async def test_solar_path_meets_threshold():
    pass_count = 0
    misses: list[str] = []
    for entry in REFERENCES["examples"]:
        result = await _measured(entry["address"])
        measured = result["solar"]["total_roof_area_sq_ft"]
        if _within_tolerance(measured, entry["reference_a_sqft"], entry["reference_b_sqft"]):
            pass_count += 1
        else:
            misses.append(
                f"{entry['address']}: measured={measured:.0f} "
                f"refA={entry['reference_a_sqft']} refB={entry['reference_b_sqft']}"
            )

    assert pass_count >= PASS_THRESHOLD, (
        f"Only {pass_count}/{len(REFERENCES['examples'])} within ±{TOLERANCE * 100:.0f}%. "
        f"Misses:\n  " + "\n  ".join(misses)
    )


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.parametrize("entry", REFERENCES["examples"], ids=lambda e: e["address"])
async def test_roof_area_not_footprint_guard(entry):
    """For pitch ≥ 4:12, slanted roof area must exceed projected footprint × 1.05.

    If this ever flips green→red, we are about to ship the disqualifying bug.
    Footprint comes from Solar's per-segment `groundAreaMeters2` (projected area).
    """
    rise = int(entry["pitch"].split(":")[0])
    if rise < 4:
        pytest.skip(f"pitch {entry['pitch']} below 4:12 — guard does not apply")

    solar = (await _measured(entry["address"]))["solar"]
    measured = solar["total_roof_area_sq_ft"]
    footprint = sum(s["ground_area_sq_ft"] for s in solar["segments"])
    if footprint <= 0:
        pytest.skip(f"footprint not exposed by Solar for {entry['address']}")

    assert measured > footprint * 1.05, (
        f"{entry['address']}: measured={measured:.0f} sqft is not > "
        f"footprint={footprint:.0f} sqft × 1.05 — "
        "this is the roof-area-vs-footprint disqualification bug"
    )


@pytest.mark.asyncio
@pytest.mark.integration
async def test_solar_slanted_area_sanity():
    """Sum-of-segment slanted areas must equal the parsed total exactly.

    Catches anyone wedging a pitch factor into the parse path. Solar's
    `areaMeters2` is already slanted — multiplying again would inflate the
    submitted number ~5–20%.
    """
    entry = REFERENCES["examples"][0]
    solar = (await _measured(entry["address"]))["solar"]
    sum_of_segments = sum(s["area_sq_ft"] for s in solar["segments"])
    assert abs(sum_of_segments - solar["total_roof_area_sq_ft"]) < 0.01, (
        f"sum-of-segments={sum_of_segments:.4f} != "
        f"total={solar['total_roof_area_sq_ft']:.4f} — "
        "a pitch factor may have been wedged into the parse path"
    )
