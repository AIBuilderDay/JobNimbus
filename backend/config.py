# DEPRECATED: do not add new entries here. Use `from settings import settings` instead.
# This module exists only to preserve the legacy `get_google_maps_api_key()` import
# used by backend/services/google/*.py.

from fastapi import HTTPException

from settings import settings


def get_google_maps_api_key() -> str:
    if not settings.GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=500, detail="GOOGLE_MAPS_API_KEY not set")
    return settings.GOOGLE_MAPS_API_KEY
