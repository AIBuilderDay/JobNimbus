import sqlite3
from uuid import uuid4

from logger import get_logger
from models import Address

from .database import get_connection

log = get_logger(__name__)


def _row_to_address(row: sqlite3.Row) -> Address:
    """Map a properties row to an Address. address_components is not persisted
    in the table, so it round-trips as []."""
    return Address(
        raw_input=row["address"],
        formatted_address=row["formatted_address"],
        lat=row["lat"],
        lng=row["lng"],
        place_id=row["place_id"],
    )


def save(address: Address) -> str:
    new_id = str(uuid4())
    log.info("property save id=%s address=%s", new_id, address.raw_input)
    with get_connection() as conn:
        conn.execute(
            """INSERT INTO properties
               (id, address, formatted_address, lat, lng, place_id)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                new_id,
                address.raw_input,
                address.formatted_address,
                address.lat,
                address.lng,
                address.place_id,
            ),
        )
    return new_id


def get_by_id(id: str) -> Address | None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM properties WHERE id = ?",
            (id,),
        ).fetchone()
    if not row:
        return None
    return _row_to_address(row)


def get_by_address(raw: str) -> Address | None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM properties WHERE address = ? OR formatted_address = ?",
            (raw, raw),
        ).fetchone()
    if not row:
        return None
    return _row_to_address(row)
