import httpx
from urllib.parse import urlencode

from config import get_google_maps_api_key

SOLAR_API_BASE = "https://solar.googleapis.com/v1"
SQM_TO_SQFT = 10.7639
FRONTEND_REFERER = "http://localhost:5173"


async def get_solar_data(lat: float, lng: float) -> dict | None:
    """Returns parsed roof data from Solar API, or None if no coverage at this location.

    Tries HIGH quality first, falls back to MEDIUM. Some addresses have MEDIUM imagery
    only — without the fallback we'd silently miss them.
    """
    for quality in ("HIGH", "MEDIUM"):
        raw = await _fetch(lat, lng, quality)
        if raw is not None:
            return _parse(raw)
    return None


async def _fetch(lat: float, lng: float, quality: str) -> dict | None:
    params = urlencode({
        "location.latitude": lat,
        "location.longitude": lng,
        "requiredQuality": quality,
        "key": get_google_maps_api_key(),
    })
    url = f"{SOLAR_API_BASE}/buildingInsights:findClosest?{params}"

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, headers={"Referer": FRONTEND_REFERER})

    if resp.status_code == 404:
        return None

    resp.raise_for_status()
    return resp.json()


def _parse(data: dict) -> dict:
    solar = data.get("solarPotential", {})
    segments = []
    for i, seg in enumerate(solar.get("roofSegmentStats", [])):
        stats = seg.get("stats", {})
        area_sq_ft = stats.get("areaMeters2", 0) * SQM_TO_SQFT
        ground_area_sq_ft = stats.get("groundAreaMeters2", 0) * SQM_TO_SQFT
        segments.append({
            "id": i,
            "pitch_degrees": seg.get("pitchDegrees"),
            "azimuth_degrees": seg.get("azimuthDegrees"),
            "area_sq_ft": area_sq_ft,
            "ground_area_sq_ft": ground_area_sq_ft,
            "plane_height_meters": seg.get("planeHeightAtCenterMeters"),
            "bounding_box": seg.get("boundingBox"),
            "center": seg.get("center"),
        })

    return {
        "name": data.get("name"),
        "center": data.get("center"),
        "imagery_quality": data.get("imageryQuality"),
        "segments": segments,
        "total_roof_area_sq_ft": sum(s["area_sq_ft"] for s in segments),
    }
