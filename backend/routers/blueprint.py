"""Blueprint endpoint — wireframe roof geometry for the BlueprintPage.

Reuses the existing roof_polygon_service which derives polygons from
Solar's mask + DSM GeoTIFFs. Annotations (segment ids, pitch, azimuth,
area) come straight from the Solar segments already on the estimate.
"""
from typing import Any

from fastapi import APIRouter, HTTPException

from logger import get_logger
from routers.estimate import _estimates
from services.google.data_layers import get_data_layers
from services.roof_polygon_service import extract_roof_polygons

log = get_logger(__name__)
router = APIRouter(prefix="/api/estimate", tags=["blueprint"])


@router.get("/{estimate_id}/blueprint")
async def get_blueprint(estimate_id: str) -> dict[str, Any]:
    """Return wireframe roof data for the BlueprintPage.

    Polygons come from data_layers (mask + DSM); annotations come from
    the Solar segments already cached on the estimate.
    """
    log.info("GET /api/estimate/%s/blueprint", estimate_id)
    estimate = _estimates.get(estimate_id)
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")

    lat = estimate.get("lat")
    lng = estimate.get("lng")
    if lat is None or lng is None:
        raise HTTPException(status_code=409, detail="Estimate has no coordinates.")

    layers = await get_data_layers(lat, lng)
    if not layers:
        log.info("blueprint: no data layers for estimate_id=%s", estimate_id)
        raise HTTPException(status_code=404, detail="No data layers available for this location.")

    polygons = extract_roof_polygons(layers["mask_bytes"], layers["dsm_bytes"])

    solar = estimate.get("solar") or {}
    annotations = []
    for i, seg in enumerate(solar.get("segments", [])):
        annotations.append({
            "segment_id": i,
            "pitch_degrees": seg.get("pitch_degrees"),
            "azimuth_degrees": seg.get("azimuth_degrees"),
            "area_sq_ft": seg.get("area_sq_ft"),
            "ground_area_sq_ft": seg.get("ground_area_sq_ft"),
        })

    log.info(
        "blueprint ready estimate_id=%s polygons=%d annotations=%d",
        estimate_id, len(polygons), len(annotations),
    )
    return {
        "estimate_id": estimate_id,
        "location": {"lat": lat, "lng": lng},
        "polygons": polygons,
        "annotations": annotations,
        "imagery_quality": solar.get("imagery_quality"),
    }
