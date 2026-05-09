"""FastMCP server exposing the JobNimbus pricing/estimate API as MCP tools.

The same tool surface is used three ways:

1. The Anthropic agent (see `agent.runner`) calls these tools in-process via
   the FastMCP `Client` — no HTTP hop, same Python objects.
2. We mount this server at `/mcp` in `main.py` so external MCP clients
   (Claude Desktop, Cursor, etc.) can drive the same flow.
3. Tool schemas are converted to Anthropic tool definitions for the
   `messages.create(tools=...)` call.

Tool design rules:
- Every tool is async (so we can `await` the underlying services).
- Every tool logs entry, parameters, and the size/shape of what it returns.
- On HTTPException from a router, we catch it, log it, and re-raise as a
  ToolError so MCP returns `is_error=true` with the upstream `detail` —
  the frontend SSE stream surfaces that to the user.
"""
from __future__ import annotations

import uuid
from typing import Any, Literal

from fastapi import BackgroundTasks
from fastmcp import FastMCP
from fastmcp.exceptions import ToolError

from logger import get_logger
from routers.estimate import (
    FacetSelection,
    RefineRequest,
    StartEstimateRequest,
    _estimates,
    refine_estimate as _refine_estimate,
    start_estimate as _start_estimate,
)
from routers.finalize import finalize_estimate as _finalize_estimate
from routers.measurement import measure as _measure
from routers.pricing import (
    PricingOverrides,
    compute_estimate_pricing as _compute_estimate_pricing,
    get_estimate_pricing as _get_estimate_pricing,
    update_estimate_pricing as _update_estimate_pricing,
)
from routers.proposal import (
    ProposalRequest,
    assemble_proposal as _assemble_proposal,
    get_proposal as _get_proposal,
)
from routers.listings import list_estimates as _list_estimates
from routers.catalog import list_materials as _list_materials
from routers.places import autocomplete_places as _autocomplete_places

log = get_logger(__name__)

mcp = FastMCP(
    name="JobNimbus Roofing",
    instructions=(
        "Tools for measuring a roof, computing a price estimate, assembling a "
        "proposal, and finalizing a quote. Always start by measuring the roof "
        "(via measure_roof or start_estimate) before computing pricing. "
        "Pricing/proposal/finalize all require an estimate_id from start_estimate."
    ),
)


# ---------------------------------------------------------------------------
# Tiny helper — turn FastAPI HTTPException into MCP ToolError so the agent
# sees a clean tool failure rather than an exception it can't reason about.
# ---------------------------------------------------------------------------
def _wrap_http(exc: Exception, tool: str, **ctx: Any) -> ToolError:
    from fastapi import HTTPException
    if isinstance(exc, HTTPException):
        log.warning("tool=%s http %d: %s ctx=%s", tool, exc.status_code, exc.detail, ctx)
        return ToolError(f"{exc.status_code} {exc.detail}")
    log.exception("tool=%s unexpected error ctx=%s", tool, ctx)
    return ToolError(f"{type(exc).__name__}: {exc}")


# ---------------------------------------------------------------------------
# Address & measurement
# ---------------------------------------------------------------------------
@mcp.tool
async def autocomplete_address(query: str) -> list[dict[str, Any]]:
    """Find candidate US street addresses for a partial query.

    Use when the user gave you a fuzzy or incomplete address (e.g. "Holloway
    Ave Tampa"). Returns up to ~5 suggestions with `place_id`, `main_text`,
    `secondary_text`, and `full_text`. Ask the user to pick one before
    calling `start_estimate` or `measure_roof`.

    Args:
        query: Free-text address fragment (min 3 characters).
    """
    log.info("mcp.autocomplete_address query=%r", query)
    try:
        results = await _autocomplete_places(query)
        out = [r.model_dump() for r in results]
        log.info("mcp.autocomplete_address returned %d candidates", len(out))
        return out
    except Exception as e:  # noqa: BLE001
        raise _wrap_http(e, "autocomplete_address", query=query)


