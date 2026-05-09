"""Generic measurement endpoint.

Wraps Geocoding + Solar in one call so the frontend can ask "give me the
roof for this address" without orchestrating two requests. Returns the
slanted roof area (Solar's `areaMeters2` is already slanted — do NOT
multiply by a pitch factor in this path), the per-segment breakdown, and
the projected ground footprint for sanity-check display.
"""
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from logger import get_logger
from services.google.geocoding import geocode
from services.google.solar import get_solar_data
from services.google.static_maps import build_url

log = get_logger(__name__)
router = APIRouter(prefix="/api/measurement", tags=["measurement"])


@router.get("")
async def measure(
    address: str | None = Query(None, description="Street address. Required if lat/lng not provided."),
    lat: float | None = Query(None),
    lng: float | None = Query(None),
) -> dict[str, Any]:
    """Measure a roof. Pass `address` (geocoded internally) or `lat`+`lng`.

    Returns:
        - `address`: Google-formatted address (or input passthrough if lat/lng given)
        - `location`: {lat, lng}
        - `satellite_image_url`: static-maps URL for thumbnail rendering
        - `solar`: full Solar building insights (segments, imagery quality, …)
        - `summary.total_roof_area_sq_ft`: SUBMITTED slanted area
        - `summary.total_ground_area_sq_ft`: projected footprint (for sanity checks)
        - `summary.segments`: count of detected roof segments
        - `summary.imagery_quality`: HIGH | MEDIUM | LOW
    """
    log.info("GET /api/measurement address=%s lat=%s lng=%s", address, lat, lng)

    if lat is None or lng is None:
        if not address:
            raise HTTPException(status_code=400, detail="Provide `address` or both `lat` and `lng`.")
        coords = await geocode(address)
        if not coords:
            log.warning("measurement: could not geocode address=%s", address)
            raise HTTPException(status_code=404, detail="Could not geocode address")
        lat = coords["lat"]
        lng = coords["lng"]
        resolved_address = coords["formatted_address"]
    else:
        resolved_address = address or f"{lat},{lng}"

    solar = await get_solar_data(lat, lng)
    if solar is None:
        log.info("measurement: no Solar coverage at lat=%s lng=%s", lat, lng)
        raise HTTPException(
            status_code=404,
            detail="No Solar coverage for this location. Try a different address.",
        )

    total_ground = sum(s.get("ground_area_sq_ft", 0) for s in solar["segments"])
    summary = {
        "total_roof_area_sq_ft": round(solar["total_roof_area_sq_ft"], 2),
        "total_ground_area_sq_ft": round(total_ground, 2),
        "segments": len(solar["segments"]),
        "imagery_quality": solar.get("imagery_quality"),
    }
    log.info(
        "measurement ready address=%s segments=%d total_sqft=%.0f imagery=%s",
        resolved_address, summary["segments"],
        summary["total_roof_area_sq_ft"], summary["imagery_quality"],
    )

    return {
        "address": resolved_address,
        "location": {"lat": lat, "lng": lng},
        "satellite_image_url": build_url(lat, lng),
        "solar": solar,
        "summary": summary,
    }
