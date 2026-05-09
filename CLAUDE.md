# CLAUDE.md

Root conventions for the JobNimbus AI Roofing project. Stack-specific rules live in:

- [backend/CLAUDE.md](backend/CLAUDE.md) — FastAPI, Pydantic, settings, logger, DAOs, providers, tests.
- [frontend/CLAUDE.md](frontend/CLAUDE.md) — React, Vite, Zustand, react-query, Zod, env vars.

Read this file first, then the one for whichever side you're touching.

## Working style

Before each edit, say in one or two sentences **why** you're making the change — the purpose, not a description of the code. Keep it tight: "Renaming `formatted` → `formatted_address` so it matches the Geocoding API field" beats "I'll now use the Edit tool to change…". Skip narration when the edit is trivial (a typo, a one-line import).

## Repo layout

```
JobNimbus/
  backend/                 # FastAPI service. Python 3.14, uv, Pydantic v2.
  frontend/                # React + Vite SPA. pnpm.
  scripts/                 # repo-wide shell scripts (1Password setup, env generation)
  tasks/                   # Taskfile includes (env.yml)
  Taskfile.yml             # `task <name>` is the canonical way to run anything
  CLAUDE.md                # this file
```

## How backend and frontend relate

- Frontend talks to the backend over **`/api/*`** only. Vite proxies `/api/*` to `http://localhost:8000` in dev ([frontend/vite.config.ts](frontend/vite.config.ts)). Same path works in prod against the deployed FastAPI host.
- Backend CORS currently allows `http://localhost:5173`. When we deploy frontend to Vercel, add that origin to [backend/main.py](backend/main.py) — don't disable CORS.
- They share the same 1Password vault (`AIBuilderDay`) but use **different env-file flows**:
  - Backend reads `op://`-referenced values at runtime via `op run --env-file=backend/.env`.
  - Frontend needs static values at build time, so [scripts/generate-env.sh](scripts/generate-env.sh) materializes only `vite-*`-prefixed vault items into `frontend/.env.local`.

## Environment setup

```bash
task env:setup       # one-time: install op CLI + jq, sign in to 1Password
task env:generate    # regenerates frontend/.env.local AND backend/.env (use ENV=prod for frontend .env.prod)
task env:status      # which .env files exist locally
task backend:dev     # build+run backend container with op-resolved env, tail logs
task backend:test    # uv run pytest in backend/
task frontend:dev    # vite dev server with op-injected env
```

All `.env` and `.env.local` files are gitignored. `.env.example` is tracked and uses `op://AIBuilderDay/<item>/credential` references.

## Linear workflow

- Every PR maps to one Linear ticket. Read the ticket description before planning — tickets carry the contract (signatures, schemas, acceptance criteria).
- Branch names: `mckay/AI-XX-short-description`.
- Commit messages start with the ticket ID: `AI-31: add MeasurementService`. Non-ticket changes use a conventional prefix (`docs:`, `chore:`, `fix:`).
- Don't commit `backend/docs/handoff-*.md` files — those are session-scoped notes between PRs and stay local.

## What NOT to touch

- [backend/services/google/](backend/services/google/) — Eddy's working code, do not refactor.
- [backend/routers/estimate.py](backend/routers/estimate.py) — Eddy's active file. Coordinate before editing.

## Hackathon constraints

- SQLite is **ephemeral** on Render — DB resets every deploy. Don't store anything we can't reproduce.
- No DB migrations. Schema is created in `init_db()` with `CREATE TABLE IF NOT EXISTS`.
- Submitted square footage must be **slanted roof area**, not footprint. The brief disqualifies submissions that report footprint. See [backend/CLAUDE.md](backend/CLAUDE.md#critical-bug--roof-area--footprint) for the pitch-multiplier rules.
