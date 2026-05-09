"""Pricing endpoints for an estimate.

The actual math lives in services.pricing; this router is a thin shell
that pulls the Solar measurement off the in-memory estimate, runs
compute_pricing with optional user overrides, and stores the result
back on the estimate so the proposal/finalize routers can read it.
"""
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from logger import get_logger
from routers.estimate import _estimates
from services.pricing import (
    DEFAULT_DISPOSAL_CENTS,
    DEFAULT_LABOR_CENTS,
    DEFAULT_MARGIN_PCT,
    DEFAULT_SALES_TAX_PCT,
    DEFAULT_WASTE_FACTOR,
    PricingInputs,
    compute_pricing,
)

log = get_logger(__name__)
router = APIRouter(prefix="/api/estimate", tags=["pricing"])


class PricingOverrides(BaseModel):
    """All fields optional. Anything left as None falls back to defaults
    or the previously-stored value."""
    material_name: str | None = None
    material_unit_price_cents: int | None = Field(None, ge=1)
    waste_factor: float | None = Field(None, ge=0, le=1)
    labor_cents: int | None = Field(None, ge=0)
    disposal_cents: int | None = Field(None, ge=0)
    margin_pct: int | None = Field(None, ge=0, lt=100)
    sales_tax_pct: float | None = Field(None, ge=0, le=20)
    addons_cents: int | None = Field(None, ge=0)


def _roof_area_for(estimate_id: str) -> float:
    estimate = _estimates.get(estimate_id)
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    solar = estimate.get("solar")
    if not solar:
        raise HTTPException(
            status_code=409,
            detail="Estimate has no Solar measurement; rerun /api/estimate/start.",
        )
    return float(solar["total_roof_area_sq_ft"])


def _build_inputs(roof_area_sq_ft: float, overrides: PricingOverrides | None, prior: dict | None) -> PricingInputs:
    """Layer overrides onto prior (if any), then onto module defaults."""
    base: dict[str, Any] = {
        "roof_area_sq_ft": roof_area_sq_ft,
        "material_name": "Architectural Shingle",
        "material_unit_price_cents": 575,
        "waste_factor": DEFAULT_WASTE_FACTOR,
        "labor_cents": DEFAULT_LABOR_CENTS,
        "disposal_cents": DEFAULT_DISPOSAL_CENTS,
        "margin_pct": DEFAULT_MARGIN_PCT,
        "sales_tax_pct": DEFAULT_SALES_TAX_PCT,
        "addons_cents": 0,
    }
    if prior:
        for k in base:
            if k in prior and prior[k] is not None:
                base[k] = prior[k]
    if overrides:
        for k, v in overrides.model_dump(exclude_none=True).items():
            base[k] = v
    return PricingInputs(**base)


@router.post("/{estimate_id}/pricing")
def compute_estimate_pricing(estimate_id: str, overrides: PricingOverrides | None = None) -> dict[str, Any]:
    """Compute (or recompute) pricing for an estimate.

    Reads `roof_area_sq_ft` from the Solar measurement on the estimate.
    Overrides are applied on top of any previously-stored pricing inputs
    so the slider on the PricingPage doesn't have to re-send everything.
    """
    log.info("POST /api/estimate/%s/pricing", estimate_id)
    roof_area = _roof_area_for(estimate_id)
    estimate = _estimates[estimate_id]
    prior_inputs = estimate.get("pricing_inputs")
    inputs = _build_inputs(roof_area, overrides, prior_inputs)

    pricing = compute_pricing(inputs)

    estimate["pricing_inputs"] = inputs.model_dump()
    estimate["pricing"] = pricing.model_dump()
    log.info(
        "pricing computed estimate_id=%s roof=%.0fsf subtotal=$%.2f total=$%.2f margin=%d%%",
        estimate_id, roof_area,
        pricing.subtotal_cents / 100, pricing.customer_total_cents / 100, pricing.margin_pct,
    )
    return estimate["pricing"]


@router.get("/{estimate_id}/pricing")
def get_estimate_pricing(estimate_id: str) -> dict[str, Any]:
    log.info("GET /api/estimate/%s/pricing", estimate_id)
    estimate = _estimates.get(estimate_id)
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    pricing = estimate.get("pricing")
    if not pricing:
        raise HTTPException(
            status_code=404,
            detail="No pricing computed yet for this estimate. POST first.",
        )
    return pricing


@router.put("/{estimate_id}/pricing")
def update_estimate_pricing(estimate_id: str, overrides: PricingOverrides) -> dict[str, Any]:
    """Apply overrides + recompute. Same shape as POST; semantically PUT
    means 'replace the prior pricing with this'."""
    log.info("PUT /api/estimate/%s/pricing overrides=%s", estimate_id, overrides.model_dump(exclude_none=True))
    return compute_estimate_pricing(estimate_id, overrides)
