import json
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

from logger import get_logger

from .database import _normalize_address, get_connection

log = get_logger(__name__)


CacheStatus = Literal["pending", "complete", "failed"]


@dataclass(frozen=True)
class CachedReport:
    address_normalized: str
    job_id: str | None
    status: CacheStatus
    measurements: dict | None
    completed_at: str | None


def get(address: str) -> CachedReport | None:
    key = _normalize_address(address)
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM eagleview_cache WHERE address_normalized = ?",
            (key,),
        ).fetchone()
    if not row:
        return None
    return CachedReport(
        address_normalized=row["address_normalized"],
        job_id=row["job_id"],
        status=row["status"],
        measurements=json.loads(row["measurements_json"]) if row["measurements_json"] else None,
        completed_at=row["completed_at"],
    )


def put_pending(address: str, job_id: str) -> None:
    key = _normalize_address(address)
    now = datetime.now(UTC).isoformat()
    log.info("eagleview_cache put_pending address=%s job_id=%s", key, job_id)
    with get_connection() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO eagleview_cache
               (address_normalized, job_id, status, requested_at)
               VALUES (?, ?, 'pending', ?)""",
            (key, job_id, now),
        )


def update_complete(address: str, raw: dict, measurements: dict) -> None:
    key = _normalize_address(address)
    now = datetime.now(UTC).isoformat()
    log.info("eagleview_cache update_complete address=%s", key)
    with get_connection() as conn:
        conn.execute(
            """UPDATE eagleview_cache
               SET status='complete', raw_response_json=?, measurements_json=?, completed_at=?
               WHERE address_normalized=?""",
            (json.dumps(raw), json.dumps(measurements), now, key),
        )


def update_failed(address: str, reason: str) -> None:
    key = _normalize_address(address)
    log.warning("eagleview_cache update_failed address=%s reason=%s", key, reason)
    with get_connection() as conn:
        conn.execute(
            "UPDATE eagleview_cache SET status='failed' WHERE address_normalized=?",
            (key,),
        )
