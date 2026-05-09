"""Finalize endpoint — locks an estimate.

Once finalized, pricing/proposal mutations 409 (handled in their routers
by checking `estimate["finalized_at"]`). The FinalizationPage just shows
the timeline + sent confirmation; nothing here actually emails anyone in
the hackathon scope — that's a real-life integration we stub.
"""
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException

from logger import get_logger
from routers.estimate import _estimates

log = get_logger(__name__)
router = APIRouter(prefix="/api/estimate", tags=["finalize"])


@router.post("/{estimate_id}/finalize")
def finalize_estimate(estimate_id: str) -> dict[str, Any]:
    """Lock an estimate. Requires pricing + proposal to exist.

    Returns the full estimate snapshot with `finalized_at` stamped.
    """
    log.info("POST /api/estimate/%s/finalize", estimate_id)
    estimate = _estimates.get(estimate_id)
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    if estimate.get("finalized_at"):
        log.info("estimate_id=%s already finalized at %s", estimate_id, estimate["finalized_at"])
        raise HTTPException(status_code=409, detail="Estimate is already finalized.")
    if not estimate.get("pricing"):
        raise HTTPException(status_code=409, detail="Compute pricing before finalizing.")
    if not estimate.get("proposal"):
        raise HTTPException(status_code=409, detail="Assemble proposal before finalizing.")

    estimate["finalized_at"] = datetime.now(UTC).isoformat()
    estimate["status"] = "sent"
    log.info("estimate_id=%s finalized at=%s", estimate_id, estimate["finalized_at"])
    return estimate
