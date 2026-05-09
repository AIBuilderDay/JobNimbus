# Frontend handoff — Pricing flow + judge-proof benchmark

Audience: the teammate wiring up `PricingPage.tsx` (and the rest of the
flow). Pair this MD with the `openapi.json` exported from FastAPI
(instructions at the bottom). Drop both into your Claude Code session
and it'll have everything it needs to scaffold the page.

## What's new on the backend

| Endpoint | Method | What it gives you |
|---|---|---|
| `/api/measurement` | GET | Generic Solar lookup for **any** address. Use this on the pricing page when an address is entered. |
| `/api/benchmark/results` | GET | **Judge-proof.** Live runs the 5 reference properties and returns measured-vs-reference + pass/fail. Render this as a table on the pricing page. |
| `/api/benchmark/references` | GET | Just the reference fixture, no live calls (cheap). Use to render the table skeleton before measurements come back. |
| `/api/estimate/{id}/pricing` | GET / POST / PUT | Compute / read / update pricing. POST first, then PUT for slider changes. |
| `/api/estimate/{id}/proposal` | GET / POST | Assemble the proposal payload (used by ProposalPage). |
| `/api/estimate/{id}/finalize` | POST | Lock the estimate (used by FinalizationPage). |
| `/api/estimate/{id}/blueprint` | GET | Wireframe roof geometry + per-segment annotations. |

## The pricing flow, end-to-end

```
1. AddressPage     → POST /api/estimate/start { address }
                     → returns { estimate_id, lat, lng, solar, ... }
                     stash estimate_id in the Zustand store

2. EstimatorPage   → already works (uses solar data from #1)

3. PricingPage on mount:
   a. POST /api/estimate/{estimate_id}/pricing   (no body needed)
      → returns { line_items, subtotal_cents, customer_total_cents, financing_options, ... }
   b. GET /api/benchmark/results
      → returns proof table data (renders the "5/5 within ±10%" panel)

4. PricingPage on slider change (margin, addons, etc.):
   PUT /api/estimate/{estimate_id}/pricing
   body: { margin_pct: 42 }   ← only the fields that changed
   → returns the recomputed Pricing payload

5. ProposalPage    → POST /api/estimate/{estimate_id}/proposal
                     body: { cover_note?, recipient_email?, tone?, ... }
                     → returns the full proposal payload

6. FinalizationPage → POST /api/estimate/{estimate_id}/finalize
                      → returns the locked estimate snapshot
```

## Why the pricing math is on the server

The customer total **must** match what the page shows. By centralizing
the math in `backend/services/pricing.py`, the proposal PDF, the
finalization summary, and the slider all read from one source. The
formulas mirror what `PricingPage.tsx` does today exactly:

- Material qty = roof_area_sq_ft × (1 + waste_factor)  *(default 12% waste)*
- Subtotal = materials + labor (3,870) + disposal (420) + addons
- Margin add-on = subtotal × (m / (100 − m))  *(matches PricingPage.tsx:298)*
- Sales tax @ 7.5% on materials + addons + margin (**labor exempt**)
- Customer total = subtotal + margin + sales tax
- All numbers in **cents** (int)

## Money is in cents — divide by 100 in the UI

```ts
function fmtUSD(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency", currency: "USD",
  });
}
```

Don't try to roundtrip cents → float → cents. Ever.

## Benchmark proof — what to render

`GET /api/benchmark/results` returns:

```json
{
  "tolerance_pct": 10,
  "pass_threshold": 4,
  "total": 5,
  "pass_count": 5,
  "qualified": true,
  "results": [
    {
      "address": "21106 Kenswick Meadows Ct, Humble, TX 77338",
      "pitch": "6:12",
      "reference_a_sqft": 2443,
      "reference_b_sqft": 2343,
      "measured_sqft": 2401.3,
      "error_vs_a_pct": 1.71,
      "error_vs_b_pct": 2.49,
      "best_error_pct": 1.71,
      "passed": true,
      "imagery_quality": "HIGH",
      "segments": 6,
      "status": "ok",
      "location": { "lat": 30.06..., "lng": -95.24... }
    },
    ...
  ]
}
```

**Suggested UI:** a table panel on PricingPage labeled "Live measurement
benchmark" with one row per result. Show the address, both reference
values, our measured value, the % error, and a green check / red X.
Headline: `{pass_count}/{total} within ±{tolerance_pct}%`.

The endpoint is **cached in process memory** after the first call —
add a "Refresh" button that hits `?refresh=true` if you want it
on-demand.

## Zod schemas to add (frontend)

Match the contract verbatim. Keys to copy:

- `Pricing` → `frontend/src/types/pricing.ts`:
  `line_items[]`, `subtotal_cents`, `margin_pct`, `margin_addon_cents`,
  `sales_tax_pct`, `sales_tax_cents`, `customer_total_cents`,
  `financing_options[]`
- `BenchmarkResults` → `frontend/src/types/benchmark.ts`:
  shape above
- `Proposal` → `frontend/src/types/proposal.ts`:
  `issued_at`, `valid_through`, `contractor`, `property`, `measurement`,
  `pricing`, `cover_note`, `recipient_email`, `cc_email`, `tone`, `options`

## TanStack Query hooks to add

```ts
// frontend/src/hooks/usePricing.ts
export function usePricing(estimateId: string) {
  return useQuery({
    queryKey: ["pricing", estimateId],
    queryFn: () => fetchPricing(estimateId),  // POST then GET, or just POST
    staleTime: 30_000,
  });
}

export function useUpdatePricing(estimateId: string) {
  return useMutation({
    mutationFn: (overrides: PricingOverrides) => putPricing(estimateId, overrides),
    onSuccess: (data) => qc.setQueryData(["pricing", estimateId], data),
  });
}

// frontend/src/hooks/useBenchmark.ts
export function useBenchmark(refresh = false) {
  return useQuery({
    queryKey: ["benchmark", refresh],
    queryFn: () => fetchBenchmark(refresh),
    staleTime: 5 * 60 * 1000,  // 5 min — Solar doesn't change minute-to-minute
  });
}
```

## Override knobs the PricingPage already exposes

The slider, material picker, and add-on toggles all map to fields on
`PricingOverrides`. Send only the fields that changed:

| UI control | Body field |
|---|---|
| Margin slider | `margin_pct: 0..99` |
| Material picker | `material_name`, `material_unit_price_cents` |
| Add-ons toggles (sum to cents) | `addons_cents` |
| Waste % override | `waste_factor: 0.0..1.0` |
| Labor override | `labor_cents` |
| Disposal override | `disposal_cents` |
| Sales tax % override | `sales_tax_pct` |

## Don't break

- Use **relative paths** (`/api/...`) so Vite's proxy handles dev. No
  hardcoded `localhost:8000`.
- Validate every response with Zod's `.safeParse` at the API boundary
  (per `frontend/CLAUDE.md`).
- Don't call the same endpoint from two places — wrap each in a hook.

## Getting the OpenAPI spec

```bash
# 1. Start the backend
cd backend && task backend:dev
# (or `op run --env-file=.env -- uv run uvicorn main:app --reload`)

# 2. In another terminal, download the spec
curl http://localhost:8000/openapi.json | jq . > openapi.json

# 3. (Optional) browse it interactively
open http://localhost:8000/docs
```

Send `openapi.json` + this MD to your Claude Code session. It's the
contract — every endpoint, every shape, every status code.
