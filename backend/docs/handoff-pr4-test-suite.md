# Handoff PR 4 of 5 — Hackathon-qualification test suite (AI-67)

> **For a fresh Claude Code session.** Self-contained; you do not need prior conversation context. Read top-to-bottom, then act.
>
> **Prerequisite:** PRs 1, 2, 3 ([`handoff-pr1-models.md`](./handoff-pr1-models.md), [`handoff-pr2-daos.md`](./handoff-pr2-daos.md), [`handoff-pr3-eagleview.md`](./handoff-pr3-eagleview.md)) merged. AI-31 (`MeasurementService`) helpful but not required — see "Scope shrunk" below.

## Scope shrunk: this is now a Google-only validation suite

**EagleView is out of the hackathon runtime path.** During PR 3 we got OAuth fully working (Okta JWT mints in 200ms against `apicenter.eagleview.com/oauth2/v1/token`), but the developer sandbox is an Apigee-mocked stub:

- `PlaceOrder` returns hardcoded `report_id=47741613` for any address.
- `GetReport` has no canned response — `400 "The response ?reportId=… does not exist!"` for every ID we tried.
- Property Data sandbox is locked to a 1.5 sq mi bbox in Omaha, NE.
- Production access requires a manual EagleView "Go-live Request" approval, not a credential swap.

Full write-up + revival path is in [`backend/docs/eagleview-api/README.md`](./eagleview-api/README.md). The provider, DAO, and scripts are all merged and would work against prod with a base-URL swap.

**Implication for AI-67:** drop the EagleView-only and reconciled scopes. Validate Google Solar's slanted area against the 5 reference values. Keep the hard guards — they're what protect us from the disqualifying bug.

## What you're shipping

The permanent test suite that proves we're submitting **roof area** (not footprint) and that our Google Solar totals fall within ±10% of the hackathon's reference values for ≥4 of 5 example properties. **Branch:** `mckay/AI-67-benchmark-test-suite`. **Linear:** AI-67.

This is the test suite that prevents us from getting **disqualified**. Treat it accordingly.

## Required reading FIRST

1. [`CLAUDE.md`](/Users/mckaysnell/hackathons/JobNimbus/CLAUDE.md) — "Critical bug to avoid" section about roof area vs. footprint.
2. [`backend/docs/benchmark-requirements-jobnimbus.md`](./benchmark-requirements-jobnimbus.md) — source of truth for the 5 example references.
3. [`backend/docs/eagleview-api/README.md`](./eagleview-api/README.md) — why EagleView is out and how to flip it back on if prod access lands.
4. [`backend/services/measurement_service.py`](/Users/mckaysnell/hackathons/JobNimbus/backend/services/measurement_service.py) — the thing under test (if AI-31 has shipped). If missing, the suite calls into `services.google.solar` directly via a thin shim — see "If AI-31 hasn't shipped" below.
5. [`backend/services/google/solar.py`](/Users/mckaysnell/hackathons/JobNimbus/backend/services/google/solar.py) — Eddy's. **Do NOT modify.** `wholeRoofStats.areaMeters2` is already slanted; do not multiply by pitch again.
6. [`backend/models/measurement.py`](/Users/mckaysnell/hackathons/JobNimbus/backend/models/measurement.py) — `Measurement.apply_pitch_multiplier(rise, run)`. Used in the unit tests.

## Required tool usage — DO NOT SKIP

- **Context7 MCP**: `pytest`, `pytest-asyncio`, `respx` (only if a test goes deeper than the service layer).
- **Web search** — confirm latest stable `pytest`, `pytest-asyncio`. Already in dev deps; only update lower bounds if needed.

## What the test suite covers

**One scope** against the 5 example properties:

| # | Scope | Setup | Assertion |
| - | ----- | ----- | --------- |
| 1 | Solar-only | Google Geocoding + Solar live (rate-limited to once/test-run via fixture) | `total_roof_area_sqft` within ±10% of Reference A or B for ≥4/5 |