@mcp.tool
async def measure_roof(address: str) -> dict[str, Any]:
    """Measure a roof from an address — geocodes + Google Solar lookup.

    Returns the slanted roof area in square feet, segment count, imagery
    quality, and a satellite thumbnail URL. Use this when the user just
    wants a measurement quote without a full estimate session.

    Use `start_estimate` instead if you plan to compute pricing or assemble
    a proposal — `start_estimate` returns an `estimate_id` you'll need for
    those follow-on tools.

    Args:
        address: Full street address.
    """
    log.info("mcp.measure_roof address=%r", address)
    try:
        result = await _measure(address=address, lat=None, lng=None)
        summary = result.get("summary", {})
        log.info(
            "mcp.measure_roof ok roof=%s sqft segments=%s imagery=%s",
            summary.get("total_roof_area_sq_ft"),
            summary.get("segments"),
            summary.get("imagery_quality"),
        )
        return result
    except Exception as e:  # noqa: BLE001
        raise _wrap_http(e, "measure_roof", address=address)


# ---------------------------------------------------------------------------
# Estimate lifecycle
# ---------------------------------------------------------------------------
@mcp.tool
async def start_estimate(address: str) -> dict[str, Any]:
    """Begin a new estimate session for an address.

    Geocodes the address, runs a Google Solar measurement, and returns
    `{ estimate_id, address, lat, lng, solar, satellite_image_url }`.
    Save the `estimate_id` — every subsequent tool (`compute_pricing`,
    `update_pricing`, `assemble_proposal`, `finalize_estimate`) needs it.

    Skips the 3D model background generation that the regular UI flow
    triggers — the agent doesn't need it and skipping saves the user time.

    Args:
        address: Full street address.
    """
    log.info("mcp.start_estimate address=%r", address)
    try:
        # Pass empty BackgroundTasks so we don't spawn the 3D model pipeline.
        # The router branches on GOOGLE_MAPS_API_KEY anyway; we still want the
        # geocode + Solar work to happen.
        bg = BackgroundTasks()
        req = StartEstimateRequest(address=address)
        result = await _start_estimate(req, bg)
        eid = result.get("estimate_id")
        roof = (result.get("solar") or {}).get("total_roof_area_sq_ft")
        log.info("mcp.start_estimate ok estimate_id=%s roof=%s", eid, roof)
        return result
    except Exception as e:  # noqa: BLE001
        raise _wrap_http(e, "start_estimate", address=address)


@mcp.tool
async def get_estimate(estimate_id: str) -> dict[str, Any]:
    """Read the full estimate snapshot — measurement, pricing (if any),
    proposal (if any), and `finalized_at` (if locked).

    Args:
        estimate_id: ID returned by `start_estimate`.
    """
    log.info("mcp.get_estimate estimate_id=%s", estimate_id)
    estimate = _estimates.get(estimate_id)
    if not estimate:
        log.warning("mcp.get_estimate not found estimate_id=%s", estimate_id)
        raise ToolError(f"404 Estimate {estimate_id} not found")
    return estimate


@mcp.tool
async def refine_estimate(
    estimate_id: str,
    facets: list[dict[str, str]],
) -> dict[str, Any]:
    """Mark roof segments as included/excluded.

    Args:
        estimate_id: ID returned by `start_estimate`.
        facets: List of `{ "facet_id": "...", "state": "included" | "excluded" }`.
    """
    log.info("mcp.refine_estimate estimate_id=%s facets=%d", estimate_id, len(facets))
    try:
        req = RefineRequest(facets=[FacetSelection(**f) for f in facets])
        return _refine_estimate(estimate_id, req)
    except Exception as e:  # noqa: BLE001
        raise _wrap_http(e, "refine_estimate", estimate_id=estimate_id)


