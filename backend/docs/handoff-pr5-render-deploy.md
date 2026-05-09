# Handoff PR 5 of 5 — Render (backend) + Vercel (frontend) deployment

> **For a fresh Claude Code session.** This file is self-contained; you do not need any prior conversation context. Read it top-to-bottom, then act.
>
> **Prerequisite:** PR 2 ([`handoff-pr2-daos.md`](./handoff-pr2-daos.md)) merged so `init_db()` runs in the FastAPI lifespan. PRs 3 / 4 / AI-31 / AI-68 do NOT need to be merged before this one — deployment can ship as soon as the DAO foundation is in.
>
> When this PR is merged, the app is live and the user can submit hackathon URLs.

## What you're shipping

Backend deployed to **Render** (Docker web service); frontend deployed to **Vercel** (static Vite build). Plus the small backend changes required to be production-ready: PORT env-var binding, CORS allowlist, and a `/api/health` check that Render can poll. **Branch:** `mckay/AI-69-render-deploy` (set the Linear ID once the ticket is created — see "Linear" below). **Linear:** TBD (the user will create or link the ticket).

After this lands, the user runs `task backend:precache` against the **deployed** backend so `eagleview_cache` is populated on the live SQLite file before the demo. (See "SQLite ephemerality" below.)

## Recent context (already in `main`)

- **AI-17/18** — `settings.py` + `logger.py`. Settings reads `.env` via `pydantic-settings`. Logger emits JSON to stdout — perfect for Render's log viewer.
- **PR 0** — Replicate / image cleanup / street view / model3d on settings + logger.
- **PR 2 (merged)** — `init_db()` is wired into the FastAPI lifespan. SQLite tables created on every cold start.
- **`backend/Dockerfile` already exists** ([backend/Dockerfile](/Users/mckaysnell/hackathons/JobNimbus/backend/Dockerfile)) — Python 3.14-slim, `uv sync --frozen --no-dev`, `uvicorn main:app --host 0.0.0.0 --port 8000`. Render can build from this directly.
- **Frontend** is Vite + pnpm — `pnpm build` outputs to `frontend/dist/`.
- **CORS** in `main.py` currently only allows `http://localhost:5173`. You'll add the deployed Vercel domain.

## Required reading FIRST

1. [`CLAUDE.md`](/Users/mckaysnell/hackathons/JobNimbus/CLAUDE.md) — note "Hackathon constraints": SQLite is **ephemeral** on Render, frontend talks to `/api/*`, CORS already allows `localhost:5173`.
2. [`backend/Dockerfile`](/Users/mckaysnell/hackathons/JobNimbus/backend/Dockerfile) — current build (Python 3.14, uv, uvicorn on `:8000`). You will tweak the `CMD` so the port binds to `$PORT`.
3. [`backend/main.py`](/Users/mckaysnell/hackathons/JobNimbus/backend/main.py) — the CORS block + `/api/health`. Don't break either.
4. [`backend/settings.py`](/Users/mckaysnell/hackathons/JobNimbus/backend/settings.py) — env-var contract. All required values (GOOGLE_MAPS_API_KEY, ANTHROPIC_API_KEY, EAGLEVIEW_API_KEY, REPLICATE_API_TOKEN) need to be set in the Render dashboard as raw values (NOT `op://` references — those only resolve locally via `op run`).
5. [`frontend/vite.config.ts`](/Users/mckaysnell/hackathons/JobNimbus/frontend/vite.config.ts) and [`frontend/package.json`](/Users/mckaysnell/hackathons/JobNimbus/frontend/package.json) — confirm `build` script and any `VITE_API_BASE_URL` consumption.
6. [`scripts/generate-env.sh`](/Users/mckaysnell/hackathons/JobNimbus/scripts/generate-env.sh) — how `frontend/.env.local` and `frontend/.env.prod` are populated from 1Password. The `.env.prod` file is what you'd use locally to build for Vercel; **on Vercel itself, set the same `VITE_*` vars in the project settings dashboard**.

## Required tool usage — DO NOT SKIP

Render and Vercel both update their docs frequently. Don't guess.