**Plus four hard guards** (these are the qualification-protecting ones):

- **Roof-area-not-footprint guard** — for any pitch ≥ 4:12, assert measured `total_roof_area_sqft > footprint_sqft × 1.05`. Footprint is the projected polygon area from Solar (`wholeRoofStats` doesn't expose this directly — derive from `roofSegmentStats[*].boundingBox` if needed, or skip with a clear reason). If the bug ever returns, this goes red.
- **Pitch multiplier math** — unit test asserts `Measurement(...).apply_pitch_multiplier(rise, run)` returns:
  - `(4, 12)` → 1.054 ± 0.001
  - `(6, 12)` → 1.118
  - `(8, 12)` → 1.202
- **Idempotency** — `apply_pitch_multiplier` called twice returns the same Measurement (no double multiplication).
- **Google Solar slanted-area sanity** — Solar's `wholeRoofStats.areaMeters2 × 10.7639` must equal `total_roof_area_sqft` exactly (we are not pitch-multiplying Solar's output). Asserts the conversion path doesn't accidentally wedge in a pitch factor.

If AI-31 ships `combine_measurements` later, add `tests/unit/test_combine_measurements.py` in a follow-up PR. Don't block AI-67 on it.

## Reference data

From [`benchmark-requirements-jobnimbus.md`](./benchmark-requirements-jobnimbus.md):

| # | Address | Ref A sqft | Ref B sqft | Pitch |
| - | ------- | ---------- | ---------- | ----- |
| 1 | 21106 Kenswick Meadows Ct, Humble, TX 77338 | 2,443 | 2,343 | 6:12 |
| 2 | 5914 Copper Lilly Lane, Spring, TX 77389 | 4,391 | 4,296 | 8:12 |
| 3 | 122 NW 13th Ave, Cape Coral, FL 33993 | 2,917 | 2,851 | 6:12 |
| 4 | 14132 Trenton Ave, Orland Park, IL 60462 | 2,990 | 2,935 | 4:12 |
| 5 | 835 S Cobble Creek, Nixa, MO 65714 | 3,070 | 3,017 | 8:12 |

## Files to create

```text
backend/tests/fixtures/__init__.py
backend/tests/fixtures/benchmark_references.json     # the 5-row table above as JSON
backend/tests/integration/__init__.py
backend/tests/integration/test_benchmark_accuracy.py
backend/tests/unit/__init__.py
backend/tests/unit/test_pitch_multiplier.py
backend/scripts/validate_measurements.py
```

### `backend/tests/fixtures/benchmark_references.json`

```json
{
  "examples": [
    {"address": "21106 Kenswick Meadows Ct, Humble, TX 77338", "reference_a_sqft": 2443, "reference_b_sqft": 2343, "pitch": "6:12"},
    {"address": "5914 Copper Lilly Lane, Spring, TX 77389",    "reference_a_sqft": 4391, "reference_b_sqft": 4296, "pitch": "8:12"},
    {"address": "122 NW 13th Ave, Cape Coral, FL 33993",       "reference_a_sqft": 2917, "reference_b_sqft": 2851, "pitch": "6:12"},
    {"address": "14132 Trenton Ave, Orland Park, IL 60462",    "reference_a_sqft": 2990, "reference_b_sqft": 2935, "pitch": "4:12"},
    {"address": "835 S Cobble Creek, Nixa, MO 65714",          "reference_a_sqft": 3070, "reference_b_sqft": 3017, "pitch": "8:12"}
  ],
  "test_properties": [
    {"address": "3561 E 102nd Ct, Thornton, CO 80229"},
    {"address": "1612 S Canton Ave, Springfield, MO 65802"},
    {"address": "6310 Laguna Bay Court, Houston, TX 77041"},
    {"address": "3820 E Rosebrier St, Springfield, MO 65809"},
    {"address": "1261 20th Street, Newport News, VA 23607"}
  ]
}
```

Single source of truth — both the integration test and `validate_measurements.py` load from this.

