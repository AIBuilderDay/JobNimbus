# Handoff PR 3 of 4 — EagleView provider + precache script (AI-27, AI-66)

> **For a fresh Claude Code session.** This file is self-contained; you do not need any prior conversation context. Read it top-to-bottom, then act.
>
> **Prerequisite:** PRs 1 and 2 ([`handoff-pr1-models.md`](./handoff-pr1-models.md), [`handoff-pr2-daos.md`](./handoff-pr2-daos.md)) must be merged to `main`. Verify:
> ```bash
> git log --oneline main | head -10
> # should show AI-44 (models) and AI-43..48 (DAOs)
> ls backend/models/ backend/dao/   # both directories must exist
> ```
>
> When this PR is merged, hand off to: [`backend/docs/handoff-pr4-test-suite.md`](./handoff-pr4-test-suite.md)

## What you're shipping

The EagleView API provider (cache-first, with a mock-mode fallback) plus the precache script that fires reports for all 10 benchmark properties in parallel. **Branch:** `mckay/AI-27-66-eagleview`. **Linear:** AI-27, AI-66.

This is the highest-leverage PR — once it merges, the user can run `task backend:precache` and start the 20-min wall-clock job for the test properties.

## Required reading FIRST

1. [`CLAUDE.md`](/Users/mckaysnell/hackathons/JobNimbus/CLAUDE.md) — note "Async + httpx", "Try / except", "Provider / Service / DAO discipline".
2. [`backend/docs/benchmark-requirements-jobnimbus.md`](./benchmark-requirements-jobnimbus.md) — has all 10 addresses (5 example + 5 test) you'll precache.
3. [`backend/settings.py`](/Users/mckaysnell/hackathons/JobNimbus/backend/settings.py) — `EAGLEVIEW_API_KEY` and `EAGLEVIEW_BASE_URL`.
4. [`backend/logger.py`](/Users/mckaysnell/hackathons/JobNimbus/backend/logger.py) — `get_logger(__name__)` everywhere.
5. [`backend/dao/eagleview_cache_dao.py`](/Users/mckaysnell/hackathons/JobNimbus/backend/dao/eagleview_cache_dao.py) — your cache. Read its functions.
6. [`backend/models/measurement.py`](/Users/mckaysnell/hackathons/JobNimbus/backend/models/measurement.py) — what `fetch_report` returns.
7. [`Taskfile.yml`](/Users/mckaysnell/hackathons/JobNimbus/Taskfile.yml) — you add a `backend:precache` task here.
8. Pull AI-27 and AI-66 from Linear MCP for the original spec.

## Required tool usage — DO NOT SKIP

The EagleView REST API is the unknown. Before writing the provider:

- **Web search** (multiple queries):
  - `"EagleView API report submission"` / `"EagleView Reports API v3"` / `"EagleView Imagery Image API"` — find current REST docs
  - Pull authentication: bearer token? API key header? OAuth client-credentials? Match your code to whatever the docs say.
  - Find the report-**submission** endpoint (POST). Note the request shape (address fields, structure type, report-type ID).
  - Find the job-**status** endpoint (GET). Note the status string values they use.
  - Find the report-**fetch** endpoint (GET) and the response shape with `total_roof_area`, `predominant_pitch`, line-item lengths (ridge/hip/valley/rake/eave/flashing).
  - **Document what you find** in a comment block at the top of `providers/eagleview.py` so the next person doesn't have to re-research. Include the URL of the docs page.
