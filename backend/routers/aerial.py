from typing import Any

from fastapi import APIRouter

from logger import get_logger
from services.google.aerial import ensure_video

log = get_logger(__name__)
router = APIRouter()


@router.get("/api/aerial")
async def get_aerial_video(address: str) -> dict[str, Any]:
    log.info("GET /api/aerial address=%s", address)
    return await ensure_video(address)
