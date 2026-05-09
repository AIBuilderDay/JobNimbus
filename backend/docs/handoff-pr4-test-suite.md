# Handoff PR 4 of 4 — Hackathon-qualification test suite (AI-67)

> **For a fresh Claude Code session.** This file is self-contained; you do not need any prior conversation context. Read it top-to-bottom, then act.
>
> **Prerequisite:** PRs 1, 2, 3 ([`handoff-pr1-models.md`](./handoff-pr1-models.md), [`handoff-pr2-daos.md`](./handoff-pr2-daos.md), [`handoff-pr3-eagleview.md`](./handoff-pr3-eagleview.md)) merged. Also AI-31 (MeasurementService) must be either merged to `main` OR available on a branch you can rebase onto. Verify:
> ```bash
> git log --oneline main | head -15
> # should show AI-44, AI-43..48, AI-27/66, and ideally AI-31 (MeasurementService)
> ls backend/services/measurement_service.py
> # if missing, AI-31 hasn't shipped yet — STOP and tell the user
> ```
>
> When this PR is merged, this handoff is COMPLETE. There is no PR 5.

## What you're shipping

The permanent test suite that proves we're submitting **roof area** (not footprint) and that our totals fall within ±10% of the hackathon's reference values for ≥4 of 5 example properties. **Branch:** `mckay/AI-67-benchmark-test-suite`. **Linear:** AI-67.

This is the test suite that prevents us from getting **disqualified**. Treat it accordingly.

## Required reading FIRST

1. [`CLAUDE.md`](/Users/mckaysnell/hackathons/JobNimbus/CLAUDE.md) — note the "Critical bug to avoid" section about roof area vs. footprint.
2. [`backend/docs/benchmark-requirements-jobnimbus.md`](./benchmark-requirements-jobnimbus.md) — the source of truth for the 5 example references. **Read all 89 lines.**
3. [`backend/services/measurement_service.py`](/Users/mckaysnell/hackathons/JobNimbus/backend/services/measurement_service.py) — the thing under test. Read the full `measure(address)` API.
4. [`backend/providers/eagleview.py`](/Users/mckaysnell/hackathons/JobNimbus/backend/providers/eagleview.py) — you will mock its `get_measurements` for the Solar-only path test.
5. [`backend/services/google/solar.py`](/Users/mckaysnell/hackathons/JobNimbus/backend/services/google/solar.py) — Eddy's. You may mock it for the EagleView-only path test. **Do NOT modify.**
6. [`backend/dao/eagleview_cache_dao.py`](/Users/mckaysnell/hackathons/JobNimbus/backend/dao/eagleview_cache_dao.py) — for pre-seeding cache from fixture in the integration tests.
7. [`backend/models/measurement.py`](/Users/mckaysnell/hackathons/JobNimbus/backend/models/measurement.py) — `Measurement.apply_pitch_multiplier(rise, run)`. Used in the unit tests.
8. Pull AI-67 from Linear MCP for the historical spec.

## Required tool usage — DO NOT SKIP

- **Context7 MCP**:
  - `pytest` — parametrized tests with `@pytest.mark.parametrize`
  - `pytest-asyncio` — for async test functions and fixtures
  - `respx` — for mocking httpx if any test goes deeper than the service layer
- **Web search** — confirm latest stable `pytest`, `pytest-asyncio`, `respx`. They're already in dev deps; only update lower bounds if needed.

## What the test suite covers

**Three "scopes" run against the same 5 example properties:**

| # | Scope | Setup | Assertion |
| - | ----- | ----- | --------- |
| 1 | Solar-only | EagleView mocked to raise `CacheMissError` | `total_roof_area_sqft` within ±10% of Reference A or B for ≥4/5 |
| 2 | EagleView-only | Solar mocked to return `None`; cache pre-seeded from fixture | Same ±10% bar |
| 3 | Reconciled | Both providers live (cache pre-seeded) | EagleView wins on cache hit; final number within ±10% on ≥4/5 |

**Plus four hard guards:**

- **Roof-area-not-footprint guard** — for any test address with pitch ≥ 4:12, assert `total_roof_area_sqft > footprint_sqft × 1.05`. Footprint is computed from Solar's `wholeRoofStats.areaMeters2 × 10.7639` (Solar's roof area is slanted; for footprint we'd need the projected polygon). If the bug ever returns, this test goes red.
- **Pitch multiplier math** — unit test asserts `Measurement(...).apply_pitch_multiplier(rise, run)` returns the right multiplier:
  - `(4, 12)` → 1.054 (within 0.001)
  - `(6, 12)` → 1.118
  - `(8, 12)` → 1.202
- **Idempotency** — `apply_pitch_multiplier` called twice returns the same Measurement (no double multiplication).
- **Combined-measurement helper** — when both sources hit, `combine_measurements(solar, eagleview)` returns the configurable strategy result. Test all three strategies: `"avg"`, `"max_confidence"`, `"eagleview_wins"`.

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

