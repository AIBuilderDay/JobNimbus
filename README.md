# JobNimbus AI Roofing

End-to-end roofing estimator: address in → roof measurements + estimate out. Backend pulls slanted roof area from Google Solar; frontend (React + Vite) walks the user from address through estimate.

Stack and conventions:
- [CLAUDE.md](CLAUDE.md) — repo-wide
- [backend/CLAUDE.md](backend/CLAUDE.md) — FastAPI / Pydantic v2 / `uv`
- [frontend/CLAUDE.md](frontend/CLAUDE.md) — React / Vite / Zustand

## Hackathon-qualification accuracy

Submissions are judged on roof-area accuracy. The disqualifying bug is reporting **footprint** instead of **slanted roof area** (5–20% under depending on pitch). Our path uses Google Solar's `roofSegmentStats[*].stats.areaMeters2`, which is already slanted — we do **not** multiply by a pitch factor on top.

### Live accuracy on the 5 example properties

Live run against real Google Geocoding + Solar APIs, no mocks ([source](backend/scripts/validate_measurements.py)):

| Address | Pitch | Measured | Ref A | Δ A | Ref B | Δ B |
|---|---|--:|--:|--:|--:|--:|
| 21106 Kenswick Meadows Ct, Humble, TX 77338 | 6:12 | 2,389 | 2,443 | −2.2% | 2,343 | +2.0% |
| 5914 Copper Lilly Lane, Spring, TX 77389 | 8:12 | 4,369 | 4,391 | −0.5% | 4,296 | +1.7% |
| 122 NW 13th Ave, Cape Coral, FL 33993 | 6:12 | 2,924 | 2,917 | +0.2% | 2,851 | +2.6% |
| 14132 Trenton Ave, Orland Park, IL 60462 | 4:12 | 3,170 | 2,990 | +6.0% | 2,935 | +8.0% |
| 835 S Cobble Creek, Nixa, MO 65714 | 8:12 | 3,070 | 3,070 | −0.0% | 3,017 | +1.7% |

**5/5 within ±10%** (4 of 5 within ±2.6%). Threshold required: 4/5.

### Run it yourself

```bash
task backend:validate    # live: geocode + Solar against the 5 example properties, prints ±10% diff table, exits non-zero if < 4/5 pass
task backend:test        # full unit + integration suite (integration tests skip without GOOGLE_MAPS_API_KEY)
```

Both commands resolve the Google API key from 1Password via `op run`. If you don't have `backend/.env` yet, run `task env:generate` once first.

### What the test suite protects

- **[`test_solar_path_meets_threshold`](backend/tests/integration/test_benchmark_accuracy.py)** — ≥ 4 of 5 example properties within ±10% of either reference. Live Google call.
- **[`test_roof_area_not_footprint_guard`](backend/tests/integration/test_benchmark_accuracy.py)** — for every pitch ≥ 4:12, slanted roof area must exceed projected footprint × 1.05. Goes red the moment we regress to footprint.
- **[`test_solar_slanted_area_sanity`](backend/tests/integration/test_benchmark_accuracy.py)** — sum of per-segment slanted areas equals the total. Catches anyone wedging a pitch multiplier into the Solar parse path.
- **[`test_pitch_multiplier`](backend/tests/unit/test_pitch_multiplier.py)** — pitch math (4:12 → 1.054, 6:12 → 1.118, 8:12 → 1.202) and idempotency.
