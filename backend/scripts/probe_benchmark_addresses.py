"""Submit each of the 10 benchmark addresses to EagleView sandbox and
report which ones the sandbox accepts.

Status (2026-05-09): kept for parity with the prod revival path. Against
the developer sandbox, every address comes back "accepted" with the same
canned `report_id=47741613` — that's an Apigee mock, not real coverage.
See backend/docs/eagleview-api/README.md for the full sandbox findings.

Why this exists: EagleView's sandbox restricts data to addresses they've
pre-loaded. We don't know which (if any) of our benchmark addresses are
covered. This script tells us — fast — by trying each, capturing the
report_id or error, and printing a summary table. Does NOT wait for
report completion; just confirms submission acceptance.

Output:
  stdout       — per-address result + summary table
  backend/tmp/eagleview_probe/<timestamp>.json — machine-readable results

Run:
  task backend:eagleview-probe
"""

import asyncio
import json
import time
from pathlib import Path

from dao import eagleview_cache_dao
from dao.database import init_db
from logger import get_logger
from providers.eagleview import EagleViewError, EagleViewProvider
from scripts.benchmark_addresses import ALL_ADDRESSES, EXAMPLE_ADDRESSES
from settings import settings

log = get_logger(__name__)

PROBE_DIR = Path(__file__).resolve().parents[1] / "tmp" / "eagleview_probe"


async def _probe_one(provider: EagleViewProvider, address: str) -> dict:
    """Submit one address; capture either the report_id or the error."""
    cached = eagleview_cache_dao.get(address)
    if cached and cached.job_id:
        return {
            "address": address,
            "outcome": "cached",
            "report_id": cached.job_id,
            "status": cached.status,
            "error": None,
        }
    try:
        report_id = await provider.request_report(address)
        return {
            "address": address,
            "outcome": "accepted",
            "report_id": report_id,
            "status": "pending",
            "error": None,
        }
    except EagleViewError as e:
        return {
            "address": address,
            "outcome": "rejected",
            "report_id": None,
            "status": None,
            "error": str(e),
        }


async def main() -> int:
    init_db()
    PROBE_DIR.mkdir(parents=True, exist_ok=True)

    if not (settings.EAGLEVIEW_CLIENT_ID and settings.EAGLEVIEW_CLIENT_SECRET):
        print("ERROR: EAGLEVIEW_CLIENT_ID / EAGLEVIEW_CLIENT_SECRET not set.")
        print("Run via: task backend:eagleview-probe (it wraps with `op run --env-file=.env`).")
        return 2

    provider = EagleViewProvider()
    if provider.mock_mode:
        print("ERROR: provider auto-fell-back to mock mode — credentials weren't picked up.")
        return 2

    print(f"Probing {len(ALL_ADDRESSES)} benchmark addresses against {provider.base_url}")
    print()

    # Run sequentially to make stdout readable and avoid overwhelming sandbox
    # with parallel auth — the token cache amortizes anyway.
    results: list[dict] = []
    for i, addr in enumerate(ALL_ADDRESSES, 1):
        bucket = "example" if addr in EXAMPLE_ADDRESSES else "test"
        print(f"[{i}/{len(ALL_ADDRESSES)}] ({bucket}) {addr}")
        r = await _probe_one(provider, addr)
        r["bucket"] = bucket
        results.append(r)
        if r["outcome"] == "accepted":
            print(f"        -> ACCEPTED report_id={r['report_id']}")
        elif r["outcome"] == "cached":
            print(f"        -> CACHED  report_id={r['report_id']} status={r['status']}")
        else:
            err_short = (r["error"] or "")[:80]
            print(f"        -> REJECTED {err_short}")

    # Save machine-readable results.
    out = PROBE_DIR / f"probe-{int(time.time())}.json"
    out.write_text(json.dumps(results, indent=2) + "\n")
    print()
    print(f"Wrote {out}")

    # Summary table.
    print()
    print("=" * 72)
    print(f"{'ADDR':<55} {'BUCKET':<8} OUTCOME")
    print("=" * 72)
    for r in results:
        addr_short = r["address"][:53]
        print(f"{addr_short:<55} {r['bucket']:<8} {r['outcome']}")
    print()
    accepted = sum(1 for r in results if r["outcome"] in ("accepted", "cached"))
    rejected = sum(1 for r in results if r["outcome"] == "rejected")
    print(f"Accepted: {accepted}/{len(results)}    Rejected: {rejected}/{len(results)}")
    if accepted == 0:
        print()
        print("No addresses accepted. Likely sandbox doesn't cover any benchmark address.")
        print("Plan B: rely on Google Solar for area, derive linear measurements.")
    return 0 if rejected == 0 else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