```
backend/tests/fixtures/__init__.py
backend/tests/fixtures/benchmark_references.json     # the 5-row table above as JSON
backend/tests/fixtures/eagleview_cache_seed.json     # seed data for cache (from precache run)
backend/tests/fixtures/__init__.py
backend/tests/integration/__init__.py
backend/tests/integration/test_benchmark_accuracy.py
backend/tests/unit/__init__.py
backend/tests/unit/test_pitch_multiplier.py
backend/tests/unit/test_combine_measurements.py
backend/scripts/validate_measurements.py
```

## Files to modify

If `combine_measurements` doesn't already exist on `MeasurementService` (AI-31's scope), add a stub or coordinate with whoever owns AI-31. **Do not silently expand AI-31's scope** — if the helper isn't there, comment on AI-31 in Linear and ship a small companion PR or rebase onto an AI-31 branch.

### `backend/tests/fixtures/benchmark_references.json`

```json
{
  "examples": [
    {
      "address": "21106 Kenswick Meadows Ct, Humble, TX 77338",
      "reference_a_sqft": 2443,
      "reference_b_sqft": 2343,
      "pitch": "6:12"
    },
    {
      "address": "5914 Copper Lilly Lane, Spring, TX 77389",
      "reference_a_sqft": 4391,
      "reference_b_sqft": 4296,
      "pitch": "8:12"
    },
    {
      "address": "122 NW 13th Ave, Cape Coral, FL 33993",
      "reference_a_sqft": 2917,
      "reference_b_sqft": 2851,
      "pitch": "6:12"
    },
    {
      "address": "14132 Trenton Ave, Orland Park, IL 60462",
      "reference_a_sqft": 2990,
      "reference_b_sqft": 2935,
      "pitch": "4:12"
    },
    {
      "address": "835 S Cobble Creek, Nixa, MO 65714",
      "reference_a_sqft": 3070,
      "reference_b_sqft": 3017,
      "pitch": "8:12"
    }
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

This is the single source of truth for the references. Both the integration test and the `validate_measurements.py` CLI load from it.

### `backend/tests/fixtures/eagleview_cache_seed.json`

Seed data for the integration tests (so they don't make 20-min EagleView calls in CI). Generated once from a real precache run by exporting `eagleview_cache.measurements_json` for the 5 example properties:

```bash
sqlite3 backend/jobnimbus.db <<'SQL'
.headers on
.mode json
SELECT address_normalized, measurements_json
FROM eagleview_cache
WHERE status = 'complete';
SQL
```

If the precache hasn't run yet (or you don't have access), populate this with **representative hand-crafted Measurement dicts** that match the reference values within ±5%. Mark them in a comment as "synthetic" so they're regenerated from real data later.

### `backend/tests/integration/test_benchmark_accuracy.py`

Pseudo-code:

```python
import json
from pathlib import Path

import pytest
from unittest.mock import AsyncMock

from dao import eagleview_cache_dao
from providers.eagleview import CacheMissError
# from services.measurement_service import MeasurementService  # from AI-31

REFERENCES = json.loads((Path(__file__).parent.parent / "fixtures" / "benchmark_references.json").read_text())
SEED = json.loads((Path(__file__).parent.parent / "fixtures" / "eagleview_cache_seed.json").read_text())
TOLERANCE = 0.10  # ±10%
PASS_THRESHOLD = 4  # ≥4 of 5 must pass


def _within_tolerance(actual: float, ref_a: float, ref_b: float) -> bool:
    return (
        abs(actual - ref_a) / ref_a <= TOLERANCE
        or abs(actual - ref_b) / ref_b <= TOLERANCE
    )


@pytest.fixture
def seeded_cache(isolated_db):
    """Pre-load eagleview_cache with the 5 example properties from seed JSON."""
    for entry in SEED:
        eagleview_cache_dao.update_complete(
            entry["address"], raw={}, measurements=entry["measurements"]
        )
    yield


@pytest.mark.asyncio
async def test_solar_only_path(isolated_db, monkeypatch):
    # Mock EagleView provider to always raise CacheMissError
    # Run MeasurementService.measure() against each of the 5 example properties
    # Count how many fall within ±10% of either reference
    # Assert count >= PASS_THRESHOLD
    ...


@pytest.mark.asyncio
async def test_eagleview_only_path(seeded_cache, monkeypatch):
    # Mock Solar provider to return None
    # MeasurementService.measure() pulls from cache
    ...


@pytest.mark.asyncio
async def test_reconciled_path(seeded_cache):
    # Both providers live
    # Assert EagleView wins on cache hit (source == "eagleview")
    # Assert ±10% on ≥4/5
    ...


@pytest.mark.asyncio
@pytest.mark.parametrize("entry", REFERENCES["examples"])
async def test_roof_area_not_footprint_guard(entry, seeded_cache):
    # For any pitch >= 4:12, assert measured_sqft > footprint_sqft * 1.05
    # If footprint can't be computed, skip with a clear reason
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
    assert m2.pitch_multiplier_applied == m1.pitch_multiplier_applied
