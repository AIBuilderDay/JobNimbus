from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel

from dao import listing_dao
from logger import get_logger
from models import DashboardStats, EstimateLineItem, EstimateListing, EstimateProgress, StatusCounts

log = get_logger(__name__)
router = APIRouter(prefix="/api/listings", tags=["listings"])


class SaveDraftRequest(BaseModel):
    estimate_id: str
    address: str
    selected_segment_count: int = 0
    total_segments: int = 0
    total_roof_area_sq_ft: float = 0
    material_name: str | None = None
    total_display: str | None = None
    margin_display: str | None = None


@router.get("")
def list_estimates(
    status: str = "all",
) -> dict:
    log.info("GET /api/listings status=%s", status)
    listings = listing_dao.list_estimates(status)
    counts = listing_dao.get_status_counts()
    return {
        "estimates": [l.model_dump() for l in listings],
        "counts": counts.model_dump(),
        "total": counts.all,
    }


@router.post("/draft")
def save_draft(req: SaveDraftRequest) -> dict:
    log.info("POST /api/listings/draft estimate_id=%s address=%s", req.estimate_id, req.address)

    parts = req.address.split(",")
    street = parts[0].strip() if parts else req.address
    city_state = ", ".join(p.strip() for p in parts[1:3]) if len(parts) > 1 else ""

    sq_val = round(req.total_roof_area_sq_ft / 100) if req.total_roof_area_sq_ft else None
    sq_ft_display = f"{round(req.total_roof_area_sq_ft):,} sf" if req.total_roof_area_sq_ft else "—"

    now = datetime.now(timezone.utc)
    step = 2 if req.selected_segment_count > 0 else 1
    total_steps = 5

    listing = EstimateListing(
        id=req.estimate_id[:8].upper(),
        version="v1",
        name=street,
        address=street,
        city_state=city_state,
        owner="",
        parcel="",
        total=req.total_display,
        margin=req.margin_display,
        sq=f"{sq_val} sq" if sq_val else None,
        sq_ft=sq_ft_display,
        status="draft",
        progress=EstimateProgress(current=step, total=total_steps),
        updated=now.strftime("%b %d, %Y"),
        updated_sub=now.strftime("%I:%M %p").lstrip("0"),
        stale_days=None,
    )
    listing_dao.save_listing(listing)
    log.info("draft saved estimate_id=%s", req.estimate_id)
    return {"ok": True}


@router.get("/stats")
def get_stats() -> dict:
    log.info("GET /api/listings/stats")
    stats = listing_dao.get_dashboard_stats()
    return stats.model_dump()


@router.delete("/{estimate_id}")
def delete_estimate(estimate_id: str) -> dict:
    log.info("DELETE /api/listings/%s", estimate_id)
    deleted = listing_dao.delete_listing(estimate_id)
    if not deleted:
        log.warning("listing not found estimate_id=%s", estimate_id)
    return {"ok": True, "deleted": deleted}


@router.get("/{estimate_id}/line-items")
def get_line_items(estimate_id: str) -> list[dict]:
    log.info("GET /api/listings/%s/line-items", estimate_id)
    items = listing_dao.get_line_items(estimate_id)
    return [i.model_dump() for i in items]
