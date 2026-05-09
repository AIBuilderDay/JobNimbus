import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.google.geocoding import geocode
from services.google.solar import get_solar_data
from services.google.static_maps import build_url

router = APIRouter(prefix="/api/estimate")

_estimates: dict[str, dict[str, Any]] = {}


class StartEstimateRequest(BaseModel):
    address: str
    lat: float | None = None
    lng: float | None = None


class FacetSelection(BaseModel):
    facet_id: str
    state: str


class RefineRequest(BaseModel):
    facets: list[FacetSelection] = []


@router.post("/start")
async def start_estimate(req: StartEstimateRequest) -> dict[str, Any]:
    estimate_id = str(uuid.uuid4())

    if req.lat is not None and req.lng is not None:
        lat, lng = req.lat, req.lng
        resolved_address = req.address
    else:
        coords = await geocode(req.address)
        if not coords:
            raise HTTPException(status_code=404, detail="Could not geocode address")
        lat = coords["lat"]
        lng = coords["lng"]
        resolved_address = coords["formatted_address"]

    solar = await get_solar_data(lat, lng)

    payload: dict[str, Any] = {
        "estimate_id": estimate_id,
        "address": resolved_address,
        "lat": lat,
        "lng": lng,
        "satellite_image_url": build_url(lat, lng),
        "solar": solar,
        "total": {"low": 0, "high": 0},
        "breakdown": [],
        "confidence_range": None,
    }
    _estimates[estimate_id] = payload
    return payload


@router.get("/{estimate_id}")
def get_estimate(estimate_id: str) -> dict[str, Any]:
    estimate = _estimates.get(estimate_id)
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    return estimate


@router.post("/{estimate_id}/refine")
def refine_estimate(estimate_id: str, req: RefineRequest) -> dict[str, Any]:
    estimate = _estimates.get(estimate_id)
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    estimate["facets"] = [f.model_dump() for f in req.facets]
    return estimate
