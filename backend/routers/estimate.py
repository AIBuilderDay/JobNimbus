"""Estimate lifecycle endpoints.

Owns: starting an estimate (geocode + Solar in one call), reading it back,
and refining segment selection. Pricing/proposal/finalize live in their
own routers.

In-memory estimate store (`_estimates`) is shared with the pricing/proposal/
finalize routers via this module. SQLite is fine for listings but the
estimator working state is ephemeral by design — it doesn't need to survive
deploys.
"""
import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from logger import get_logger
from routers.model3d import _models as model_store, _run_full_pipeline
from services.google.geocoding import geocode
from services.google.solar import get_solar_data
from services.google.static_maps import build_url
from settings import settings

log = get_logger(__name__)
router = APIRouter(prefix="/api/estimate", tags=["estimate"])

# Shared in-memory store. Keyed by estimate_id. Other routers import this.
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
async def start_estimate(
    req: StartEstimateRequest,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    """Start a new estimate from an address.

    Geocodes (unless lat/lng pre-supplied), fetches Google Solar building
    insights, and kicks off 3D model generation in the background. The
    Solar payload returned here is what the frontend renders on the
    estimator and pricing pages — the slanted roof area lives at
    `solar.total_roof_area_sq_ft`.
    """
    estimate_id = str(uuid.uuid4())
    log.info(
        "POST /api/estimate/start estimate_id=%s address=%s lat=%s lng=%s",
        estimate_id, req.address, req.lat, req.lng,
    )

    if req.lat is not None and req.lng is not None:
        lat, lng = req.lat, req.lng
        resolved_address = req.address
    else:
        coords = await geocode(req.address)
        if not coords:
            log.warning("estimate_id=%s could not geocode address=%s", estimate_id, req.address)
            raise HTTPException(status_code=404, detail="Could not geocode address")
        lat = coords["lat"]
        lng = coords["lng"]
        resolved_address = coords["formatted_address"]

    solar = await get_solar_data(lat, lng)

    if settings.GOOGLE_MAPS_API_KEY:
        model_store[estimate_id] = {"status": "pending", "glb": None, "error": None}
        background_tasks.add_task(_run_full_pipeline, estimate_id, lat, lng)
    else:
        model_store[estimate_id] = {
            "status": "failed",
            "glb": None,
            "error": "Google Maps API key is not configured. 3D model generation unavailable.",
        }

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
    log.info(
        "estimate_id=%s ready solar_coverage=%s segments=%d",
        estimate_id,
        solar is not None,
        len(solar["segments"]) if solar else 0,
    )
    return payload


@router.get("/{estimate_id}")
def get_estimate(estimate_id: str) -> dict[str, Any]:
    log.info("GET /api/estimate/%s", estimate_id)
    estimate = _estimates.get(estimate_id)
    if not estimate:
        log.warning("GET /api/estimate/%s not found", estimate_id)
        raise HTTPException(status_code=404, detail="Estimate not found")
    return estimate


@router.post("/{estimate_id}/refine")
def refine_estimate(estimate_id: str, req: RefineRequest) -> dict[str, Any]:
    log.info("POST /api/estimate/%s/refine facets=%d", estimate_id, len(req.facets))
    estimate = _estimates.get(estimate_id)
    if not estimate:
        log.warning("POST /api/estimate/%s/refine not found", estimate_id)
        raise HTTPException(status_code=404, detail="Estimate not found")
    estimate["facets"] = [f.model_dump() for f in req.facets]
    return estimate
