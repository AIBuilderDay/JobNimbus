import httpx

from logger import get_logger
from settings import settings

log = get_logger(__name__)

PLACES_AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete"
FIELD_MASK = (
    "suggestions.placePrediction.placeId,"
    "suggestions.placePrediction.text,"
    "suggestions.placePrediction.structuredFormat"
)


async def autocomplete(query: str) -> list[dict]:
    """Calls Google Places API (New) autocomplete. Returns list of place suggestions, [] if query is empty."""
    if not query.strip():
        return []

    log.info("places autocomplete query_len=%d", len(query))
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                PLACES_AUTOCOMPLETE_URL,
                headers={
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": settings.GOOGLE_MAPS_API_KEY,
                    "X-Goog-FieldMask": FIELD_MASK,
                },
                json={
                    "input": query,
                    "includedRegionCodes": ["us"],
                },
            )
        resp.raise_for_status()
    except httpx.HTTPError:
        log.exception("places autocomplete request failed for query_len=%d", len(query))
        raise

    results = _parse(resp.json().get("suggestions", []))
    log.info("places autocomplete returned %d suggestions", len(results))
    return results


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