```

### `backend/tests/unit/test_combine_measurements.py`

If `combine_measurements` exists in MeasurementService:

```python
import pytest

# from services.measurement_service import combine_measurements

def _solar(area: float) -> Measurement: ...
def _eagleview(area: float) -> Measurement: ...


@pytest.mark.parametrize("strategy,expected", [
    ("avg",            (1000 + 1100) / 2),
    ("max_confidence", 1100),  # eagleview is canonically more accurate
    ("eagleview_wins", 1100),
])
def test_combine_strategies(strategy, expected):
    out = combine_measurements(_solar(1000), _eagleview(1100), strategy=strategy)
    assert out.total_roof_area_sqft == expected
```

### `backend/scripts/validate_measurements.py`

CLI version of the integration test for pre-submission gut-check. Prints a comparison table:

```
Address                                          Measured  Ref A   Δ A     Ref B   Δ B     Status
21106 Kenswick Meadows Ct, Humble, TX 77338      2,401     2,443   -1.7%   2,343    +2.5%   ✓
5914 Copper Lilly Lane, Spring, TX 77389         4,250     4,391   -3.2%   4,296    -1.1%   ✓
...
PASS: 5/5 within ±10%
```

Skeleton:

```python
"""Run MeasurementService against the 5 example properties and print a diff table.

Run: cd backend && uv run python -m scripts.validate_measurements
"""
import asyncio
import json
import sys
from pathlib import Path

# from services.measurement_service import MeasurementService

REFERENCES = json.loads(
    (Path(__file__).parent.parent / "tests/fixtures/benchmark_references.json").read_text()
)


async def main() -> int:
    pass_count = 0
    print(f"{'Address':<55}{'Measured':>10}{'Ref A':>8}{'Δ A':>8}{'Ref B':>8}{'Δ B':>8}  Status")
    for entry in REFERENCES["examples"]:
        # measure each, print row, increment pass_count if within tolerance
        ...
    print(f"{pass_count}/{len(REFERENCES['examples'])} within ±10%")
    return 0 if pass_count >= 4 else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
```

Also add to `Taskfile.yml`:

```yaml
  backend:validate:
    desc: Run measurement validation against the 5 example properties
    dir: backend
    cmds:
      - op run --env-file=.env -- uv run python -m scripts.validate_measurements
```

## Verify

```bash
cd backend && uv run pytest tests/unit/ -v
cd backend && uv run pytest tests/integration/ -v
cd backend && uv run pytest tests/ -v   # full suite green
cd backend && uv run python -m scripts.validate_measurements
```

The full suite finishes in **<10s** if the EagleView fixture is well-formed (no real network calls).

## Commit + PR

```bash
git checkout -b mckay/AI-67-benchmark-test-suite
git add backend/tests/ backend/scripts/validate_measurements.py Taskfile.yml
git commit -m "AI-67: hackathon-qualification test suite (sqft accuracy + roof-area guard)"
git push -u origin mckay/AI-67-benchmark-test-suite
gh pr create --title "AI-67: hackathon-qualification test suite" --body "..."
```

PR body covers:
- Three scope tests: Solar-only / EagleView-only / Reconciled (each ±10% on ≥4/5)
- Roof-area-not-footprint hard guard
- Pitch multiplier unit tests + idempotency
- `combine_measurements` strategy unit tests
- `validate_measurements.py` CLI for pre-submission gut-check
- Reference data lives in a single JSON fixture used by both the integration test and the CLI

After PR is open, **comment on AI-67 in Linear** with the actual pass/fail rate from the suite (e.g. "5/5 within ±10%, 4/5 within ±5%, roof-area guard green for all 5").

## Don'ts

- Do NOT use `os.environ` outside `settings.py`.
- Do NOT use `print()` outside the `validate_measurements.py` CLI script (where it's the actual output).
- Do NOT modify `backend/services/google/*` or `backend/routers/estimate.py`.
- Do NOT make live EagleView calls in any test — always use the seed fixture.
- Do NOT silently expand AI-31's scope. If `combine_measurements` is missing, comment on AI-31 first.
- Do NOT skip pre-commit hooks.
- Do NOT `git push --force`.
- Do NOT commit fixture data containing PII (addresses are public; redact account names / tokens / customer info from any real EagleView responses).

## When done

This is the last PR in the EagleView pipeline.

After it merges, tell the user:

> "All four PRs (AI-44 models, AI-43..48 DAOs, AI-27/66 EagleView, AI-67 test suite) are merged. Next:
> 1. Run `task backend:precache` (~20 min wall-clock) to populate `eagleview_cache` with the 5 test properties
> 2. Run `task backend:validate` to confirm the 5 example properties pass ±10%
> 3. Submit the 5 test-property totals via the form in `backend/docs/SUBMISSION.md`"

Stop.
