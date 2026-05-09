# Handoff PR 2 of 4 — SQLite + DAOs (AI-43, AI-45, AI-46, AI-47, AI-48)

> **For a fresh Claude Code session.** This file is self-contained; you do not need any prior conversation context. Read it top-to-bottom, then act.
>
> **Prerequisite:** PR 1 ([`handoff-pr1-models.md`](./handoff-pr1-models.md)) must be merged to `main`. Verify with `git log --oneline main | head -5` — you should see "AI-44: pydantic models...".
>
> When this PR is merged, hand off to: [`backend/docs/handoff-pr3-eagleview.md`](./handoff-pr3-eagleview.md)

## What you're shipping

The data-access layer: SQLite connection helper, schema (3 tables), DAO modules for properties, estimates, and `eagleview_cache`. Wire `init_db()` into the FastAPI lifespan. **Branch:** `mckay/AI-43-48-sqlite-daos`. **Linear:** AI-43, AI-45, AI-46, AI-47, AI-48.

After this lands, the EagleView provider (PR 3) is unblocked.

## Required reading FIRST

1. [`CLAUDE.md`](/Users/mckaysnell/hackathons/JobNimbus/CLAUDE.md) — full file. Note especially the "DAOs" and "Provider / Service / DAO discipline" sections.
2. [`backend/main.py`](/Users/mckaysnell/hackathons/JobNimbus/backend/main.py) — current FastAPI app. You will modify the lifespan.
3. [`backend/settings.py`](/Users/mckaysnell/hackathons/JobNimbus/backend/settings.py) — `DATABASE_URL` lives here. Default is `sqlite:///./jobnimbus.db`.
4. [`backend/logger.py`](/Users/mckaysnell/hackathons/JobNimbus/backend/logger.py) — `get_logger(__name__)` pattern.
5. [`backend/models/`](/Users/mckaysnell/hackathons/JobNimbus/backend/models/) — what you'll be (de)serializing.
6. [`backend/tests/conftest.py`](/Users/mckaysnell/hackathons/JobNimbus/backend/tests/conftest.py) — current shape; you'll extend it with the `isolated_db` fixture.
7. Pull AI-43, AI-45, AI-46, AI-47, AI-48 from Linear MCP for historical context. **Note the deviation below — AI-48 is overridden.**

## Required tool usage — DO NOT SKIP

- **Context7 MCP**:
  - `fastapi` — confirm the lifespan API: `@asynccontextmanager` + `app = FastAPI(lifespan=lifespan)` is current.
  - `pytest` / `pytest-asyncio` — confirm `monkeypatch` fixture for env-var override + tmp_path syntax.
- **Python stdlib** — `sqlite3` is well-known but verify behavior of `PRAGMA foreign_keys = ON` (must be set per-connection, not globally) and `row_factory = sqlite3.Row` returns dict-like rows.
- **Web search** — latest stable Python 3.14 stdlib `sqlite3` notes; check if anything new in `from contextlib import contextmanager`.

## Spec deviation from the AI-48 Linear ticket

AI-48's ticket describes a **generic `view_cache`** table for caching Replicate AI outputs. That's not what we need. AI-27/AI-66 (the EagleView path) need a **specific `eagleview_cache`** table with EagleView-shaped fields.

**Override:** Replace AI-48's `view_cache` schema with the `eagleview_cache` schema below. The generic Replicate cache, if needed later, will land in a separate ticket.

After the PR is opened, **comment on AI-48 in Linear** noting the deviation.

## Files to create

```
backend/dao/__init__.py
backend/dao/database.py
backend/dao/property_dao.py
backend/dao/estimate_dao.py
backend/dao/eagleview_cache_dao.py
backend/tests/dao/__init__.py
backend/tests/dao/test_database.py
backend/tests/dao/test_property_dao.py
backend/tests/dao/test_estimate_dao.py
backend/tests/dao/test_eagleview_cache_dao.py
```

## Files to modify

```
backend/main.py             # wire init_db() into lifespan
backend/tests/conftest.py   # add isolated_db fixture
```

### `backend/dao/database.py`

```python
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager

from logger import get_logger
from settings import settings

log = get_logger(__name__)


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
    log.info("init_db path=%s", _db_path())
    with get_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS properties (
                id                  TEXT PRIMARY KEY,
                address             TEXT NOT NULL UNIQUE,
                formatted_address   TEXT,
                lat                 REAL NOT NULL,
                lng                 REAL NOT NULL,
                place_id            TEXT,
                created_at          TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS estimates (
                id                  TEXT PRIMARY KEY,
                property_id         TEXT NOT NULL,
                payload_json        TEXT NOT NULL,
                created_at          TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (property_id) REFERENCES properties(id)
            );

            CREATE TABLE IF NOT EXISTS eagleview_cache (
                address_normalized  TEXT PRIMARY KEY,
                job_id              TEXT,
                status              TEXT NOT NULL,
                raw_response_json   TEXT,
                measurements_json   TEXT,
                requested_at        TEXT NOT NULL,
                completed_at        TEXT
            );
            """
        )
```

### `backend/dao/property_dao.py`

Functions (no class — see CLAUDE.md):

- `save(address: Address) -> str` — generate `uuid4()`, INSERT, return id
- `get_by_id(id: str) -> Address | None` — SELECT by id, build `Address` from row or return None
- `get_by_address(raw: str) -> Address | None` — SELECT WHERE `address = ? OR formatted_address = ?`

