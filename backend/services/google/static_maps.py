from urllib.parse import urlencode

from config import get_google_maps_api_key


def build_url(lat: float, lng: float, zoom: int = 20, size: str = "800x800") -> str:
    params = urlencode({
        "center": f"{lat},{lng}",
        "zoom": zoom,
        "size": size,
        "maptype": "satellite",
        "key": get_google_maps_api_key(),
    })
    return f"https://maps.googleapis.com/maps/api/staticmap?{params}"
