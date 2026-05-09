from fastapi import APIRouter
from pydantic import BaseModel

from services.google.places import autocomplete

router = APIRouter()


class PlaceSuggestion(BaseModel):
    place_id: str
    main_text: str
    secondary_text: str
    full_text: str


@router.get("/api/places/autocomplete")
async def autocomplete_places(q: str) -> list[PlaceSuggestion]:
    results = await autocomplete(q)
    return [PlaceSuggestion(**r) for r in results]
