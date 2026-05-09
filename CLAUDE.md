# CLAUDE.md

Conventions for the JobNimbus AI Roofing project. Every feature branch reads this first.

## Project layout

```
backend/
  main.py                       # FastAPI app, lifespan, router registration
  settings.py                   # pydantic-settings BaseSettings — single source of env truth
  logger.py                     # get_logger(__name__) factory

  providers/                    # NEW provider code goes here. Wraps a single external API. Stateless.
    eagleview.py
    anthropic.py

  services/                     # Business logic. Composes providers + DAOs. Stateless.
    measurement_service.py
    pricing_service.py
    estimate_service.py
    google/                     # Eddy's existing provider code — provider-shaped but living here
      geocoding.py              # DO NOT REFACTOR
      solar.py                  # DO NOT REFACTOR
      static_maps.py            # DO NOT REFACTOR

  dao/                          # SQLite access. One module per table.
    database.py                 # connection, init_db(), schema DDL
    property_dao.py
    estimate_dao.py
    eagleview_cache_dao.py

  models/                       # Pydantic models — source of truth between layers
    address.py
    measurement.py
    estimate.py
    view.py

  routers/                      # FastAPI routes. Thin — delegate to services.
    estimate.py                 # Eddy owns this — coordinate before editing

  scripts/                      # One-off operational scripts
    precache_eagleview.py
    validate_measurements.py

  tests/                        # Mirrors the module structure
    services/test_measurement_service.py
    providers/test_eagleview.py
    ...
```

## Patterns — follow these in every new file

### Settings

```python
from settings import settings
api_key = settings.GOOGLE_MAPS_API_KEY
```

Never use `os.environ` directly outside `settings.py`. Add new env vars to the `Settings` class AND `.env.example`. Use `op://` 1Password references in `.env.example` (e.g. `op://AIBuilderDay/eagleview-api-key/credential`).

### Logging

```python
from logger import get_logger
log = get_logger(__name__)

log.info("starting measurement for address=%s", address)
```

Every external call gets logged on entry and exit. Errors use `log.exception("...")` inside `except` blocks (captures the traceback automatically). Never `print()` from production code.

### Try / except

Wrap every external API call. Re-raise as a typed exception or return a sentinel — never swallow silently.

```python
try:
    result = await provider.fetch(address)
except httpx.HTTPError:
    log.exception("eagleview fetch failed for address=%s", address)
    raise EagleViewError("upstream failed")
```

### Async + httpx

All providers are `async`. Use `httpx.AsyncClient` with `timeout=10.0` (longer for EagleView submission, e.g. `timeout=30.0`). Always `raise_for_status()` unless explicitly handling a known status code (e.g. Solar API's 404 = no coverage).

### Pydantic models = the contract

Layers exchange pydantic models, not dicts. Services accept and return models. Only the DAO layer converts to/from primitives for SQLite.

### DAOs

Use stdlib `sqlite3` with `row_factory = sqlite3.Row`. JSON blobs are fine for nested data — no migrations during the hackathon. One DAO module per table; functions, not a class. Open and close connections per-call (or use a context manager); SQLite is fine with this for our volume.

### Provider / Service / DAO discipline

- **Provider:** wraps one external API. No business logic.
- **Service:** business logic. Composes providers + DAOs. Returns models.
- **DAO:** SQLite reads/writes. No business logic.
- **Router:** parses request → calls service → returns response. Thin.

## Critical bug to avoid

Roof area ≠ footprint. Submitted square footage must be **roof area** (slanted), not footprint (projected). The hackathon brief explicitly disqualifies submissions that report footprint. Pitch multiplier formula:

```python
import math

def pitch_multiplier(rise: int, run: int) -> float:
    return math.sqrt(1 + (rise / run) ** 2)

# 4:12 → 1.054
# 6:12 → 1.118
# 8:12 → 1.202
```

Google Solar's `stats.areaMeters2` claims to be slanted roof area already. **Validate before submitting** with `scripts/validate_measurements.py` against the 5 example properties (reference data lives in AI-31).

## Tests

- Tests live in `backend/tests/`, mirroring source structure.
- Use `pytest` + `pytest-asyncio`. Run via `task backend:test`.
- Mock external APIs with `respx` (for httpx) or simple `unittest.mock.AsyncMock`.
- Every service method gets a unit test. Every provider gets a happy-path + 1 error test. The validation script counts as the integration test for MeasurementService.
- Don't ship a feature with red tests.

## Hackathon constraints

- SQLite is **ephemeral** on Render — DB resets on every deploy. Don't store anything we can't reproduce. EagleView cache is rebuildable from the precache script (AI-66).
- No DB migrations. Schema is created in `init_db()` with `CREATE TABLE IF NOT EXISTS`.
- Frontend talks to `/api/*`. CORS already allows `localhost:5173`; add the Vercel domain when we deploy.

## Environment setup

All secrets live in the **`AIBuilderDay`** 1Password vault. Two delivery paths:

1. **Backend** — `backend/.env` contains `op://` references; `task backend:dev` resolves them at runtime via `op run`. Nothing to generate.
2. **Frontend** — Vite needs static values. Generate `frontend/.env.local` from the vault:

```bash
task env:setup       # one-time per developer: install op CLI + jq, sign in
task env:generate    # writes frontend/.env.local (use ENV=prod for .env.prod)
task env:status      # which .env files exist locally
```

The generator pulls **only** vault items prefixed `vite-` (e.g. `vite-google-maps-api-key` → `VITE_GOOGLE_MAPS_API_KEY`). Backend keys (`anthropic-api-key`, `eagleview-api-key`, `google-maps-api-key`) live in the same vault but never end up in the frontend file. Reads the `credential` field on each item.

When adding a new frontend secret: create a vault item titled `vite-<thing>` and re-run `task env:generate`.

## What NOT to touch

- `backend/services/google/{geocoding,solar,static_maps}.py` — Eddy's, working, don't refactor.
- `backend/routers/estimate.py` — Eddy's active file. Coordinate before editing.

## Linear workflow

- Every PR maps to one Linear ticket. Commit messages start with the ticket ID: `AI-31: add MeasurementService`.
- Branch names: `mckay/AI-XX-short-description`.
- Read the ticket description before planning. Tickets carry the contract (function signatures, schemas, acceptance criteria).
