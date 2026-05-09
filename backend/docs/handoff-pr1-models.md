# Handoff PR 1 of 4 — Pydantic models (AI-44)

> **For a fresh Claude Code session.** This file is self-contained; you do not need any prior conversation context. Read it top-to-bottom, then act.
>
> When this PR is merged, hand off to: [`backend/docs/handoff-pr2-daos.md`](./handoff-pr2-daos.md)

## What you're shipping

The pydantic model layer — the contract every later PR (DAOs, EagleView provider, MeasurementService, EstimateService) will import. **Branch:** `mckay/AI-44-pydantic-models`. **Linear:** AI-44.

## Required reading FIRST

Before writing any code, read these files in this order:

1. [`CLAUDE.md`](/Users/mckaysnell/hackathons/JobNimbus/CLAUDE.md) — repo conventions. Every section.
2. [`backend/docs/benchmark-requirements-jobnimbus.md`](./benchmark-requirements-jobnimbus.md) — the hackathon disqualification spec (roof area ≠ footprint). This is why `Measurement.apply_pitch_multiplier()` exists.
3. [`backend/settings.py`](/Users/mckaysnell/hackathons/JobNimbus/backend/settings.py) — typed settings; you will not import this in PR 1, but other PRs do.
4. [`backend/logger.py`](/Users/mckaysnell/hackathons/JobNimbus/backend/logger.py) — `get_logger(__name__)` pattern. Don't use `print`.
5. [`backend/services/google/solar.py`](/Users/mckaysnell/hackathons/JobNimbus/backend/services/google/solar.py) — Eddy's. **Do NOT modify.** Its return shape informs the `Measurement` model below.
6. Pull AI-44 from Linear MCP for the historical spec — but **note the deviations below override the ticket.**

## Required tool usage — DO NOT SKIP

Before writing or editing **any** code, query current docs. Training data may be stale.

- **Context7 MCP** — `mcp__context7__resolve-library-id` then `mcp__context7__query-docs`:
  - `pydantic` v2 (`BaseModel`, `ConfigDict(frozen=True)`, `model_validator(mode="after")`, `Field(default_factory=...)`, `model_copy(update=...)`)
- **Web search** — confirm latest stable `pydantic` version before adding to `pyproject.toml` (only add if not already a transitive dep — `pydantic-settings` already pulls it in).

If Context7 is unavailable, use web search. **Do NOT write Pydantic v1 syntax** (no `class Config`, no `@validator`).

## Spec deviations from the AI-44 Linear ticket

The ticket has an older draft. Override it with this design:

| AI-44 ticket says | This handoff says | Why |
| --- | --- | --- |
| `AddressResult` | `Address` | Shorter; matches the rest of the codebase |
| Dollars (float) for pricing | **Cents (int)** | Float pricing → rounding bugs. JobNimbus references go to the cent. |
| No `RoofSegment` | `RoofSegment` model | Google Solar returns per-segment; EagleView reports per-line-item. Need granularity for AI-31 reconciliation. |
| No `apply_pitch_multiplier` | Required helper on `Measurement` | THIS is the function that prevents the disqualification bug. AI-31 calls it. |
| `View` + `Views` | `ViewSet` | Single model; rolls up satellite + topdown + abstract |
| `Estimate` has `tax_rate`/`tax`/`total` floats | Cents for `subtotal_cents`, `total_cents`; `waste_factor` (default 0.12) instead of tax | Hackathon scope is roofing estimates, not tax math |

After the PR is opened, **add a comment to AI-44 in Linear** documenting these deviations and pasting the final model signatures.

## Files to create

```
backend/models/__init__.py
backend/models/address.py
backend/models/measurement.py
backend/models/estimate.py
backend/models/view.py
backend/tests/test_models.py
```

### `backend/models/address.py`

```python
from pydantic import BaseModel, ConfigDict


class Address(BaseModel):
    model_config = ConfigDict(frozen=True)

    raw_input: str
    formatted: str
    lat: float
    lng: float
    place_id: str | None = None
```

Frozen so we can use `Address` as a cache key.

### `backend/models/measurement.py`

```python
import math
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class RoofSegment(BaseModel):
    model_config = ConfigDict(frozen=True)

    pitch_degrees: float
    azimuth_degrees: float
    area_sqft: float
    pitch_ratio: str | None = None  # e.g. "6:12"


class Measurement(BaseModel):
    model_config = ConfigDict(frozen=True)

    address: str
    total_roof_area_sqft: float            # THE submitted number
    predominant_pitch: str                  # "6:12"
    pitch_multiplier_applied: float = 1.0   # 1.0 means none applied
    source: Literal["google_solar", "eagleview"]
    sources_consulted: list[str] = Field(default_factory=list)
    segments: list[RoofSegment] = Field(default_factory=list)

    # EagleView-style line items, optional. Lengths in linear feet.
    ridge_lf: float = 0.0
    hip_lf: float = 0.0
    valley_lf: float = 0.0
    rake_lf: float = 0.0
    eave_lf: float = 0.0
    flashing_lf: float = 0.0
    step_flashing_lf: float = 0.0

    raw: dict = Field(default_factory=dict)  # source-of-truth blob, debugging only

    def apply_pitch_multiplier(self, rise: int, run: int) -> "Measurement":
        """Returns a NEW Measurement with the multiplier applied.
        Idempotent: do not re-multiply if pitch_multiplier_applied != 1.0."""
        if self.pitch_multiplier_applied != 1.0:
            return self
        m = math.sqrt(1 + (rise / run) ** 2)
        return self.model_copy(
            update={
                "total_roof_area_sqft": self.total_roof_area_sqft * m,
                "pitch_multiplier_applied": m,
            }
        )
```

