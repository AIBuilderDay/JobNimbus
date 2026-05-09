import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from logger import get_logger
from settings import settings

log = get_logger(__name__)

_SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def _db_path() -> str:
    """Strip 'sqlite:///' prefix from DATABASE_URL.
    Resolved at call time (not import time) so test fixtures can override."""
    return settings.DATABASE_URL.replace("sqlite:///", "")


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(_db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _normalize_address(address: str) -> str:
    """Cache key normalization: lowercase, collapse whitespace, strip."""
    return " ".join(address.lower().split())


def init_db() -> None:
    db = _db_path()
    log.info("init_db path=%s", db)
    Path(db).parent.mkdir(parents=True, exist_ok=True)
    schema = _SCHEMA_PATH.read_text()
    with get_connection() as conn:
        conn.executescript(schema)
