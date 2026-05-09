from fastapi import APIRouter

from dao import catalog_dao
from logger import get_logger

log = get_logger(__name__)
router = APIRouter(prefix="/api/catalog", tags=["catalog"])


@router.get("")
def list_catalog(category: str | None = None) -> list[dict]:
    log.info("GET /api/catalog category=%s", category)
    items = catalog_dao.list_catalog(category)
    return [i.model_dump() for i in items]


@router.get("/materials")
def list_materials(tab: str | None = None) -> dict:
    log.info("GET /api/catalog/materials tab=%s", tab)
    materials = catalog_dao.list_materials(tab)
    grouped: dict[str, list[dict]] = {}
    for m in materials:
        grouped.setdefault(m.tab, []).append({
            "id": m.id,
            "name": m.name,
            "sub": m.sub,
            "price": m.price_display,
            "pricePerSf": m.price_per_sf,
            "swatch": m.swatch,
        })
    return grouped