Multipliers to verify in tests:
- `(4, 12)` → 1.054
- `(6, 12)` → 1.118
- `(8, 12)` → 1.202

### `backend/models/estimate.py`

```python
from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from models.measurement import Measurement


class LineItem(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str
    category: Literal["materials", "labor", "disposal", "permits", "addons"]
    quantity: float
    unit: str
    unit_price_cents: int
    total_cents: int

    @model_validator(mode="after")
    def _total_matches_qty_x_price(self) -> "LineItem":
        expected = round(self.quantity * self.unit_price_cents)
        if abs(expected - self.total_cents) > 1:  # 1¢ rounding tolerance
            raise ValueError(
                f"total_cents={self.total_cents} doesn't match quantity*unit_price_cents={expected}"
            )
        return self


class Estimate(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    property_address: str
    measurement: Measurement
    line_items: list[LineItem] = Field(default_factory=list)
    subtotal_cents: int
    waste_factor: float = 0.12
    total_cents: int
    description: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    @model_validator(mode="after")
    def _subtotal_matches_line_items(self) -> "Estimate":
        if self.line_items:
            expected = sum(li.total_cents for li in self.line_items)
            if expected != self.subtotal_cents:
                raise ValueError(
                    f"subtotal_cents={self.subtotal_cents} doesn't match sum of line_items={expected}"
                )
        return self
```

Use `datetime.now(UTC)` (Python 3.14+). Do not use `datetime.utcnow()` — deprecated.

### `backend/models/view.py`

```python
from pydantic import BaseModel, ConfigDict


class ViewSet(BaseModel):
    model_config = ConfigDict(frozen=True)

    property_id: str
    satellite_url: str | None = None
    topdown_url: str | None = None
    abstract_payload: dict | None = None
```

### `backend/models/__init__.py`

```python
from models.address import Address
from models.estimate import Estimate, LineItem
from models.measurement import Measurement, RoofSegment
from models.view import ViewSet

__all__ = [
    "Address",
    "Estimate",
    "LineItem",
    "Measurement",
    "RoofSegment",
    "ViewSet",
]
```

## Tests

`backend/tests/test_models.py`. No network. Pure model construction. Cover:

- `Address` round-trips through `model_dump()` / `model_validate()`
- `Address` is frozen (mutating raises `ValidationError`)
- `Measurement.apply_pitch_multiplier(4, 12)` ≈ 1.054 (within 0.001)
- `Measurement.apply_pitch_multiplier(6, 12)` ≈ 1.118
- `Measurement.apply_pitch_multiplier(8, 12)` ≈ 1.202
- `apply_pitch_multiplier` is idempotent (calling twice returns the same object, no double-multiplication)
- `LineItem` raises `ValidationError` when `total_cents` doesn't match `quantity * unit_price_cents`
- `Estimate` raises `ValidationError` when `subtotal_cents ≠ sum(line_items[].total_cents)`
- `Estimate` round-trips through `model_dump_json()` / `model_validate_json()`
- All public names import from `models` package: `from models import Address, Measurement, RoofSegment, LineItem, Estimate, ViewSet`

## Process

1. **Plan first** — write the plan in prose. Confirm the file list. (If a human is steering, stop and wait for "go".)
2. **Implement** — small, focused edits. Use `from logger import get_logger` if you log anywhere (you probably don't need to in models).
3. **Test:**
   ```bash
   cd backend && uv run pytest tests/test_models.py -v
   cd backend && uv run python -c "from models import Address, Measurement, RoofSegment, LineItem, Estimate, ViewSet; print('imports OK')"
   ```
   All green or you don't move on.
4. **Commit + push + PR:**
   ```bash
   git checkout -b mckay/AI-44-pydantic-models
   git add backend/models/ backend/tests/test_models.py
   git commit -m "AI-44: pydantic models for address, measurement, estimate, view"
   git push -u origin mckay/AI-44-pydantic-models
   gh pr create --title "AI-44: pydantic models for address, measurement, estimate, view" --body "..."
   ```
   PR body covers the deviations from the AI-44 ticket spec (link the ticket).
5. **Linear comment** — paste the final model signatures + the deviation rationale on AI-44.

## Don'ts

- Do NOT use `os.environ` (irrelevant here, but the rule applies everywhere).
- Do NOT use `print()`.
- Do NOT write Pydantic v1 (`class Config`, `@validator`). v2 only.
- Do NOT modify `backend/services/google/*` or `backend/routers/estimate.py`.
- Do NOT skip pre-commit hooks (`--no-verify`).
- Do NOT `git push --force`.

## When done

After the PR is opened and the URL is shared, hand off to:

**[`backend/docs/handoff-pr2-daos.md`](./handoff-pr2-daos.md)** — SQLite + DAOs (AI-43, AI-45, AI-46, AI-47, AI-48). It depends on PR 1 being merged.

Stop after sharing the PR URL.
