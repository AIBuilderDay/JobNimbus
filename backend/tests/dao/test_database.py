from dao.database import _normalize_address, get_connection, init_db


def _table_names(db_file) -> set[str]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    return {r["name"] for r in rows}


def test_init_db_creates_all_three_tables(isolated_db):
    assert _table_names(isolated_db) >= {"properties", "estimates", "eagleview_cache"}


def test_init_db_is_idempotent(isolated_db):
    # Fixture already called init_db once. Calling it again must not raise.
    init_db()
    init_db()
    assert _table_names(isolated_db) >= {"properties", "estimates", "eagleview_cache"}


def test_normalize_address_lowercases_and_collapses_whitespace():
    assert _normalize_address("  21106  KENSWICK  Manor  Dr  ") == "21106 kenswick manor dr"


def test_normalize_address_treats_variants_as_same_key():
    a = _normalize_address("21106 Kenswick")
    b = _normalize_address("  21106 KENSWICK  ")
    c = _normalize_address("21106  Kenswick")
    assert a == b == c
