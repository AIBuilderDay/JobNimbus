"""Fire EagleView reports for all 10 benchmark properties in parallel.

Status (2026-05-09): non-functional against the developer sandbox (the
sandbox PlaceOrder is canned and GetReport has no stubs). Kept as the
day-1 warmup script for the prod revival path documented in
backend/docs/eagleview-api/README.md.

Run once at hackathon start. Polls every 60s until all addresses are
complete or any fails. Total wall-clock ~20 minutes.

Idempotent: addresses already cached as 'complete' are skipped, so it's
safe to re-run if the polling loop is interrupted.

Run: task backend:precache
"""

import asyncio
import sys

from dao import eagleview_cache_dao
from dao.database import init_db
from logger import get_logger
from providers.eagleview import EagleViewError, EagleViewProvider
from scripts.benchmark_addresses import ALL_ADDRESSES

log = get_logger(__name__)


ADDRESSES = ALL_ADDRESSES


POLL_INTERVAL_SECONDS = 60


async def _kickoff(provider: EagleViewProvider, addr: str) -> tuple[str, str | None]:
    """Submit a report for one address. Returns (addr, job_id) on success,
    (addr, None) if cached complete already (caller skips it)."""
    cached = eagleview_cache_dao.get(addr)
    if cached and cached.status == "complete":
        log.info("precache: already complete, skipping address=%s", addr)
        return addr, None
    job_id = await provider.request_report(addr)
    return addr, job_id


async def main() -> int:
    init_db()
    provider = EagleViewProvider()

    # Fire all submissions in parallel. asyncio.gather raises on the first
    # failure, which we want — if EagleView rejects one address we want to
    # know now, not after 20 minutes of polling.
    try:
        results = await asyncio.gather(*[_kickoff(provider, a) for a in ADDRESSES])
    except EagleViewError:
        log.exception("precache: kickoff failed, aborting")
        return 1
    except Exception:
        log.exception("precache: unexpected error during kickoff")
        return 1

    pending: dict[str, str] = {addr: jid for addr, jid in results if jid is not None}

    log.info("precache: %d addresses submitted, %d already cached", len(pending), len(ADDRESSES) - len(pending))

    while pending:
        await asyncio.sleep(POLL_INTERVAL_SECONDS)
        for addr in list(pending.keys()):
            job_id = pending[addr]
            try:
                status = await provider.get_report_status(job_id)
            except EagleViewError:
                log.exception("precache: status check failed address=%s", addr)
                return 1

            if status == "complete":
                try:
                    measurement = await provider.fetch_report(job_id)
                except EagleViewError:
                    log.exception("precache: fetch_report failed address=%s", addr)
                    eagleview_cache_dao.update_failed(addr, "fetch_failed")
                    return 1
                eagleview_cache_dao.update_complete(
                    addr,
                    raw=measurement.raw,
                    measurements=measurement.model_dump(),
                )
                log.info("precache: complete address=%s sqft=%.1f", addr, measurement.total_roof_area_sqft)
                del pending[addr]
            elif status == "failed":
                eagleview_cache_dao.update_failed(addr, "upstream_failed")
                log.error("precache: failed upstream address=%s", addr)
                return 1
        log.info("precache: %d still pending", len(pending))

    log.info("precache: ALL %d ADDRESSES COMPLETE", len(ADDRESSES))
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