Use `from models import Address`. Convert sqlite rows back to the model with explicit field mapping (don't rely on `**dict(row)` because the row has `id`, `created_at` columns the model doesn't have).

### `backend/dao/estimate_dao.py`

Functions:

- `save(estimate: Estimate, property_id: str) -> None` — `INSERT OR REPLACE` keyed on `estimate.id`, store `estimate.model_dump_json()` in `payload_json`
- `get_by_id(id: str) -> Estimate | None` — uses `Estimate.model_validate_json(row["payload_json"])`
- `list_recent(limit: int = 20) -> list[Estimate]` — `ORDER BY created_at DESC LIMIT ?`

### `backend/dao/eagleview_cache_dao.py`

```python
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
```

### `backend/dao/__init__.py`

Re-export the DAOs:

```python
from dao import eagleview_cache_dao, estimate_dao, property_dao

__all__ = ["eagleview_cache_dao", "estimate_dao", "property_dao"]
```

### `backend/main.py` (modify)

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from dao.database import init_db
from logger import get_logger
from routers import aerial, estimate, places

log = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("backend starting")
    init_db()
    yield
    log.info("backend shutting down")


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "message": "FastAPI backend running"}


app.include_router(estimate.router)
app.include_router(places.router)
app.include_router(aerial.router)
```

### `backend/tests/conftest.py` (extend, do not replace)

The existing conftest sets `GOOGLE_MAPS_API_KEY` for tests. Keep that. Add an `isolated_db` fixture below it:

```python
import pytest


@pytest.fixture
def isolated_db(tmp_path, monkeypatch):
    """Each test gets a fresh SQLite file. Auto-runs init_db()."""
    db_file = tmp_path / "test.db"
    from settings import settings
    monkeypatch.setattr(settings, "DATABASE_URL", f"sqlite:///{db_file}")
    from dao.database import init_db
    init_db()
    yield db_file
```

DAO tests request this fixture by name.

## Tests

- `test_database.py` — `init_db()` creates all 3 tables (query `sqlite_master`); idempotent (call twice, no error). `_normalize_address` lowercases + collapses whitespace.
- `test_property_dao.py` — save → get_by_id round-trip; `get_by_address` finds by raw or formatted; uniqueness on `address` raises on duplicate insert.
- `test_estimate_dao.py` — save → get_by_id round-trip with full nested `Measurement` (build a fixture estimate with at least 2 line items); `list_recent` returns most-recent first; `INSERT OR REPLACE` updates by id without raising.
- `test_eagleview_cache_dao.py` — `put_pending` → `get` returns `status="pending"`; `update_complete` → `get` returns `status="complete"` with measurements dict matching what was put in; `update_failed` flips status to `"failed"`; address normalization (e.g. `"21106 Kenswick"` and `"  21106 KENSWICK  "` and `"21106  Kenswick"` all collapse to the same cache row).

All DAO tests use the `isolated_db` fixture.

## Verify

```bash
cd backend && uv run pytest tests/ -v
cd backend && uv run python -c "from dao.database import init_db; init_db(); print('init_db OK')"

# Smoke test the lifespan (start server briefly, confirm no startup errors)
cd backend && timeout 5 uv run fastapi dev main.py || true
sqlite3 jobnimbus.db ".tables"   # should list: eagleview_cache  estimates  properties
rm -f jobnimbus.db               # cleanup so we don't commit it
```

The smoke test is what proves `init_db()` runs cleanly inside the FastAPI lifespan.

## Commit + PR

```bash
git checkout -b mckay/AI-43-48-sqlite-daos
git add backend/dao/ backend/main.py backend/tests/dao/ backend/tests/conftest.py
git commit -m "AI-43/45/46/47/48: SQLite + DAO layer (property, estimate, eagleview_cache)"
git push -u origin mckay/AI-43-48-sqlite-daos
gh pr create --title "AI-43..48: SQLite + DAO layer" --body "..."
```

PR body covers:
- 3 tables (`properties`, `estimates`, `eagleview_cache`) created via `init_db()` wired into FastAPI lifespan
- DAOs as functions (not classes) per CLAUDE.md
- `eagleview_cache` schema overrides the generic `view_cache` from AI-48 ticket — link the comment
- `isolated_db` fixture in `conftest.py` for tmpdir-scoped tests

After PR is open, **comment on AI-48 in Linear** noting the schema deviation. Optionally comment on AI-43 / AI-45 / AI-46 / AI-47 confirming they shipped together.

## Don'ts

- Do NOT use `os.environ` outside `settings.py`.
- Do NOT use `print()` — `get_logger(__name__)`.
- Do NOT modify `backend/services/google/*` or `backend/routers/estimate.py`.
- Do NOT commit `backend/jobnimbus.db` — it's gitignored. Confirm with `git status` before commit.
- Do NOT add SQLAlchemy or any ORM — stdlib `sqlite3` only (CLAUDE.md rule).
- Do NOT skip pre-commit hooks.
- Do NOT `git push --force`.

## When done

After the PR is opened and the URL is shared, hand off to:

**[`backend/docs/handoff-pr3-eagleview.md`](./handoff-pr3-eagleview.md)** — EagleView provider + precache script (AI-27, AI-66). It depends on this PR being merged.

Stop after sharing the PR URL.
