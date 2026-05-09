from fastapi import APIRouter

from dao import listing_dao
from logger import get_logger
from models import EstimateLineItem, EstimateListing, StatusCounts

log = get_logger(__name__)
router = APIRouter(prefix="/api/listings")


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


@router.get("/{estimate_id}/line-items")
def get_line_items(estimate_id: str) -> list[dict]:
    log.info("GET /api/listings/%s/line-items", estimate_id)
    items = listing_dao.get_line_items(estimate_id)
    return [i.model_dump() for i in items]
