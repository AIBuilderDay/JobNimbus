import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.google.static_maps import build_url

router = APIRouter(prefix="/api/estimate")

_estimates: dict[str, dict[str, Any]] = {}


class StartEstimateRequest(BaseModel):
    address: str
    lat: float
    lng: float


class FacetSelection(BaseModel):
    facet_id: str
    state: str


class RefineRequest(BaseModel):
    facets: list[FacetSelection] = []


@router.post("/start")
def start_estimate(req: StartEstimateRequest) -> dict[str, Any]:
    estimate_id = str(uuid.uuid4())
    payload: dict[str, Any] = {
        "estimate_id": estimate_id,
        "address": req.address,
        "lat": req.lat,
        "lng": req.lng,
        "satellite_image_url": build_url(req.lat, req.lng),
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