# ---------------------------------------------------------------------------
# Pricing
# ---------------------------------------------------------------------------
@mcp.tool
async def compute_pricing(
    estimate_id: str,
    material_name: str | None = None,
    material_unit_price_cents: int | None = None,
    waste_factor: float | None = None,
    labor_cents: int | None = None,
    disposal_cents: int | None = None,
    margin_pct: int | None = None,
    sales_tax_pct: float | None = None,
    addons_cents: int | None = None,
) -> dict[str, Any]:
    """Compute (or recompute) pricing for an estimate.

    All overrides are optional — None falls back to defaults or the prior
    pricing inputs. Money is in **cents** (int). `waste_factor` is 0..1
    (e.g. 0.12 = 12%). `margin_pct` is 0..99. `sales_tax_pct` is 0..20.

    Returns `{ line_items, subtotal_cents, margin_addon_cents,
    sales_tax_cents, customer_total_cents, financing_options, ... }`.

    Args:
        estimate_id: ID returned by `start_estimate`.
        material_name: Roofing material name (e.g. "Architectural Shingle").
        material_unit_price_cents: Per-square-foot unit price in cents.
        waste_factor: Waste %, 0..1 (default 0.12).
        labor_cents: Labor in cents (default 387000 = $3,870).
        disposal_cents: Disposal in cents (default 42000 = $420).
        margin_pct: Margin in whole %, 0..99 (default 38).
        sales_tax_pct: Sales tax %, 0..20 (default 7.5).
        addons_cents: Sum of selected add-ons in cents.
    """
    log.info(
        "mcp.compute_pricing estimate_id=%s material=%s margin=%s waste=%s",
        estimate_id, material_name, margin_pct, waste_factor,
    )
    try:
        overrides = PricingOverrides(
            material_name=material_name,
            material_unit_price_cents=material_unit_price_cents,
            waste_factor=waste_factor,
            labor_cents=labor_cents,
            disposal_cents=disposal_cents,
            margin_pct=margin_pct,
            sales_tax_pct=sales_tax_pct,
            addons_cents=addons_cents,
        )
        return _compute_estimate_pricing(estimate_id, overrides)
    except Exception as e:  # noqa: BLE001
        raise _wrap_http(e, "compute_pricing", estimate_id=estimate_id)


@mcp.tool
async def update_pricing(
    estimate_id: str,
    material_name: str | None = None,
    material_unit_price_cents: int | None = None,
    waste_factor: float | None = None,
    labor_cents: int | None = None,
    disposal_cents: int | None = None,
    margin_pct: int | None = None,
    sales_tax_pct: float | None = None,
    addons_cents: int | None = None,
) -> dict[str, Any]:
    """Apply pricing overrides on top of the prior pricing inputs and recompute.

    Same parameters as `compute_pricing`. Use this when the user wants to
    nudge one knob (e.g. "drop margin to 32%") without re-specifying
    everything else.

    Args:
        estimate_id: ID returned by `start_estimate`.
        material_name: Optional override.
        material_unit_price_cents: Optional override.
        waste_factor: Optional override (0..1).
        labor_cents: Optional override.
        disposal_cents: Optional override.
        margin_pct: Optional override (0..99).
        sales_tax_pct: Optional override (0..20).
        addons_cents: Optional override.
    """
    log.info(
        "mcp.update_pricing estimate_id=%s material=%s margin=%s",
        estimate_id, material_name, margin_pct,
    )
    try:
        overrides = PricingOverrides(
            material_name=material_name,
            material_unit_price_cents=material_unit_price_cents,
            waste_factor=waste_factor,
            labor_cents=labor_cents,
            disposal_cents=disposal_cents,
            margin_pct=margin_pct,
            sales_tax_pct=sales_tax_pct,
            addons_cents=addons_cents,
        )
        return _update_estimate_pricing(estimate_id, overrides)
    except Exception as e:  # noqa: BLE001
        raise _wrap_http(e, "update_pricing", estimate_id=estimate_id)


@mcp.tool
async def get_pricing(estimate_id: str) -> dict[str, Any]:
    """Read the most recently computed pricing for an estimate.

    Args:
        estimate_id: ID returned by `start_estimate`.
    """
    log.info("mcp.get_pricing estimate_id=%s", estimate_id)
    try:
        return _get_estimate_pricing(estimate_id)
    except Exception as e:  # noqa: BLE001
        raise _wrap_http(e, "get_pricing", estimate_id=estimate_id)


