import os

from fastapi import HTTPException


def get_google_maps_api_key() -> str:
    key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if not key:
        raise HTTPException(status_code=500, detail="GOOGLE_MAPS_API_KEY not set")
    return key


def get_replicate_api_token() -> str:
    key = os.environ.get("REPLICATE_API_TOKEN")
    if not key:
        raise HTTPException(status_code=500, detail="REPLICATE_API_TOKEN not set")
    return key