- **Web search**:
  - `"Render Docker deploy 2026"` / `"Render Python uv deploy"` / `"render.yaml schema"` — confirm whether `render.yaml` is the current way to declare a service or if dashboard-only is recommended for hackathon speed.
  - `"Render free tier SQLite persistent disk"` — confirm whether the free tier supports a 1 GB persistent disk in 2026 (this changes the SQLite ephemerality story).
  - `"Vercel Vite deployment 2026"` — confirm the recommended build settings for a Vite + pnpm project.
  - `"FastAPI uvicorn $PORT Render"` — confirm the binding pattern (`uvicorn --port ${PORT:-8000}` is canonical).
- **Context7 MCP**:
  - `fastapi` — CORS middleware for production (regex allowlist? credentials?)
  - `uvicorn` — `--proxy-headers` flag for Render's reverse proxy (so `request.client.host` reflects the real IP)

If anything below contradicts current Render/Vercel docs, **trust the docs and update this handoff** before opening the PR.

## Linear

The user will either point you at an existing ticket (e.g. `AI-69`) or ask you to create one. If asked to create:

- **Title:** "Deploy backend to Render + frontend to Vercel"
- **Project:** Job Nimbus (AI Roofing)
- **Team:** AI Builders Hackathon
- **Priority:** High
- **Description body:** copy the "What you're shipping" + "Acceptance" sections from this file.

Update this file's branch name + the PR title with the Linear ID once known.

## Files to create

```
render.yaml                       # at repo root — declarative service + env-var declarations
backend/.dockerignore             # skip __pycache__, .venv, jobnimbus.db, tests/
frontend/vercel.json              # rewrites /api/* to the Render backend; SPA fallback
```

## Files to modify

```
backend/Dockerfile           # CMD must respect $PORT
backend/main.py              # add Vercel domain to CORS allowlist
frontend/.env.example        # add VITE_API_BASE_URL placeholder (if missing)
```

### `render.yaml` (repo root)

```yaml
services:
  - type: web
    name: jobnimbus-backend
    runtime: docker
    dockerfilePath: ./backend/Dockerfile
    dockerContext: ./backend
    plan: starter        # or "free" — confirm via web search what's available 2026
    region: oregon       # closest to demo audience
    branch: main
    healthCheckPath: /api/health
    envVars:
      - key: GOOGLE_MAPS_API_KEY
        sync: false      # set in dashboard, never committed
      - key: ANTHROPIC_API_KEY
        sync: false
      - key: EAGLEVIEW_API_KEY
        sync: false
      - key: EAGLEVIEW_BASE_URL
        value: https://api.eagleview.com
      - key: REPLICATE_API_TOKEN
        sync: false
      - key: DATABASE_URL
        value: sqlite:////var/data/jobnimbus.db   # if disk attached, else default
      - key: LOG_LEVEL
        value: INFO
    # Optional: persistent disk for SQLite. ~$1/month on starter plan, free tier may not allow.
    # disk:
    #   name: data
    #   mountPath: /var/data
    #   sizeGB: 1
```

Notes:

- `sync: false` means "I'll set this in the dashboard." Render won't try to sync from a `.env` file in the repo (which we don't have anyway).
- `DATABASE_URL` only needs the disk-mount path if you actually attach a persistent disk. Without one, leave it as the default in `settings.py` and accept ephemerality.
- If `render.yaml` is overkill for hackathon speed, the user can wire the same fields in the dashboard. Document either path in the PR.

### `backend/Dockerfile` (modify — one line)

Render injects `$PORT` at runtime; uvicorn must bind to it. Change the last line:

```diff
-CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
+CMD ["sh", "-c", "uv run uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers"]
```

`--proxy-headers` makes `request.client.host` reflect the Render reverse proxy's `X-Forwarded-For` instead of the proxy itself. `${PORT:-8000}` keeps local `docker run` working with the default.

### `backend/main.py` (modify — CORS only)

```diff
 app.add_middleware(
     CORSMiddleware,
-    allow_origins=["http://localhost:5173"],
+    allow_origins=[
+        "http://localhost:5173",
+        # Vercel preview URLs change per deploy; use a regex
+    ],
+    allow_origin_regex=r"https://.*\.vercel\.app$",
     allow_methods=["*"],
     allow_headers=["*"],
 )
```

