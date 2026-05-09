from typing import Any

from fastapi import APIRouter, HTTPException, Query

from logger import get_logger
from services.google.data_layers import get_data_layers
from services.roof_polygon_service import extract_roof_polygons

log = get_logger(__name__)
router = APIRouter(prefix="/api/roof-polygons", tags=["roof-polygons"])


@router.get("")
async def get_roof_polygons(
    lat: float = Query(...),
    lng: float = Query(...),
) -> dict[str, Any]:
    log.info("GET /api/roof-polygons lat=%s lng=%s", lat, lng)

    layers = await get_data_layers(lat, lng)
    if not layers:
        raise HTTPException(status_code=404, detail="No data layers available for this location")

    polygons = extract_roof_polygons(layers["mask_bytes"], layers["dsm_bytes"])

    log.info("returning %d polygons for lat=%s lng=%s", len(polygons), lat, lng)
    return {"polygons": polygons}
