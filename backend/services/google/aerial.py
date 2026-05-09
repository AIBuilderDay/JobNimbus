from urllib.parse import urlencode

import httpx

from logger import get_logger
from settings import settings

log = get_logger(__name__)

AERIAL_API_BASE = "https://aerialview.googleapis.com/v1"
FRONTEND_REFERER = "http://localhost:5173"
HTTP_TIMEOUT = 15.0


async def lookup_video(address: str) -> dict | None:
    """Returns video state + uris if a video exists for this address, None on 404."""
    log.info("looking up aerial video for address=%s", address)
    params = urlencode({
        "address": address,
        "key": settings.GOOGLE_MAPS_API_KEY,
    })
    url = f"{AERIAL_API_BASE}/videos:lookupVideo?{params}"

    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            resp = await client.get(url, headers={"Referer": FRONTEND_REFERER})
    except httpx.HTTPError:
        log.exception("aerial lookup failed for address=%s", address)
        raise

    if resp.status_code == 404:
        log.info("aerial lookup 404 (no video yet) for address=%s", address)
        return None

    try:
        resp.raise_for_status()
    except httpx.HTTPError:
        log.exception("aerial lookup non-2xx for address=%s status=%s", address, resp.status_code)
        raise
    data = resp.json()
    log.info("aerial lookup returned state=%s for address=%s", data.get("state"), address)
    return data


async def render_video(address: str) -> dict:
    """Kicks off video rendering for an address. Returns immediate metadata (state will be PROCESSING)."""
    log.info("rendering aerial video for address=%s", address)
    params = urlencode({"key": settings.GOOGLE_MAPS_API_KEY})
    url = f"{AERIAL_API_BASE}/videos:renderVideo?{params}"

    try:
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
    except httpx.HTTPError:
        log.exception("aerial render failed for address=%s", address)
        raise

    data = resp.json()
    log.info("aerial render kicked off state=%s for address=%s", data.get("state"), address)
    return data


async def ensure_video(address: str) -> dict:
    """Returns current video state, kicking off rendering if no video exists yet for this address."""
    existing = await lookup_video(address)
    if existing is not None:
        return existing
    return await render_video(address)