- **Context7 MCP**:
  - `httpx` — `AsyncClient`, `timeout`, `raise_for_status()`, response JSON parsing
  - `pytest-asyncio` — async test fixtures (you'll need them)
  - `respx` — for mocking httpx in tests (already in dev deps)
- Confirm latest stable versions of `httpx` and `respx` before any pin updates.

If you cannot find / cannot authenticate to EagleView (creds may not be issued yet):
- Implement the provider against your best understanding of their API
- The provider auto-falls-back to mock mode when `settings.EAGLEVIEW_API_KEY` is empty (see code below)
- Document in the PR body: "Live API not validated; mock mode covered by unit tests"

## Files to create

```
backend/providers/__init__.py
backend/providers/eagleview.py
backend/scripts/__init__.py
backend/scripts/precache_eagleview.py
backend/tests/providers/__init__.py
backend/tests/providers/test_eagleview.py
```

## Files to modify

```
Taskfile.yml                 # add backend:precache task
```

### `backend/providers/eagleview.py`

```python
"""EagleView Reports API wrapper.

API docs: <URL you found via web search>
Auth: <Bearer / API key / OAuth — fill in from web search>
Endpoints:
  POST  {base}/<submit-path>      → returns job_id
  GET   {base}/<status-path>/<job_id>   → returns "pending" | "complete" | "failed"
  GET   {base}/<fetch-path>/<job_id>    → returns measurements payload

Reports take ~20 minutes per address. We cache results in eagleview_cache (SQLite).
For live demos, Google Solar is the primary source; EagleView is the verified source
for the 5 benchmark test properties (precached).
"""

from typing import Literal

import httpx

from dao import eagleview_cache_dao
from logger import get_logger
from models.measurement import Measurement
from settings import settings

log = get_logger(__name__)


class EagleViewError(Exception):
    """Generic EagleView upstream failure."""


class CacheMissError(Exception):
    """Address not yet in cache. Caller should fall back to alternate source."""


class EagleViewProvider:
    """Wraps EagleView REST API. Stateless. Cache lookup via DAO."""

    def __init__(self, *, mock_mode: bool | None = None):
        self.base_url = settings.EAGLEVIEW_BASE_URL
        self.api_key = settings.EAGLEVIEW_API_KEY
        # Auto-fallback when no key issued yet
        self.mock_mode = mock_mode if mock_mode is not None else not bool(self.api_key)

    def _headers(self) -> dict[str, str]:
        # Match whatever auth scheme the docs specify.
        return {"Authorization": f"Bearer {self.api_key}"}

    async def request_report(self, address: str) -> str:
        """Submit a report job. Returns job_id. Idempotent on address."""
        existing = eagleview_cache_dao.get(address)
        if existing and existing.job_id:
            log.info(
                "eagleview request_report dedupe address=%s job_id=%s",
                address, existing.job_id,
            )
            return existing.job_id

        if self.mock_mode:
            job_id = f"mock-{abs(hash(address))}"
            log.info("eagleview mock request_report address=%s job_id=%s", address, job_id)
            eagleview_cache_dao.put_pending(address, job_id)
            return job_id

        log.info("eagleview request_report address=%s", address)
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{self.base_url}/<submit-path>",  # FILL IN
                    headers=self._headers(),
                    json={"address": address},  # FILL IN with actual request shape
                )
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPError:
            log.exception("eagleview request_report failed address=%s", address)
            raise EagleViewError(f"EagleView submission failed for {address}")

        job_id = data["<job_id_field>"]  # FILL IN
        eagleview_cache_dao.put_pending(address, job_id)
        return job_id

    async def get_report_status(self, job_id: str) -> Literal["pending", "complete", "failed"]:
        if self.mock_mode:
            return "complete"

        log.info("eagleview get_report_status job_id=%s", job_id)
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{self.base_url}/<status-path>/{job_id}",  # FILL IN
                    headers=self._headers(),
                )
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPError:
            log.exception("eagleview get_report_status failed job_id=%s", job_id)
            raise EagleViewError(f"EagleView status check failed for {job_id}")

        # Map their status strings to our 3-value Literal
        return _map_status(data["<status_field>"])  # FILL IN

    async def fetch_report(self, job_id: str) -> Measurement:
        """Fetch completed report and translate to our Measurement model.
        Raises EagleViewError if not complete."""
        if self.mock_mode:
            return _mock_measurement(job_id)

        log.info("eagleview fetch_report job_id=%s", job_id)
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(
                    f"{self.base_url}/<fetch-path>/{job_id}",
                    headers=self._headers(),
                )
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPError:
            log.exception("eagleview fetch_report failed job_id=%s", job_id)
            raise EagleViewError(f"EagleView fetch failed for {job_id}")

        return _translate_eagleview_response(data)

    async def get_measurements(self, address: str) -> Measurement:
        """Cache-first lookup.
        - Cache hit (status=complete) → return Measurement
        - Cache miss / pending / failed → fire request_report (records pending row), raise CacheMissError"""
        cached = eagleview_cache_dao.get(address)
        if cached and cached.status == "complete" and cached.measurements:
            return Measurement.model_validate(cached.measurements)

        # Not ready: kick off (or re-use) a job and tell the caller to fall back
        job_id = await self.request_report(address)
        raise CacheMissError(f"EagleView job for {address} not ready (job_id={job_id})")
```

Helper functions in the same module:

- `_map_status(raw: str) -> Literal["pending", "complete", "failed"]` — maps EagleView's status strings to our 3-value Literal. Unknown statuses default to `"pending"` and log a warning.
- `_translate_eagleview_response(data: dict) -> Measurement` — extracts `total_roof_area`, `predominant_pitch`, line-item lengths from the EagleView payload and builds a `Measurement` with `source="eagleview"` and the original `data` stashed in `raw`.
- `_mock_measurement(job_id: str) -> Measurement` — returns a deterministic stub `Measurement` for mock mode tests. Use a hash of the address (not the job_id) so it's stable across runs.

### `backend/scripts/precache_eagleview.py`

```python
"""Fire EagleView reports for all 10 benchmark properties in parallel.
Run once at hackathon start. Polls every 60s until all 10 are complete or any fails.

Run: task backend:precache
"""
import asyncio
import sys

from dao import eagleview_cache_dao
from dao.database import init_db
from logger import get_logger
from providers.eagleview import EagleViewProvider

log = get_logger(__name__)

ADDRESSES = [
    # Examples (calibration)
    "21106 Kenswick Meadows Ct, Humble, TX 77338",
    "5914 Copper Lilly Lane, Spring, TX 77389",
    "122 NW 13th Ave, Cape Coral, FL 33993",
    "14132 Trenton Ave, Orland Park, IL 60462",
    "835 S Cobble Creek, Nixa, MO 65714",
    # Test (submitted)
    "3561 E 102nd Ct, Thornton, CO 80229",
    "1612 S Canton Ave, Springfield, MO 65802",
    "6310 Laguna Bay Court, Houston, TX 77041",
    "3820 E Rosebrier St, Springfield, MO 65809",
    "1261 20th Street, Newport News, VA 23607",
]


async def main() -> int:
    init_db()
    provider = EagleViewProvider()

    pending: dict[str, str] = {}
    for addr in ADDRESSES:
        cached = eagleview_cache_dao.get(addr)
        if cached and cached.status == "complete":
            log.info("precache: already complete, skipping address=%s", addr)
            continue
        try:
            job_id = await provider.request_report(addr)
            pending[addr] = job_id
        except Exception:
            log.exception("precache: request_report failed address=%s", addr)
            return 1

    while pending:
        await asyncio.sleep(60)
        for addr in list(pending.keys()):
            status = await provider.get_report_status(pending[addr])
            if status == "complete":
                try:
                    measurement = await provider.fetch_report(pending[addr])
                    eagleview_cache_dao.update_complete(
                        addr,
                        raw=measurement.raw,
                        measurements=measurement.model_dump(),
                    )
                    log.info("precache: complete address=%s", addr)
                    del pending[addr]
                except Exception:
                    log.exception("precache: fetch_report failed address=%s", addr)
                    eagleview_cache_dao.update_failed(addr, "fetch_failed")
                    return 1
            elif status == "failed":
                eagleview_cache_dao.update_failed(addr, "upstream_failed")
                log.error("precache: failed upstream address=%s", addr)
                return 1
        log.info("precache: %d still pending", len(pending))

    log.info("precache: ALL %d ADDRESSES COMPLETE", len(ADDRESSES))
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
```

### `Taskfile.yml` (modify — add this task under existing `backend:*` tasks)

```yaml
  backend:precache:
    desc: Precache EagleView reports for all 10 benchmark properties (~20 min wall-clock)
    dir: backend
    cmds:
      - op run --env-file=.env -- uv run python -m scripts.precache_eagleview
```

## Tests

`backend/tests/providers/test_eagleview.py`. Use the `isolated_db` fixture from PR 2.

- **Cache hit path** — pre-populate cache via `eagleview_cache_dao.update_complete(...)`, then `await provider.get_measurements(addr)` returns the same Measurement.
- **Cache miss path** — `await provider.get_measurements(addr)` raises `CacheMissError` AND records a pending row in the cache.
- **`request_report` idempotency** — call twice with the same address, only one cache row, same `job_id`.
- **Mock mode** — instantiate with `mock_mode=True`, end-to-end through `request_report` → `fetch_report` returns deterministic Measurement, no httpx calls.
- **Live API path** (mocked with `respx`) — happy path: POST submission → status=pending → status=complete → fetch returns full Measurement; verify `_translate_eagleview_response` maps fields correctly. Use a saved fixture JSON for the EagleView payload (paste a redacted real response if you have one, otherwise hand-build a representative dict).
- **Live API error path** (`respx`) — POST returns 500 → raises `EagleViewError`, no pending row written.

If you have time + creds: one integration test against the real API for one example property (Humble TX). Mark it:

```python
@pytest.mark.skipif(not settings.EAGLEVIEW_API_KEY, reason="requires creds")
```

so CI doesn't fail without it.

## Verify

```bash
cd backend && uv run pytest tests/providers/ -v
cd backend && uv run pytest tests/ -v   # full suite still green
cd backend && uv run python -c "from providers.eagleview import EagleViewProvider; p = EagleViewProvider(mock_mode=True); print('imports OK')"
```

**DO NOT actually run `task backend:precache` in this session** — that's a ~20 min wall-clock job. The user will run it manually after the PR merges.

## Commit + PR

```bash
git checkout -b mckay/AI-27-66-eagleview
git add backend/providers/ backend/scripts/ backend/tests/providers/ Taskfile.yml
git commit -m "AI-27/66: EagleView provider + precache script"
git push -u origin mckay/AI-27-66-eagleview
gh pr create --title "AI-27 + AI-66: EagleView provider + precache script" --body "..."
```

PR body covers:
- `providers/eagleview.py`: cache-first `get_measurements`, `CacheMissError`, mock-mode auto-fallback
- `scripts/precache_eagleview.py`: 10-address parallel kickoff (~20 min wall-clock)
- `task backend:precache` added to Taskfile
- Mock mode auto-engages when `EAGLEVIEW_API_KEY` is empty
- Document the EagleView API surface discovered via web search at the top of the provider
- Note in PR body: live API status (validated against real creds vs. mock-only)

After PR is open, **comment on AI-27 and AI-66 in Linear** with: shipped commit SHA, what's mocked vs. live, the URL of the EagleView docs you used.

## Don'ts

- Do NOT use `os.environ` outside `settings.py`.
- Do NOT use `print()` — `get_logger(__name__)`.
- Do NOT modify `backend/services/google/*` or `backend/routers/estimate.py`.
- Do NOT actually run the precache script in this session (20 min wall-clock).
- Do NOT swallow exceptions silently — re-raise as `EagleViewError` after `log.exception(...)`.
- Do NOT skip pre-commit hooks.
- Do NOT `git push --force`.
- Do NOT commit any real EagleView API responses to fixtures without redacting PII (addresses are fine; account info / tokens / customer names are not).

## When done

After the PR is opened and the URL is shared, hand off to:

**[`backend/docs/handoff-pr4-test-suite.md`](./handoff-pr4-test-suite.md)** — Hackathon-qualification test suite (AI-67). It depends on this PR being merged, AND on AI-31 (MeasurementService) being either merged or available on a branch.

Stop after sharing the PR URL.
