from urllib.parse import urlencode

import httpx

from logger import get_logger
from settings import settings

log = get_logger(__name__)

SOLAR_API_BASE = "https://solar.googleapis.com/v1"


async def get_data_layers(
    lat: float,
    lng: float,
    radius_meters: float = 50,
    pixel_size_meters: float = 0.1,
) -> dict | None:
    """Fetch mask + DSM GeoTIFFs from Solar API dataLayers endpoint."""
    params = urlencode({
        "location.latitude": lat,
        "location.longitude": lng,
        "radiusMeters": radius_meters,
        "view": "FULL_LAYERS",
        "requiredQuality": "HIGH",
        "pixelSizeMeters": pixel_size_meters,
        "key": settings.GOOGLE_MAPS_API_KEY,
    })
    url = f"{SOLAR_API_BASE}/dataLayers:get?{params}"
    log.info("fetching data layers lat=%s lng=%s radius=%s", lat, lng, radius_meters)

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url)

            if resp.status_code == 404:
                log.info("no data layers for lat=%s lng=%s", lat, lng)
                return None

            resp.raise_for_status()
            layers = resp.json()

            mask_url = layers.get("maskUrl")
            dsm_url = layers.get("dsmUrl")
            if not mask_url or not dsm_url:
                log.warning("data layers response missing maskUrl or dsmUrl")
                return None

            key_param = f"&key={settings.GOOGLE_MAPS_API_KEY}"
            mask_resp = await client.get(f"{mask_url}{key_param}", timeout=30.0)
            mask_resp.raise_for_status()

            dsm_resp = await client.get(f"{dsm_url}{key_param}", timeout=30.0)
            dsm_resp.raise_for_status()

            log.info(
                "data layers fetched mask=%d bytes dsm=%d bytes",
                len(mask_resp.content), len(dsm_resp.content),
            )
            return {
                "mask_bytes": mask_resp.content,
                "dsm_bytes": dsm_resp.content,
            }
    except httpx.HTTPError:
        log.exception("data layers fetch failed lat=%s lng=%s", lat, lng)
        raise
