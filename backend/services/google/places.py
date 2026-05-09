import httpx

from config import get_google_maps_api_key

PLACES_AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete"
FRONTEND_REFERER = "http://localhost:5173"
FIELD_MASK = (
    "suggestions.placePrediction.placeId,"
    "suggestions.placePrediction.text,"
    "suggestions.placePrediction.structuredFormat"
)


async def autocomplete(query: str) -> list[dict]:
    """Calls Google Places API (New) autocomplete. Returns list of place suggestions, [] if query is empty."""
    if not query.strip():
        return []

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            PLACES_AUTOCOMPLETE_URL,
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": get_google_maps_api_key(),
                "X-Goog-FieldMask": FIELD_MASK,
                "Referer": FRONTEND_REFERER,
            },
            json={
                "input": query,
                "includedRegionCodes": ["us"],
            },
        )

    resp.raise_for_status()
    return _parse(resp.json().get("suggestions", []))


def _parse(suggestions: list) -> list[dict]:
    results = []
    for s in suggestions:
        pred = s.get("placePrediction")
        if not pred:
            continue
        struct = pred.get("structuredFormat", {})
        results.append({
            "place_id": pred.get("placeId", ""),
            "main_text": struct.get("mainText", {}).get("text", ""),
            "secondary_text": struct.get("secondaryText", {}).get("text", ""),
            "full_text": pred.get("text", {}).get("text", ""),
        })
    return results
