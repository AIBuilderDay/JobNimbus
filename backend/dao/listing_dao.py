from logger import get_logger
from models import DashboardStats, EstimateLineItem, EstimateListing, EstimateProgress, StatusCounts

from .database import get_connection

log = get_logger(__name__)


def _row_to_listing(row) -> EstimateListing:
    progress = None
    if row["progress_current"] is not None and row["progress_total"] is not None:
        progress = EstimateProgress(
            current=row["progress_current"],
            total=row["progress_total"],
        )
    return EstimateListing(
        id=row["id"],
        version=row["version"],
        name=row["name"],
        address=row["address"],
        city_state=row["city_state"],
        owner=row["owner"],
        parcel=row["parcel"],
        total=row["total_display"],
        margin=row["margin_display"],
        sq=row["sq"],
        sq_ft=row["sq_ft"],
        status=row["status"],
        progress=progress,
        updated=row["updated"],
        updated_sub=row["updated_sub"],
        stale_days=row["stale_days"],
    )


def list_estimates(status: str | None = None) -> list[EstimateListing]:
    with get_connection() as conn:
        if status and status != "all":
            rows = conn.execute(
                "SELECT * FROM estimate_listings WHERE status = ? ORDER BY created_at DESC",
                (status,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM estimate_listings ORDER BY created_at DESC",
            ).fetchall()
    return [_row_to_listing(r) for r in rows]


def get_status_counts() -> StatusCounts:
    with get_connection() as conn:
        row = conn.execute(
            """SELECT
                 COUNT(*) as total,
                 SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END) as draft,
                 SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) as sent,
                 SUM(CASE WHEN status='signed' THEN 1 ELSE 0 END) as signed,
                 SUM(CASE WHEN status='expired' THEN 1 ELSE 0 END) as expired
               FROM estimate_listings""",
        ).fetchone()
    return StatusCounts(
        all=row["total"],
        draft=row["draft"],
        sent=row["sent"],
        signed=row["signed"],
        expired=row["expired"],
    )


def get_line_items(estimate_id: str) -> list[EstimateLineItem]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM estimate_line_items WHERE estimate_id = ? ORDER BY sort_order",
            (estimate_id,),
        ).fetchall()
    return [
        EstimateLineItem(
            color=r["color"],
            name=r["name"],
            detail=r["detail"],
            qty=r["qty"],
            unit_price=r["unit_price"],
            total=r["total"],
            category=r["category"],
        )
        for r in rows
    ]


def get_dashboard_stats() -> DashboardStats:
    with get_connection() as conn:
        row = conn.execute(
            """SELECT
                 COALESCE(SUM(CASE WHEN status IN ('draft','sent')
                     THEN CAST(REPLACE(REPLACE(total_display,'$',''),',','') AS INTEGER)
                     ELSE 0 END), 0) AS pipeline_cents,
                 SUM(CASE WHEN status IN ('draft','sent') THEN 1 ELSE 0 END) AS pipeline_count,
                 SUM(CASE WHEN status='signed' THEN 1 ELSE 0 END) AS signed_count,
                 COALESCE(SUM(CASE WHEN status='signed'
                     THEN CAST(REPLACE(REPLACE(total_display,'$',''),',','') AS INTEGER)
                     ELSE 0 END), 0) AS signed_cents,
                 SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END) AS drafts_open,
                 SUM(CASE WHEN status='draft' AND stale_days > 7 THEN 1 ELSE 0 END) AS drafts_stalled
               FROM estimate_listings""",
        ).fetchone()
    return DashboardStats(
        pipeline_value_cents=row["pipeline_cents"] * 100,
        pipeline_count=row["pipeline_count"],
        signed_count=row["signed_count"],
        signed_value_cents=row["signed_cents"] * 100,
        drafts_open=row["drafts_open"],
        drafts_stalled=row["drafts_stalled"],
    )


def save_listing(listing: EstimateListing) -> None:
    progress_current = listing.progress.current if listing.progress else None
    progress_total = listing.progress.total if listing.progress else None
    with get_connection() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO estimate_listings
               (id, version, name, address, city_state, owner, parcel,
                total_display, margin_display, sq, sq_ft, status,
                progress_current, progress_total, updated, updated_sub, stale_days)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (listing.id, listing.version, listing.name, listing.address,
             listing.city_state, listing.owner, listing.parcel,
             listing.total, listing.margin, listing.sq, listing.sq_ft,
             listing.status, progress_current, progress_total,
             listing.updated, listing.updated_sub, listing.stale_days),
        )


def delete_listing(estimate_id: str) -> bool:
    with get_connection() as conn:
        cursor = conn.execute(
            "DELETE FROM estimate_listings WHERE id = ?",
            (estimate_id,),
        )
        conn.execute(
            "DELETE FROM estimate_line_items WHERE estimate_id = ?",
            (estimate_id,),
        )
    return cursor.rowcount > 0


def save_line_item(estimate_id: str, item: EstimateLineItem, sort_order: int = 0) -> None:
    with get_connection() as conn:
        conn.execute(
            """INSERT INTO estimate_line_items
               (estimate_id, color, name, detail, qty, unit_price, total, category, sort_order)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (estimate_id, item.color, item.name, item.detail,
             item.qty, item.unit_price, item.total, item.category, sort_order),
        )
