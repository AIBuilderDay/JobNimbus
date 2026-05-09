from logger import get_logger
from models import Estimate

from .database import get_connection

log = get_logger(__name__)


def save(estimate: Estimate, property_id: str) -> None:
    log.info("estimate save id=%s property_id=%s", estimate.id, property_id)
    with get_connection() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO estimates
               (id, property_id, payload_json)
               VALUES (?, ?, ?)""",
            (estimate.id, property_id, estimate.model_dump_json()),
        )


def get_by_id(id: str) -> Estimate | None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT payload_json FROM estimates WHERE id = ?",
            (id,),
        ).fetchone()
    if not row:
        return None
    return Estimate.model_validate_json(row["payload_json"])


def list_recent(limit: int = 20) -> list[Estimate]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT payload_json FROM estimates ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [Estimate.model_validate_json(r["payload_json"]) for r in rows]
