import httpx
from urllib.parse import urlencode

from config import get_google_maps_api_key

GEOCODING_API_BASE = "https://maps.googleapis.com/maps/api/geocode/json"
FRONTEND_REFERER = "http://localhost:5173"


async def geocode(address: str) -> dict | None:
    """Returns lat/lng + formatted address for an address string, or None if no match."""
    params = urlencode({
        "address": address,
        "key": get_google_maps_api_key(),
    })
    url = f"{GEOCODING_API_BASE}?{params}"

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, headers={"Referer": FRONTEND_REFERER})

    resp.raise_for_status()
    data = resp.json()

    status = data.get("status")
    if status == "ZERO_RESULTS":
        return None
    if status != "OK":
        raise RuntimeError(f"Geocoding API error: {status}")

    result = data["results"][0]
    location = result["geometry"]["location"]
    return {
        "lat": location["lat"],
        "lng": location["lng"],
        "formatted_address": result["formatted_address"],
        "place_id": result.get("place_id"),
    }
