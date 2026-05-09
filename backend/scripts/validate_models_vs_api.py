"""Validate Pydantic models against real API responses.

Hits Google Geocoding + Google Solar with the configured key, then tries to
construct our `models/` Pydantic models from each response. Reports:

  - Raw keys returned by each endpoint
  - Whether the model accepts the data (with the obvious field renames)
  - Which raw keys our model does not yet capture
  - A round-trip check: model_dump_json -> model_validate_json

Usage:
    cd backend && uv run python scripts/validate_models_vs_api.py
    cd backend && uv run python scripts/validate_models_vs_api.py "1234 Some St, City, ST"
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from urllib.parse import urlencode

import httpx
from pydantic import ValidationError

# Allow `python scripts/foo.py` from backend/ without installing the package.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from logger import get_logger  # noqa: E402
from models import Address, Measurement, RoofSegment  # noqa: E402
from settings import settings  # noqa: E402

log = get_logger(__name__)

GEOCODING_URL = "https://maps.googleapis.com/maps/api/geocode/json"
SOLAR_URL = "https://solar.googleapis.com/v1/buildingInsights:findClosest"
SQM_TO_SQFT = 10.7639

# 5 example properties from backend/docs/benchmark-requirements-jobnimbus.md
DEFAULT_ADDRESSES = [
    "21106 Kenswick Meadows Ct, Humble, TX 77338",
    "5914 Copper Lilly Lane, Spring, TX 77389",
    "122 NW 13th Ave, Cape Coral, FL 33993",
    "14132 Trenton Ave, Orland Park, IL 60462",
    "835 S Cobble Creek, Nixa, MO 65714",
]


async def fetch_geocode(client: httpx.AsyncClient, address: str) -> dict | None:
    params = urlencode({"address": address, "key": settings.GOOGLE_MAPS_API_KEY})
    resp = await client.get(f"{GEOCODING_URL}?{params}")
    resp.raise_for_status()
    data = resp.json()
    if data.get("status") != "OK":
        print(f"  geocode status={data.get('status')} for {address!r}")
        return None
    return data["results"][0]


async def fetch_solar(client: httpx.AsyncClient, lat: float, lng: float) -> dict | None:
    for quality in ("HIGH", "MEDIUM"):
        params = urlencode({
            "location.latitude": lat,
            "location.longitude": lng,
            "requiredQuality": quality,
            "key": settings.GOOGLE_MAPS_API_KEY,
        })
        resp = await client.get(f"{SOLAR_URL}?{params}")
        if resp.status_code == 404:
            continue
        resp.raise_for_status()
        return resp.json()
    return None


def hr(title: str) -> None:
    print(f"\n{'-' * 4} {title} {'-' * (60 - len(title))}")


def report_address_fit(raw_input: str, geo_result: dict) -> Address | None:
    hr("Address vs Geocoding API")
    location = geo_result["geometry"]["location"]
    raw_keys = sorted(geo_result.keys())
    print(f"raw geocoding keys: {raw_keys}")

    # Geocoding -> Address. Field names are aligned now; only `geometry.location`
    # needs flattening into lat/lng.
    adapter = {
        "raw_input": raw_input,
        "formatted_address": geo_result["formatted_address"],
        "lat": location["lat"],
        "lng": location["lng"],
        "place_id": geo_result.get("place_id"),
        "address_components": geo_result.get("address_components", []),
    }
    try:
        addr = Address(**adapter)
    except ValidationError as e:
        print(f"  Address rejected the adapted payload:\n{e}")
        return None
    print(f"  built: {addr.formatted_address} ({addr.lat}, {addr.lng})")
    print(f"  address_components captured: {len(addr.address_components)} entries")
    rebuilt = Address.model_validate_json(addr.model_dump_json())
    print(f"  json round-trip ok: {rebuilt == addr}")

    captured = {"formatted_address", "geometry", "place_id", "address_components"}
    uncaptured = set(raw_keys) - captured
    if uncaptured:
        print(f"  raw keys NOT captured by Address (informational): {sorted(uncaptured)}")
    return addr


def report_roof_segment_fit(seg_raw: dict) -> None:
    hr("RoofSegment vs Solar roofSegmentStats[0]")
    raw_keys = sorted(seg_raw.keys())
    print(f"raw segment keys: {raw_keys}")
    stats = seg_raw.get("stats", {})
    area_sqft = stats.get("areaMeters2", 0.0) * SQM_TO_SQFT

    # Field-rename adapter: Solar segment -> RoofSegment
    adapter = {
        "pitch_degrees": seg_raw.get("pitchDegrees", 0.0),         # camelCase -> snake
        "azimuth_degrees": seg_raw.get("azimuthDegrees", 0.0),
        "area_sqft": area_sqft,                                     # nested stats.areaMeters2 -> sqft
        "pitch_ratio": None,                                        # Solar gives degrees only
    }
    try:
        seg = RoofSegment(**adapter)
    except ValidationError as e:
        print(f"  RoofSegment rejected the adapted payload:\n{e}")
        return
    print(f"  built: {seg!r}")

    captured = {"pitchDegrees", "azimuthDegrees", "stats"}
    uncaptured = set(raw_keys) - captured
    if uncaptured:
        print(f"  raw segment keys NOT captured by RoofSegment: {sorted(uncaptured)}")


def report_measurement_fit(address: str, predominant_pitch_guess: str, solar_raw: dict) -> None:
    hr("Measurement vs aggregated Solar response")
    solar_pot = solar_raw.get("solarPotential", {})
    raw_segs = solar_pot.get("roofSegmentStats", [])
    segments = []
    for s in raw_segs:
        stats = s.get("stats", {})
        segments.append(RoofSegment(
            pitch_degrees=s.get("pitchDegrees", 0.0),
            azimuth_degrees=s.get("azimuthDegrees", 0.0),
            area_sqft=stats.get("areaMeters2", 0.0) * SQM_TO_SQFT,
        ))
    total_area = sum(s.area_sqft for s in segments)
    try:
        m = Measurement(
            address=address,
            total_roof_area_sqft=total_area,
            predominant_pitch=predominant_pitch_guess,
            source="google_solar",
            sources_consulted=["google_solar"],
            segments=segments,
            raw=solar_raw,  # full upstream blob
        )
    except ValidationError as e:
        print(f"  Measurement rejected the adapted payload:\n{e}")
        return
    print(f"  built: {len(m.segments)} segments, total_roof_area_sqft={m.total_roof_area_sqft:.1f}")
    print(f"  raw blob preserved (top-level keys): {sorted(m.raw.keys())}")
    rebuilt = Measurement.model_validate_json(m.model_dump_json())
    print(f"  json round-trip ok: {rebuilt == m}")

    # Apply pitch multiplier and confirm idempotency
    bumped = m.apply_pitch_multiplier(6, 12)
    twice = bumped.apply_pitch_multiplier(6, 12)
    print(
        f"  apply_pitch_multiplier(6,12): {m.total_roof_area_sqft:.1f} -> "
        f"{bumped.total_roof_area_sqft:.1f} (multiplier={bumped.pitch_multiplier_applied:.4f}); "
        f"idempotent={twice is bumped}"
    )


async def main(addresses: list[str]) -> None:
    if not settings.GOOGLE_MAPS_API_KEY or settings.GOOGLE_MAPS_API_KEY.startswith("op://"):
        print("GOOGLE_MAPS_API_KEY is not resolved — run via `task backend:dev` or `op run`.")
        return

    async with httpx.AsyncClient(timeout=15.0) as client:
        for raw_address in addresses:
            print(f"\n{'=' * 70}\nADDRESS: {raw_address}\n{'=' * 70}")
            try:
                geo = await fetch_geocode(client, raw_address)
            except httpx.HTTPError as e:
                print(f"  geocode failed: {e}")
                continue
            if geo is None:
                continue
            addr = report_address_fit(raw_address, geo)
            if addr is None:
                continue

            try:
                solar = await fetch_solar(client, addr.lat, addr.lng)
            except httpx.HTTPError as e:
                print(f"  solar failed: {e}")
                continue
            if solar is None:
                print("  no solar coverage")
                continue

            segs = solar.get("solarPotential", {}).get("roofSegmentStats", [])
            if segs:
                report_roof_segment_fit(segs[0])
            report_measurement_fit(raw_address, "6:12", solar)


if __name__ == "__main__":
    arg_addresses = sys.argv[1:] or DEFAULT_ADDRESSES
    asyncio.run(main(arg_addresses))