# ---------------------------------------------------------------------------
# Proposal & finalize
# ---------------------------------------------------------------------------
@mcp.tool
async def assemble_proposal(
    estimate_id: str,
    cover_note: str | None = None,
    recipient_email: str | None = None,
    cc_email: str | None = None,
    tone: Literal["formal", "conversational", "direct", "warm"] = "conversational",
    show_financing: bool = True,
    embed_e_signature: bool = True,
    attach_drone_photos: bool = False,
    include_warranty_pdf: bool = True,
    contractor_name: str | None = None,
    contractor_license: str | None = None,
) -> dict[str, Any]:
    """Assemble the proposal payload for an estimate.

    Pricing must have been computed first (`compute_pricing`). Returns a
    structured proposal — the frontend renders the PDF client-side.

    Args:
        estimate_id: ID returned by `start_estimate`.
        cover_note: Cover-letter body. If None, a sensible default is generated.
        recipient_email: Customer email.
        cc_email: CC email.
        tone: Tone preset for the cover note.
        show_financing: Show financing options block.
        embed_e_signature: Embed an e-signature widget.
        attach_drone_photos: Attach drone photos to the PDF.
        include_warranty_pdf: Include the warranty PDF.
        contractor_name: Override default contractor name.
        contractor_license: Override default contractor license.
    """
    log.info("mcp.assemble_proposal estimate_id=%s tone=%s", estimate_id, tone)
    try:
        kwargs: dict[str, Any] = {
            "cover_note": cover_note,
            "recipient_email": recipient_email,
            "cc_email": cc_email,
            "tone": tone,
            "show_financing": show_financing,
            "embed_e_signature": embed_e_signature,
            "attach_drone_photos": attach_drone_photos,
            "include_warranty_pdf": include_warranty_pdf,
        }
        if contractor_name is not None:
            kwargs["contractor_name"] = contractor_name
        if contractor_license is not None:
            kwargs["contractor_license"] = contractor_license
        req = ProposalRequest(**kwargs)
        return _assemble_proposal(estimate_id, req)
    except Exception as e:  # noqa: BLE001
        raise _wrap_http(e, "assemble_proposal", estimate_id=estimate_id)


@mcp.tool
async def get_proposal(estimate_id: str) -> dict[str, Any]:
    """Read the assembled proposal for an estimate.

    Args:
        estimate_id: ID returned by `start_estimate`.
    """
    log.info("mcp.get_proposal estimate_id=%s", estimate_id)
    try:
        return _get_proposal(estimate_id)
    except Exception as e:  # noqa: BLE001
        raise _wrap_http(e, "get_proposal", estimate_id=estimate_id)


@mcp.tool
async def finalize_estimate(estimate_id: str) -> dict[str, Any]:
    """Lock an estimate. Requires pricing + proposal.

    Returns the full estimate snapshot stamped with `finalized_at`.

    Args:
        estimate_id: ID returned by `start_estimate`.
    """
    log.info("mcp.finalize_estimate estimate_id=%s", estimate_id)
    try:
        return _finalize_estimate(estimate_id)
    except Exception as e:  # noqa: BLE001
        raise _wrap_http(e, "finalize_estimate", estimate_id=estimate_id)


# ---------------------------------------------------------------------------
# Catalog & listings
# ---------------------------------------------------------------------------
@mcp.tool
async def list_materials(tab: str | None = None) -> dict[str, Any]:
    """List available roofing materials grouped by tab (Shingle / Metal / Membrane).

    Use this when the user asks "what options do I have?" or "what's the
    cheapest metal?". Each entry has `id`, `name`, `sub`, `price`,
    `pricePerSf`, and a `swatch` color.

    Args:
        tab: Filter to a specific tab name. None returns all tabs grouped.
    """
    log.info("mcp.list_materials tab=%s", tab)
    try:
        return _list_materials(tab)
    except Exception as e:  # noqa: BLE001
        raise _wrap_http(e, "list_materials", tab=tab)


@mcp.tool
async def list_estimates(status: str = "all") -> dict[str, Any]:
    """List existing estimates the contractor has saved.

    Args:
        status: Filter — "all", "draft", "sent", "accepted", "declined".
    """
    log.info("mcp.list_estimates status=%s", status)
    try:
        return _list_estimates(status)
    except Exception as e:  # noqa: BLE001
        raise _wrap_http(e, "list_estimates", status=status)