Once you know the production Vercel domain (e.g. `jobnimbus.vercel.app` or a custom domain), pin it explicitly in `allow_origins`. Keep the regex for preview-deploy URLs.

### `frontend/vercel.json`

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://jobnimbus-backend.onrender.com/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Replace `jobnimbus-backend.onrender.com` with the actual Render URL once it's provisioned. Two choices:

- **Rewrites (above):** frontend code can keep using relative `/api/*` paths; Vercel proxies them. No CORS concern at all.
- **`VITE_API_BASE_URL`:** frontend reads it at build time and points absolute `fetch` calls at the Render URL. CORS must allow the Vercel origin.

Pick one in the PR. Rewrites are simpler for the demo; `VITE_API_BASE_URL` plays better if the frontend ever needs to talk to a different backend per env.

### `backend/.dockerignore`

```
__pycache__/
*.pyc
.venv/
.env
.env.*
jobnimbus.db
tests/
docs/
.pytest_cache/
.ruff_cache/
```

Keeps the image small and avoids leaking local SQLite files / test data into the deployed container.

## SQLite ephemerality

Render's **free tier** has no persistent disk. Every redeploy resets `jobnimbus.db`, which means the `eagleview_cache` is wiped each time. Three options:

| # | Approach | When to pick it |
| - | -------- | --------------- |
| A | Accept ephemerality. Run `task backend:precache` against the deployed backend after each deploy (~20 min). | Free tier; we minimize redeploys during demo window. |
| B | Pay for **starter plan + 1 GB disk** (~$1/mo). Mount at `/var/data`, set `DATABASE_URL=sqlite:////var/data/jobnimbus.db`. Cache survives redeploys. | If the user is OK with $1. Easiest for demo reliability. |
| C | Move the EagleView cache to **R2 / Postgres / Supabase**. | Out of hackathon scope. |

**Recommendation:** Option B if Render still offers $1 disks in 2026 (verify via web search). Otherwise Option A — but `freeze` the deploy once precache is complete and don't redeploy until the demo is over.

Document your choice in the PR body.

## Vercel deployment (frontend)

Done via Vercel dashboard or `vercel` CLI; no PR needed for Vercel itself unless you check `vercel.json` into the repo (you should — see above).

Settings:

