# JobNimbus AI Roofing — Address → Estimate

Submission for the **JobNimbus AI Hackathon 2026** ($10k aerial roof measurement + auto-estimating bounty). Type a property address; the tool returns slanted roof area, a 3D model, and a quote-ready estimate.

## Live measurement accuracy

Live run against real Google Geocoding + Solar APIs ([source](backend/scripts/validate_measurements.py)) — no mocks, no fabrication:

| Address | Pitch | Measured | Ref A | Δ A | Ref B | Δ B |
|---|---|--:|--:|--:|--:|--:|
| 21106 Kenswick Meadows Ct, Humble, TX 77338 | 6:12 | 2,389 | 2,443 | −2.2% | 2,343 | +2.0% |
| 5914 Copper Lilly Lane, Spring, TX 77389 | 8:12 | 4,369 | 4,391 | −0.5% | 4,296 | +1.7% |
| 122 NW 13th Ave, Cape Coral, FL 33993 | 6:12 | 2,924 | 2,917 | +0.2% | 2,851 | +2.6% |
| 14132 Trenton Ave, Orland Park, IL 60462 | 4:12 | 3,170 | 2,990 | +6.0% | 2,935 | +8.0% |
| 835 S Cobble Creek, Nixa, MO 65714 | 8:12 | 3,070 | 3,070 | −0.0% | 3,017 | +1.7% |

**5/5 within ±10%** (4 of 5 within ±2.6%). Threshold required: 4/5.

```bash
task backend:validate    # live diff table, exits non-zero if < 4/5 pass
task backend:test        # full unit + integration suite
```

### Avoiding the disqualifying bug

The brief warns: returning **footprint** instead of **slanted roof area** puts you 5–20% under. We read Google Solar's `roofSegmentStats[*].stats.areaMeters2` — already slanted — and never multiply by a pitch factor on top. Three live tests guard this in [backend/tests/integration/test_benchmark_accuracy.py](backend/tests/integration/test_benchmark_accuracy.py):

- `test_solar_path_meets_threshold` — ≥ 4/5 within ±10% of either reference
- `test_roof_area_not_footprint_guard` — for every pitch ≥ 4:12, slanted > footprint × 1.05 (regression alarm if we ever return footprint)
- `test_solar_slanted_area_sanity` — sum of per-segment slanted areas equals the total (catches anyone wedging a pitch factor into the parse path)

Pitch math itself (`sqrt(1 + (rise/run)^2)`) is unit-tested in [backend/tests/unit/test_pitch_multiplier.py](backend/tests/unit/test_pitch_multiplier.py).

## Flow

```text
AddressPage (Places autocomplete)
  → EstimatorPage (Aerial View, Solar measurements, 3D model from Street View / Static Maps imagery)
    → PricingPage (line-item cost breakdown over the measured roof)
      → ProposalPage (printable proposal + warranty PDF)
        → FinalizationPage (close the deal)
```

`EstimatesPage` lists past estimates; `BlueprintPage` shows the wireframe roof view.

## API endpoints

### Implemented

- `GET  /api/places/autocomplete` — address autocomplete (Google Places New)
- `POST /api/estimate/start` — geocode + Solar + create estimate, kick off 3D model
- `GET  /api/estimate/{id}` — fetch estimate
- `POST /api/estimate/{id}/refine` — update facet selections
- `GET  /api/aerial` — Google Aerial View video URL
- `GET  /api/roof-polygons` — roof segment geometry
- `POST /api/model3d/capture` · `confirm` · `generate` — Replicate Hunyuan3D pipeline
- `POST /api/model3d/tripo/generate{,-from-coords}` — alternative Tripo3D pipeline
- `GET  /api/model3d/{id}/status` — poll 3D job
- `GET  /api/model3d/{id}/model.glb` — serve finished GLB

### Planned

Business logic for these flows already exists in the frontend pages; backend handlers are the missing link. Implementation notes are in [backend/docs/handoff-pending-endpoints.md](backend/docs/handoff-pending-endpoints.md) (local handoff to a fresh session).

- `GET  /api/estimates` — list estimates (EstimatesPage)
- `GET  /api/estimate/{id}/pricing` · `POST` · `PUT` — pricing line items (PricingPage)
- `GET  /api/estimate/{id}/proposal` · `POST` — generate / fetch proposal (ProposalPage)
- `POST /api/estimate/{id}/finalize` — lock the estimate (FinalizationPage)
- `GET  /api/estimate/{id}/blueprint` — wireframe data (BlueprintPage)

## Stack + AI choices

> **Full breakdown with architecture diagram:** **[TECH_STACK.md](TECH_STACK.md)**

- **Backend** — FastAPI / Python 3.14 / Pydantic v2 / `uv` / `httpx`. Layered providers → services → DAOs → routers.
- **Frontend** — React / Vite / Zustand / react-query / Zod / pnpm.
- **DB** — SQLite (stdlib `sqlite3`); ephemeral on Render, only caches reproducible data.
- **Measurements** — Google Solar `buildingInsights:findClosest` (slanted segment areas, summed).
- **Imagery** — Google Static Maps + Street View + Aerial View, with the Solar data layer for roof polygons.
- **3D model** — Replicate `tencent/hunyuan-3d-3.1` (primary), Tripo3D (alternative) → GLB served at `/model.glb`.
- **Image prep** — Replicate `black-forest-labs/flux-kontext-dev` for cleanup/inpainting before 3D submission.
- **EagleView** — provider + cache + precache script written ([providers/eagleview.py](backend/providers/eagleview.py), [scripts/precache_eagleview.py](backend/scripts/precache_eagleview.py)), but **not in the runtime path**. Sandbox returns mock geometry; we documented the prod-revival path in [backend/docs/](backend/docs/) and shipped a Google-only pipeline.

We deliberately kept LLMs out of the measurement loop. The qualification-blocking bug is silent — a deterministic Solar → segment areas → sum pipeline is far easier to validate than a model that "should" return roof area.

## Quickstart

```bash
task env:setup       # one-time: install op CLI + jq, sign in to 1Password
task env:generate    # generate backend/.env + frontend/.env.local from the AIBuilderDay vault
task up              # docker compose: backend + frontend
```

`task` lists everything; `task env:status` shows env-file health.

## Layout

- [backend/](backend/) — FastAPI service · conventions in [backend/CLAUDE.md](backend/CLAUDE.md)
- [frontend/](frontend/) — React + Vite SPA · conventions in [frontend/CLAUDE.md](frontend/CLAUDE.md)
- [Taskfile.yml](Taskfile.yml) — `task <name>` is the canonical entry point
- [CLAUDE.md](CLAUDE.md) — repo-wide working conventions
