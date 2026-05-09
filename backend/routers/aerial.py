from typing import Any

from fastapi import APIRouter

from services.google.aerial import ensure_video

router = APIRouter()


@router.get("/api/aerial")
async def get_aerial_video(address: str) -> dict[str, Any]:
    return await ensure_video(address)