### `backend/tests/integration/test_benchmark_accuracy.py`

Live network test (Geocoding + Solar). Skip in CI if `GOOGLE_MAPS_API_KEY` is unset; run locally via `task backend:test`.

```python
import json
from pathlib import Path

import pytest

REFERENCES = json.loads(
    (Path(__file__).parent.parent / "fixtures" / "benchmark_references.json").read_text()
)
TOLERANCE = 0.10
PASS_THRESHOLD = 4


def _within_tolerance(actual: float, ref_a: float, ref_b: float) -> bool:
    return (
        abs(actual - ref_a) / ref_a <= TOLERANCE
        or abs(actual - ref_b) / ref_b <= TOLERANCE
    )


@pytest.mark.asyncio
@pytest.mark.integration
async def test_solar_path_meets_threshold():
    # For each example: measure() → check ±10% of either reference
    # Assert pass_count >= PASS_THRESHOLD
    ...


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.parametrize("entry", REFERENCES["examples"])
async def test_roof_area_not_footprint_guard(entry):
    # For any pitch >= 4:12, assert measured_sqft > footprint_sqft * 1.05.
    # If footprint can't be computed from Solar's response, skip with reason.
    ...
```

### `backend/tests/unit/test_pitch_multiplier.py`

```python
import pytest

from models.measurement import Measurement


def _stub(area: float = 1000.0) -> Measurement:
    return Measurement(
        address="x",
        total_roof_area_sqft=area,
        predominant_pitch="6:12",
        source="google_solar",
    )


@pytest.mark.parametrize("rise,run,expected", [
    (4, 12, 1.054),
    (6, 12, 1.118),
    (8, 12, 1.202),
])
def test_multiplier_math(rise, run, expected):
    m = _stub().apply_pitch_multiplier(rise, run)
    assert abs(m.pitch_multiplier_applied - expected) < 0.001
    assert abs(m.total_roof_area_sqft - 1000 * expected) < 1.0


def test_idempotent():
    m1 = _stub().apply_pitch_multiplier(6, 12)
    m2 = m1.apply_pitch_multiplier(6, 12)
    assert m1 == m2
```

### `backend/scripts/validate_measurements.py`

CLI version of the integration test. Pre-submission gut-check.

```text
Address                                          Measured  Ref A   Δ A     Ref B   Δ B     Status
21106 Kenswick Meadows Ct, Humble, TX 77338      2,401     2,443   -1.7%   2,343    +2.5%   ✓
5914 Copper Lilly Lane, Spring, TX 77389         4,250     4,391   -3.2%   4,296    -1.1%   ✓
...
PASS: 5/5 within ±10%
```

Skeleton:

```python
"""Run the Google Solar measurement path against the 5 example properties and print a diff table.

Run: cd backend && uv run python -m scripts.validate_measurements
"""
import asyncio
import json
import sys
from pathlib import Path

REFERENCES = json.loads(
    (Path(__file__).parent.parent / "tests/fixtures/benchmark_references.json").read_text()
)


async def main() -> int:
    pass_count = 0
    print(f"{'Address':<55}{'Measured':>10}{'Ref A':>8}{'Δ A':>8}{'Ref B':>8}{'Δ B':>8}  Status")
    for entry in REFERENCES["examples"]:
        ...
    print(f"{pass_count}/{len(REFERENCES['examples'])} within ±10%")
    return 0 if pass_count >= 4 else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
```

Add to `Taskfile.yml`:

```yaml
  backend:validate:
    desc: Run measurement validation against the 5 example properties (live Google APIs)
    dir: backend
    cmds:
      - op run --env-file=.env -- uv run python -m scripts.validate_measurements
```

## If AI-31 hasn't shipped yet

If `backend/services/measurement_service.py` is missing, the integration test and CLI can call `services.google.solar.get_solar_data(lat, lng)` directly via a small shim:

```python
async def _measure(address: str) -> float:
    coords = await geocode(address)
    solar = await get_solar_data(coords.lat, coords.lng)
    return solar.whole_roof_stats.area_meters2 * 10.7639  # m² → ft², slanted
```

