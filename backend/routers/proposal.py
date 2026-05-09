"""Proposal endpoints.

Returns a structured JSON proposal payload; the ProposalPage renders the
PDF client-side. Server-side PDF generation is intentionally out of scope
(see backend/docs/handoff-pending-endpoints.md).
"""
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from logger import get_logger
from routers.estimate import _estimates

log = get_logger(__name__)
router = APIRouter(prefix="/api/estimate", tags=["proposal"])

PROPOSAL_VALID_DAYS = 30


class ProposalRequest(BaseModel):
    """Optional inputs from the ProposalPage compose card. Anything left
    None gets a sensible default."""
    cover_note: str | None = None
    recipient_email: str | None = None
    cc_email: str | None = None
    tone: Literal["formal", "conversational", "direct", "warm"] = "conversational"
    show_financing: bool = True
    embed_e_signature: bool = True
    attach_drone_photos: bool = False
    include_warranty_pdf: bool = True
    contractor_name: str = "Holloway Roofing Co."
    contractor_license: str = "License #CCC1331234"


def _default_cover_note(address: str, total_cents: int) -> str:
    return (
        f"Hi,\n\n"
        f"Thank you for choosing us for your roofing project at {address}. "
        f"Attached is your detailed proposal totaling ${total_cents / 100:,.0f}. "
        f"Pricing is locked for {PROPOSAL_VALID_DAYS} days.\n\n"
        "Let me know if you have any questions.\n"
    )


@router.post("/{estimate_id}/proposal")
def assemble_proposal(estimate_id: str, req: ProposalRequest | None = None) -> dict[str, Any]:
    """Assemble the proposal payload. Requires pricing to have been
    computed first (POST /api/estimate/{id}/pricing)."""
    log.info("POST /api/estimate/%s/proposal", estimate_id)
    estimate = _estimates.get(estimate_id)
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    pricing = estimate.get("pricing")
    if not pricing:
        raise HTTPException(
            status_code=409,
            detail="No pricing on estimate; POST /api/estimate/{id}/pricing first.",
        )

    req = req or ProposalRequest()
    address = estimate.get("address", "")
    solar = estimate.get("solar") or {}
    total_cents = pricing["customer_total_cents"]

    cover_note = req.cover_note or _default_cover_note(address, total_cents)
    issued_at = datetime.now(UTC)
    valid_through = issued_at + timedelta(days=PROPOSAL_VALID_DAYS)

    proposal = {
        "estimate_id": estimate_id,
        "issued_at": issued_at.isoformat(),
        "valid_through": valid_through.isoformat(),
        "valid_for_days": PROPOSAL_VALID_DAYS,
        "contractor": {
            "name": req.contractor_name,
            "license": req.contractor_license,
        },
        "property": {
            "address": address,
            "location": {"lat": estimate.get("lat"), "lng": estimate.get("lng")},
            "satellite_image_url": estimate.get("satellite_image_url"),
        },
        "measurement": {
            "total_roof_area_sq_ft": solar.get("total_roof_area_sq_ft"),
            "imagery_quality": solar.get("imagery_quality"),
            "segments": len(solar.get("segments", [])),
        },
        "pricing": pricing,
        "cover_note": cover_note,
        "recipient_email": req.recipient_email,
        "cc_email": req.cc_email,
        "tone": req.tone,
        "options": {
            "show_financing": req.show_financing,
            "embed_e_signature": req.embed_e_signature,
            "attach_drone_photos": req.attach_drone_photos,
            "include_warranty_pdf": req.include_warranty_pdf,
        },
    }

    estimate["proposal"] = proposal
    log.info(
        "proposal assembled estimate_id=%s total=$%.2f valid_through=%s",
        estimate_id, total_cents / 100, valid_through.date(),
    )
    return proposal


@router.get("/{estimate_id}/proposal")
def get_proposal(estimate_id: str) -> dict[str, Any]:
    log.info("GET /api/estimate/%s/proposal", estimate_id)
    estimate = _estimates.get(estimate_id)
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    proposal = estimate.get("proposal")
    if not proposal:
        raise HTTPException(
            status_code=404,
            detail="No proposal assembled yet. POST first.",
        )
    return proposal
