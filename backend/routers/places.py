from fastapi import APIRouter
from pydantic import BaseModel

from logger import get_logger
from services.google.places import autocomplete

log = get_logger(__name__)
router = APIRouter()


class PlaceSuggestion(BaseModel):
    place_id: str
    main_text: str
    secondary_text: str
    full_text: str


@router.get("/api/places/autocomplete")
async def autocomplete_places(q: str) -> list[PlaceSuggestion]:
    log.info("GET /api/places/autocomplete query_len=%d", len(q))
    results = await autocomplete(q)
    return [PlaceSuggestion(**r) for r in results]
