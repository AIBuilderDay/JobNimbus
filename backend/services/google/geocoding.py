from urllib.parse import urlencode

import httpx

from logger import get_logger
from settings import settings

log = get_logger(__name__)

GEOCODING_API_BASE = "https://maps.googleapis.com/maps/api/geocode/json"


async def geocode(address: str) -> dict | None:
    """Returns lat/lng + formatted address for an address string, or None if no match."""
    log.info("geocoding address=%s", address)
    params = urlencode({
        "address": address,
        "key": settings.GOOGLE_MAPS_API_KEY,
    })
    url = f"{GEOCODING_API_BASE}?{params}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
        resp.raise_for_status()
    except httpx.HTTPError:
        log.exception("geocode request failed for address=%s", address)
        raise

    data = resp.json()
    status = data.get("status")
    if status == "ZERO_RESULTS":
        log.info("geocode returned zero results for address=%s", address)
        return None
    if status != "OK":
        log.error("geocode returned non-OK status=%s for address=%s", status, address)
        raise RuntimeError(f"Geocoding API error: {status}")

    result = data["results"][0]
    location = result["geometry"]["location"]
    log.info(
        "geocoded address=%s -> lat=%s lng=%s formatted=%s",
        address, location["lat"], location["lng"], result["formatted_address"],
    )
    return {
        "lat": location["lat"],
        "lng": location["lng"],
        "formatted_address": result["formatted_address"],
        "place_id": result.get("place_id"),
    }