- **Framework preset:** Vite
- **Root directory:** `frontend/`
- **Build command:** `pnpm install --frozen-lockfile && pnpm build`
- **Output directory:** `dist`
- **Node version:** 20 (or whatever the project's `package.json` `engines` declares)
- **Environment variables:** any `VITE_*` keys from [`frontend/.env.example`](/Users/mckaysnell/hackathons/JobNimbus/frontend/.env.example) (use the raw secret values from the `AIBuilderDay` 1Password vault, NOT the `op://` references).

If `VITE_API_BASE_URL` is in use, set it to the Render URL (e.g. `https://jobnimbus-backend.onrender.com`).

## Backend env vars to set in the Render dashboard

Pull each `credential` from `op://AIBuilderDay/<item>/credential` locally, then paste into Render. Do NOT commit raw secrets.

```
GOOGLE_MAPS_API_KEY    = <op://AIBuilderDay/google-maps-places-api-key/credential>
ANTHROPIC_API_KEY      = <op://AIBuilderDay/anthropic-api-key/credential>
EAGLEVIEW_API_KEY      = <op://AIBuilderDay/eagleview-api-key/credential>
EAGLEVIEW_BASE_URL     = https://api.eagleview.com
REPLICATE_API_TOKEN    = <op://AIBuilderDay/replicate-api-token/credential>
LOG_LEVEL              = INFO
DATABASE_URL           = sqlite:///./jobnimbus.db   (or sqlite:////var/data/jobnimbus.db if disk)
```

## Verify

Local first:

```bash
# Build the Docker image with the new CMD
cd backend && docker build -t jobnimbus-backend:test .

# Run with PORT injected (mimic Render)
docker run --rm -e PORT=10000 \
  -e GOOGLE_MAPS_API_KEY=$GOOGLE_MAPS_API_KEY \
  -p 10000:10000 jobnimbus-backend:test

# In another terminal:
curl -s http://localhost:10000/api/health
# {"status":"ok","message":"FastAPI backend running"}
```

After deploy:

```bash
curl -s https://jobnimbus-backend.onrender.com/api/health
# {"status":"ok","message":"FastAPI backend running"}

# Smoke an actual API path that touches Google Maps:
curl -s "https://jobnimbus-backend.onrender.com/api/places/autocomplete?input=2110"
```

Frontend smoke:

```
open https://jobnimbus.vercel.app
# Confirm a search hits the backend (devtools network tab → /api/places/...)
# Confirm no CORS errors in console.
```

If you attached a persistent disk, run the precache once after the first deploy:

```bash
# from your laptop, against the deployed backend (via SSH? Or run locally with op run and it
# writes to local SQLite — for the disk to populate, you have to run the script ON the box.
# Render shells aren't supported on free tier; use a one-off Job or trigger via an admin endpoint.)
```

The simplest path: precache locally with `task backend:precache`, then commit the resulting `eagleview_cache` rows as a fixture and have the deployed backend read from a seed file on startup. Out of hackathon scope unless time permits — just re-run after deploy if you go ephemeral.

## Commit + PR

```bash
git checkout -b mckay/AI-69-render-deploy   # replace XX with the Linear ID
git add render.yaml backend/Dockerfile backend/.dockerignore backend/main.py frontend/vercel.json frontend/.env.example
git commit -m "AI-69: deploy backend to Render + frontend to Vercel"
git push -u origin mckay/AI-69-render-deploy
gh pr create --title "AI-69: Render + Vercel deployment" --body "..."
```

PR body covers:

- `render.yaml` declares the backend web service (Docker, healthcheck, env-var contract)
- Dockerfile binds `$PORT`; uvicorn uses `--proxy-headers`
- CORS allowlists localhost + Vercel previews + production domain
- `frontend/vercel.json` proxies `/api/*` to Render (or document the `VITE_API_BASE_URL` alternative)
- SQLite persistence decision (which option from the table above)
- Health-check URL + smoke command output pasted into the PR body

After PR is open, **comment on the Linear ticket** with: deploy URLs (Render + Vercel), the persistence option chosen, and any deploy-time gotchas you hit so the next person doesn't re-debug.

## Acceptance

- `https://<render>.onrender.com/api/health` returns `{"status":"ok","message":"FastAPI backend running"}` from a clean deploy.
- `https://<vercel>.vercel.app` loads the frontend, search-bar autocomplete works (proves Google Maps key is wired), and the network tab shows successful calls to `/api/*`.
- No CORS errors in the browser console.
- Render logs show structured JSON output (one line per log call) — confirms our logger config survives the production env.
- `init_db()` runs cleanly on cold start (logs show `init_db path=...` from PR 2's wiring; no exception).
- If a persistent disk is attached: redeploy the service and confirm `eagleview_cache` rows persist.

## Don'ts

- Do NOT commit raw API keys. Use `sync: false` in `render.yaml` and set them in the dashboard.
- Do NOT use `os.environ` outside `settings.py`. All env access flows through `pydantic-settings`.
- Do NOT use `print()`. JSON-formatted `get_logger(__name__)` output is what makes Render's log viewer useful.
- Do NOT modify `backend/services/google/{geocoding,solar,static_maps}.py` — Eddy's untouchable code (`street_view.py` was already migrated in PR 0 and is fair game).
- Do NOT modify `backend/routers/estimate.py` — coordinate with Eddy first.
- Do NOT skip pre-commit hooks (`--no-verify`).
- Do NOT `git push --force`.

## When done

This is the last handoff in the sequence.

After it merges, tell the user:

> "Backend live at `<render-url>`. Frontend live at `<vercel-url>`. Health check passes; CORS allows the Vercel origin. SQLite persistence: `<option chosen>`. If you went ephemeral, run `task backend:precache` against the deployed URL before the demo (or re-run after any redeploy)."

Stop.
