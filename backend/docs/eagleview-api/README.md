# EagleView API — what's here and why we didn't ship it

This directory holds the OpenAPI/Swagger specs for the five EagleView APIs we'd need to integrate against in production. We're keeping them in-repo so a future iteration can wire up the real path with a base-URL swap, not a redesign.

## TL;DR — why EagleView isn't in our runtime path for the hackathon

EagleView's developer sandbox (`https://sandbox.apicenter.eagleview.com`) is an Apigee-mocked stub, not a real test environment. We confirmed this end-to-end:

| Endpoint | Result |
| -------- | ------ |
| `POST https://apicenter.eagleview.com/oauth2/v1/token` | **Works.** Mints a real Okta JWT (`iss=eagleview.okta.com/oauth2/default`). |
| `POST /v2/Order/PlaceOrder` (sandbox) | Hardcoded — returns `report_id=47741613` for **any** address. All 10 benchmark addresses "accepted". |
| `GET /v3/Report/GetReport?reportId=47741613` (sandbox) | `400 "The response ?reportId=47741613 does not exist!"` — no canned reply for any reportId we tried. |
| `POST /v3/Report/GetReports` (sandbox) | Same Apigee "does not exist!" stub. |
| `GET /v3/Order/GetAccountDetails` (sandbox) | `401 invalid_token` — token signed by the wrong keypair for this route. |
| Property Data API sandbox (`sandbox.apis.eagleview.com`) | Coverage limited to a 1.5 sq mi bbox in Omaha, NE. None of the benchmark addresses are inside. |

The developer portal banner spells it out: *"This application is sandbox only. To go live with your integration, create a production application and follow the Go-live Request process."* — production access is a manual approval step from EagleView, not a credential swap. Not a same-day path during a hackathon.

## What's already wired up (and would work against prod)

If we ever get a production app approved, the integration is essentially a base-URL swap:

- [`backend/providers/eagleview.py`](../../providers/eagleview.py) — full provider: token mint + cache, `request_report`, `get_report_status`, `fetch_report`. Uses `EAGLEVIEW_BASE_URL`, `EAGLEVIEW_CLIENT_ID`, `EAGLEVIEW_CLIENT_SECRET` from `settings`.
- [`backend/dao/eagleview_cache_dao.py`](../../dao/eagleview_cache_dao.py) — SQLite cache of submitted/complete reports keyed by normalized address.
- [`backend/scripts/probe_benchmark_addresses.py`](../../scripts/probe_benchmark_addresses.py) — fans out the 10 benchmark addresses, captures accepted/rejected per-address. Useful as a smoke test against any environment.
- [`backend/scripts/precache_eagleview.py`](../../scripts/precache_eagleview.py) — submits all 10 in parallel and polls until complete (~20 min wall-clock against real prod).
- [`backend/scripts/dump_eagleview_payload.py`](../../scripts/dump_eagleview_payload.py) — submit one + dump the raw `GetReport` JSON for schema confirmation.

OAuth is verified working. The remaining unknown is the actual `GetReport` payload shape — we have the documented schema (see `Measurement Order API Documentation.json` → `definitions.V3GetReportResponseBody`), but no real response to confirm field-by-field. The `Measurement` Pydantic model in [`backend/models/measurement.py`](../../models/measurement.py) is aligned to the documented field names; it would need a smoke test against the first real report to confirm.

## How we'd flip on the EagleView path with prod access

1. Get a production app approved (Go-live Request process). Add new client_id/secret to 1Password vault `AIBuilderDay`.
2. Set `EAGLEVIEW_BASE_URL=https://apicenter.eagleview.com` (drop the `sandbox.` prefix).
3. Run `task backend:eagleview-dump -- "21106 Kenswick Meadows Ct, Humble, TX 77338"` once, eyeball the raw payload against `_parse_report_payload` in `eagleview.py`, fix any field name drift.
4. Run `task backend:precache` to populate the cache for the 10 benchmark addresses (~20 min).
5. Add an EagleView-first scope back to `MeasurementService.measure()` and re-enable the EagleView-only / reconciled paths in the AI-67 test suite.

None of step 1 is on the hackathon critical path — Google Solar's `wholeRoofStats.areaMeters2` is already slanted roof area (the disqualifying field), so we have a single working source.

## Files in this directory

- `Measurement Order API Documentation.json` — the one we'd use most: `PlaceOrder`, `GetReport`, `GetReports`, `file-links`. Schema-of-record for our `Measurement` model.
- `Eagleview Property Data API Documentation.json` — alternate path: data-element queries (no order/poll), but sandbox is locked to Omaha.
- `TrueDesign API Documentation.json` — solar design tooling. Out of scope for roof measurement.
- `Imagery API Documentation.json` — raw imagery delivery. Could be useful for the roof-image step, but Google Static Maps already covers that.
- `WMTS V2 API Documentation.json` — tile service for map overlays. Not needed for our pipeline.

Source: pulled from `developer.eagleview.com` on 2026-05-09. If you ever update them, keep the filenames stable so links from this README don't rot.
