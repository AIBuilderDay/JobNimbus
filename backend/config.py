import os

from fastapi import HTTPException


def get_google_maps_api_key() -> str:
    key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if not key:
        raise HTTPException(status_code=500, detail="GOOGLE_MAPS_API_KEY not set")
    return key
