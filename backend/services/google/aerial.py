import httpx
from urllib.parse import urlencode

from config import get_google_maps_api_key

AERIAL_API_BASE = "https://aerialview.googleapis.com/v1"
FRONTEND_REFERER = "http://localhost:5173"
HTTP_TIMEOUT = 15.0


async def lookup_video(address: str) -> dict | None:
    """Returns video state + uris if a video exists for this address, None on 404."""
    params = urlencode({
        "address": address,
        "key": get_google_maps_api_key(),
    })
    url = f"{AERIAL_API_BASE}/videos:lookupVideo?{params}"

    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        resp = await client.get(url, headers={"Referer": FRONTEND_REFERER})

    if resp.status_code == 404:
        return None

    resp.raise_for_status()
    return resp.json()


async def render_video(address: str) -> dict:
    """Kicks off video rendering for an address. Returns immediate metadata (state will be PROCESSING)."""
    params = urlencode({"key": get_google_maps_api_key()})
    url = f"{AERIAL_API_BASE}/videos:renderVideo?{params}"

    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        resp = await client.post(
            url,
            headers={
                "Content-Type": "application/json",
                "Referer": FRONTEND_REFERER,
            },
            json={"address": address},
        )

    resp.raise_for_status()
    return resp.json()


async def ensure_video(address: str) -> dict:
    """Returns current video state, kicking off rendering if no video exists yet for this address."""
    existing = await lookup_video(address)
    if existing is not None:
        return existing
    return await render_video(address)
