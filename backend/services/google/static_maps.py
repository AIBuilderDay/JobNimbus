from urllib.parse import urlencode

from settings import settings


def build_url(lat: float, lng: float, zoom: int = 20, size: str = "800x800") -> str:
    params = urlencode({
        "center": f"{lat},{lng}",
        "zoom": zoom,
        "size": size,
        "maptype": "satellite",
        "key": settings.GOOGLE_MAPS_API_KEY,
    })
    return f"https://maps.googleapis.com/maps/api/staticmap?{params}"
