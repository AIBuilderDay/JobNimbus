import asyncio

import httpx
from urllib.parse import urlencode

from logger import get_logger
from settings import settings

log = get_logger(__name__)

STREET_VIEW_BASE = "https://maps.googleapis.com/maps/api/streetview"
METADATA_BASE = f"{STREET_VIEW_BASE}/metadata"

ALL_HEADINGS = [0, 45, 90, 135, 180, 225, 270, 315]

# Google returns a small placeholder (~8KB) when no imagery exists for a heading
PLACEHOLDER_SIZE_THRESHOLD = 15_000


async def check_coverage(lat: float, lng: float, radius: int = 50) -> dict | None:
    """Check if Street View imagery exists near this location."""
    params = urlencode({
        "location": f"{lat},{lng}",
        "radius": radius,
        "key": settings.GOOGLE_MAPS_API_KEY,
    })
    url = f"{METADATA_BASE}?{params}"

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url)

    resp.raise_for_status()
    data = resp.json()
    if data.get("status") != "OK":
        return None
    return data


async def _fetch_image(
    client: httpx.AsyncClient,
    lat: float,
    lng: float,
    heading: int,
    pitch: int,
    fov: int,
    size: str,
) -> tuple[int, bytes]:
    """Fetch a single Street View image. Returns (heading, image_bytes)."""
    params = urlencode({
        "location": f"{lat},{lng}",
        "heading": heading,
        "pitch": pitch,
        "fov": fov,
        "size": size,
        "key": settings.GOOGLE_MAPS_API_KEY,
    })
    resp = await client.get(f"{STREET_VIEW_BASE}?{params}")
    resp.raise_for_status()
    return heading, resp.content


async def capture_multi_angle(
    lat: float,
    lng: float,
    headings: list[int] | None = None,
    pitch: int = 10,
    fov: int = 90,
    size: str = "640x640",
) -> list[tuple[int, bytes]]:
    """Capture Street View images from multiple headings. Returns [(heading, jpeg_bytes), ...]."""
    if headings is None:
        headings = ALL_HEADINGS

    async with httpx.AsyncClient(timeout=15.0) as client:
        tasks = [_fetch_image(client, lat, lng, h, pitch, fov, size) for h in headings]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    valid = []
    for r in results:
        if isinstance(r, Exception):
            continue
        heading, img_bytes = r
        if len(img_bytes) > PLACEHOLDER_SIZE_THRESHOLD:
            valid.append((heading, img_bytes))

    return valid


async def get_building_images(lat: float, lng: float, num_views: int = 4) -> list[bytes]:
    """
    Capture multi-angle Street View images + satellite top-down.
    Returns up to num_views+1 images (street views + 1 satellite).
    Raises ValueError if no Street View coverage.
    """
    coverage = await check_coverage(lat, lng)
    if not coverage:
        raise ValueError("No Street View coverage at this location")

    images_with_heading = await capture_multi_angle(lat, lng)
    if not images_with_heading:
        raise ValueError("No usable Street View images found at this location")

    # Pick evenly distributed views
    images_with_heading.sort(key=lambda x: x[0])
    if len(images_with_heading) > num_views:
        step = len(images_with_heading) / num_views
        selected = [images_with_heading[int(i * step)] for i in range(num_views)]
    else:
        selected = images_with_heading

    street_images = [img for _, img in selected]

    # Add satellite top-down image
    from services.google.static_maps import build_url
    sat_url = build_url(lat, lng)
    async with httpx.AsyncClient(timeout=10.0) as client:
        sat_resp = await client.get(sat_url)
    if sat_resp.status_code == 200:
        street_images.append(sat_resp.content)

    return street_images
