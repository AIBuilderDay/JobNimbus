from logger import get_logger
from models import CatalogItem, Material

from .database import get_connection

log = get_logger(__name__)


def list_catalog(category: str | None = None) -> list[CatalogItem]:
    with get_connection() as conn:
        if category:
            rows = conn.execute(
                "SELECT * FROM catalog_items WHERE category = ? ORDER BY sort_order",
                (category,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM catalog_items ORDER BY sort_order",
            ).fetchall()
    return [
        CatalogItem(
            id=r["id"],
            name=r["name"],
            detail=r["detail"],
            color=r["color"],
            default_unit=r["default_unit"],
            default_unit_price=r["default_unit_price"],
            category=r["category"],
        )
        for r in rows
    ]


def list_materials(tab: str | None = None) -> list[Material]:
    with get_connection() as conn:
        if tab:
            rows = conn.execute(
                "SELECT * FROM materials WHERE tab = ? ORDER BY sort_order",
                (tab,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM materials ORDER BY tab, sort_order",
            ).fetchall()
    return [
        Material(
            id=r["id"],
            tab=r["tab"],
            name=r["name"],
            sub=r["sub"],
            price_display=r["price_display"],
            price_per_sf=r["price_per_sf"],
            swatch=r["swatch"],
        )
        for r in rows
    ]


def save_catalog_item(item: CatalogItem, sort_order: int = 0) -> None:
    with get_connection() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO catalog_items
               (id, name, detail, color, default_unit, default_unit_price, category, sort_order)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (item.id, item.name, item.detail, item.color,
             item.default_unit, item.default_unit_price, item.category, sort_order),
        )


def save_material(mat: Material, sort_order: int = 0) -> None:
    with get_connection() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO materials
               (id, tab, name, sub, price_display, price_per_sf, swatch, sort_order)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (mat.id, mat.tab, mat.name, mat.sub,
             mat.price_display, mat.price_per_sf, mat.swatch, sort_order),
        )