When `MeasurementService.measure()` lands, swap the shim out and delete it.

## Verify

```bash
cd backend && uv run pytest tests/unit/ -v
cd backend && uv run pytest tests/integration/ -v -m integration   # needs GOOGLE_MAPS_API_KEY
cd backend && uv run python -m scripts.validate_measurements        # full live run
```

Unit suite finishes in <1s. Integration suite hits live Google APIs — expect 5-10s for the 5 addresses.

## Commit + PR

```bash
git checkout -b mckay/AI-67-benchmark-test-suite
git add backend/tests/ backend/scripts/validate_measurements.py Taskfile.yml backend/docs/
git commit -m "AI-67: hackathon-qualification test suite (Google Solar accuracy + roof-area guard)"
git push -u origin mckay/AI-67-benchmark-test-suite
gh pr create --title "AI-67: hackathon-qualification test suite" --body "..."
```

PR body covers:

- Single Solar-path scope (±10% on ≥4/5 example properties)
- Roof-area-not-footprint hard guard
- Pitch multiplier unit tests + idempotency
- Google Solar slanted-area sanity check
- `validate_measurements.py` CLI for pre-submission gut-check
- Reference data lives in a single JSON fixture used by both the integration test and the CLI
- **Note in body:** EagleView path deferred — sandbox is mock-only; revival path documented in [`backend/docs/eagleview-api/README.md`](./eagleview-api/README.md).

Comment on AI-67 in Linear with the actual pass/fail rate (e.g. "5/5 within ±10%, 4/5 within ±5%, roof-area guard green for all 5").

## What's next after this PR (and what we *could* do)

**On the hackathon critical path:**

1. Run `task backend:validate` against the 5 examples — confirm ≥4/5 pass ±10%. If we fall short, the most likely fix is `predominant_pitch` parsing (Solar reports it per-segment; we need to pick the dominant one before any downstream consumer multiplies).
2. PR 5 ([`handoff-pr5-render-deploy.md`](./handoff-pr5-render-deploy.md)) — Render deployment.
3. Submit the 5 test-property totals via the form in `backend/docs/SUBMISSION.md`.

**Nice-to-haves if there's time (in priority order):**

- **Pitch-overrideable reconciliation** — let users supply a measured pitch on the property form; if present, override Solar's primary pitch before multiplication. Solar's pitch resolution is ±5°; a hand measurement is tighter on edge cases.
- **`combine_measurements` strategies** (AI-31 followup) — if AI-31 ships `avg` / `max_confidence` / `eagleview_wins`, add the unit test stub from the previous version of this doc.
- **EagleView prod revival** — if EagleView approves the production app during the event, follow the steps in [`backend/docs/eagleview-api/README.md`](./eagleview-api/README.md) to flip it on. Add the EagleView-only and reconciled scopes back into this suite as a follow-up PR.
- **Static Maps overlay screenshot in the validation CLI** — drop a debug PNG per address showing the Solar polygon. Helpful for spotting addresses where Solar misclassifies the structure.

## Don'ts

- Do NOT use `os.environ` outside `settings.py`.
- Do NOT use `print()` outside the `validate_measurements.py` CLI script.
- Do NOT modify `backend/services/google/*` or `backend/routers/estimate.py`.
- Do NOT silently expand AI-31's scope. If `combine_measurements` is missing, defer to a follow-up PR.
- Do NOT skip pre-commit hooks.
- Do NOT `git push --force`.
- Do NOT re-introduce EagleView calls in the runtime measurement path until the prod revival steps in `eagleview-api/README.md` are complete.

## When done

After this merges, tell the user:

> "AI-67 merged. Run `task backend:validate` to print the live ±10% table for the 5 example properties. If 5/5 are green, submit. If <4 pass, the most likely culprit is pitch parsing — see `services/google/solar.py` and the `predominant_pitch` derivation."

Stop.
