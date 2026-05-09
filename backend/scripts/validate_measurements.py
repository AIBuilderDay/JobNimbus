"""Run the Google Solar measurement path against the 5 example properties and print a diff table.

This is the pre-submission gut-check — same logic as
`tests/integration/test_benchmark_accuracy.py` but with a human-readable
table and a non-zero exit code if fewer than 4 of 5 fall within ±10%.

Run:
    cd backend && op run --env-file=.env -- uv run python -m scripts.validate_measurements

or via:
    task backend:validate
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

from services.google.geocoding import geocode
from services.google.solar import get_solar_data

REFERENCES = json.loads(
    (Path(__file__).parent.parent / "tests/fixtures/benchmark_references.json").read_text()
)
TOLERANCE = 0.10
PASS_THRESHOLD = 4


def _delta_pct(actual: float, ref: float) -> float:
    return (actual - ref) / ref * 100.0


def _within_tolerance(actual: float, ref_a: float, ref_b: float) -> bool:
    return (
        abs(actual - ref_a) / ref_a <= TOLERANCE
        or abs(actual - ref_b) / ref_b <= TOLERANCE
    )


async def _measure(address: str) -> float | None:
    """Geocode + Solar → slanted total roof area in sqft, or None on failure/no-coverage."""
    coords = await geocode(address)
    if coords is None:
        return None
    solar = await get_solar_data(coords["lat"], coords["lng"])
    if solar is None:
        return None
    return float(solar["total_roof_area_sq_ft"])


async def main() -> int:
    examples = REFERENCES["examples"]
    header = (
        f"{'Address':<48}"
        f"{'Measured':>10}"
        f"{'Ref A':>8}"
        f"{'Δ A':>8}"
        f"{'Ref B':>8}"
        f"{'Δ B':>8}"
        f"  Status"
    )
    print(header)
    print("-" * len(header))

    pass_count = 0
    skipped: list[str] = []

    for entry in examples:
        addr = entry["address"]
        ref_a = entry["reference_a_sqft"]
        ref_b = entry["reference_b_sqft"]
        try:
            measured = await _measure(addr)
        except Exception as exc:  # noqa: BLE001 — surface any error in the report and keep going
            print(f"{addr:<48}  ERROR: {exc}")
            skipped.append(addr)
            continue
        if measured is None:
            print(f"{addr:<48}  SKIP (no Solar coverage / geocode failed)")
            skipped.append(addr)
            continue

        ok = _within_tolerance(measured, ref_a, ref_b)
        if ok:
            pass_count += 1
        status = "✓" if ok else "✗"
        print(
            f"{addr:<48}"
            f"{measured:>10,.0f}"
            f"{ref_a:>8,}"
            f"{_delta_pct(measured, ref_a):>+7.1f}%"
            f"{ref_b:>8,}"
            f"{_delta_pct(measured, ref_b):>+7.1f}%"
            f"  {status}"
        )

    total = len(examples)
    print()
    print(f"{pass_count}/{total} within ±{TOLERANCE * 100:.0f}%")
    if skipped:
        print(f"skipped: {len(skipped)}")

    return 0 if pass_count >= PASS_THRESHOLD else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
