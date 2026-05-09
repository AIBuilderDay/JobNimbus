"""Markdown summary builder for an estimate.

Pure function: takes the in-memory estimate dict (from
`routers.estimate._estimates`) and returns a markdown blob suitable for
the MCP agent to drop straight into chat.

Add-on itemization is a sqft-based ballpark — `services/pricing.py` only
stores a single `addons_cents` lump, so per-line add-ons (drip edge,
ice & water shield, etc.) are computed here from the slanted roof area.
These are illustrative mid-market figures, not tied to the catalog.
"""
from __future__ import annotations

import re
from typing import Any

# (name, detail, cents per slanted sq ft)
STANDARD_ADDONS: list[tuple[str, str, int]] = [
    ("Drip edge",              "Aluminum, painted to match",         15),
    ("Ice & water shield",     "Eaves + valleys",                    40),
    ("Synthetic underlayment", "Full-coverage, tear-resistant",      30),
    ("Ridge vent",             "Continuous ridge ventilation",       20),
    ("Starter strip",          "Eaves + rakes",                      15),
]
# (name, detail, flat cents)
FLAT_ADDONS: list[tuple[str, str, int]] = [
    ("Pipe boots & flashing",  "Galvanized step flashing + 4 boots", 12_000),
]


def _usd(cents: int | float | None) -> str:
    if cents is None:
        return "—"
    return f"${cents / 100:,.2f}"


def _parse_address(formatted: str | None) -> dict[str, str | None]:
    """Best-effort split of a Google formatted_address into components.

    Falls back gracefully — missing pieces come back as None so the
    caller can omit them. Not exhaustive (no county, no apartment), good
    enough for the agent to reference city/state/zip.
    """
    out: dict[str, str | None] = {"street": None, "city": None, "state": None, "zip": None}
    if not formatted:
        return out
    parts = [p.strip() for p in formatted.split(",") if p.strip()]
    if parts and parts[-1].upper() in {"USA", "UNITED STATES"}:
        parts = parts[:-1]
    if not parts:
        return out
    out["street"] = parts[0]
    if len(parts) >= 2:
        out["city"] = parts[-2] if len(parts) >= 3 else None
    m = re.match(r"^\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?\s*$", parts[-1])
    if m:
        out["state"] = m.group(1)
        out["zip"] = m.group(2)
    return out


def _fmt(val: Any, spec: str = "") -> str:
    if isinstance(val, (int, float)):
        return format(val, spec)
    return "—"


def _segment_table(segments: list[dict[str, Any]]) -> str:
    if not segments:
        return ""
    rows = ["| # | Pitch (°) | Azimuth (°) | Area (sq ft) |",
            "|---|-----------|-------------|--------------|"]
    for i, s in enumerate(segments, 1):
        pitch = _fmt(s.get("pitch_degrees"), ".1f")
        az = _fmt(s.get("azimuth_degrees"), ".1f")
        area = _fmt(s.get("area_sq_ft"), ",.0f")
        rows.append(f"| {i} | {pitch} | {az} | {area} |")
    return "\n".join(rows)


def _line_items_table(line_items: list[dict[str, Any]]) -> str:
    """Render pricing.line_items as a markdown table, skipping the
    bundled 'Add-ons' lump (its breakdown lives in the next section)."""
    rows = ["| Item | Detail | Qty | Unit | Unit $ | Total |",
            "|------|--------|-----|------|--------|-------|"]
    any_rendered = False
    for li in line_items:
        if li.get("category") == "addons":
            continue
        qty = li.get("quantity", 0)
        qty_str = f"{qty:,.2f}" if isinstance(qty, float) and qty != int(qty) else f"{qty:,.0f}"
        rows.append(
            f"| {li.get('name', '—')} "
            f"| {li.get('detail', '')} "
            f"| {qty_str} "
            f"| {li.get('unit', '')} "
            f"| {_usd(li.get('unit_price_cents'))} "
            f"| {_usd(li.get('total_cents'))} |"
        )
        any_rendered = True
    return "\n".join(rows) if any_rendered else ""


def _addon_table(roof_area_sq_ft: float) -> tuple[str, int]:
    """Render the ballpark add-on table. Returns (markdown, total_cents)."""
    rows = ["| Item | Detail | Qty | Unit $ | Total |",
            "|------|--------|-----|--------|-------|"]
    total_cents = 0
    sqft_str = f"{roof_area_sq_ft:,.0f} sqft"
    for name, detail, cpsf in STANDARD_ADDONS:
        line_total = round(roof_area_sq_ft * cpsf)
        total_cents += line_total
        rows.append(
            f"| {name} | {detail} | {sqft_str} | {_usd(cpsf)} | {_usd(line_total)} |"
        )
    for name, detail, flat in FLAT_ADDONS:
        total_cents += flat
        rows.append(
            f"| {name} | {detail} | 1 job | {_usd(flat)} | {_usd(flat)} |"
        )
    rows.append(f"| **Total** | | | | **{_usd(total_cents)}** |")
    return "\n".join(rows), total_cents


def _financing_list(options: list[dict[str, Any]]) -> str:
    if not options:
        return ""
    lines = []
    for opt in options:
        title = opt.get("title", "")
        apr = opt.get("apr_pct", 0)
        monthly = opt.get("monthly_cents", 0)
        discounted = opt.get("discounted_total_cents")
        if discounted is not None:
            lines.append(f"- **{title}** · Pay {_usd(discounted)} today")
        else:
            lines.append(f"- **{title}** · {apr:g}% APR · {_usd(monthly)}/mo")
    return "\n".join(lines)


def build_markdown_summary(estimate: dict[str, Any]) -> str:
    """Build a markdown summary for an estimate dict.

    Sections are emitted only when their data is present so partially-
    populated estimates still produce a useful response. Missing
    sections get an explicit marker so the agent can self-correct.
    """
    parts: list[str] = []

    address = estimate.get("address")
    estimate_id = estimate.get("estimate_id")
    lat = estimate.get("lat")
    lng = estimate.get("lng")
    solar = estimate.get("solar") or {}
    pricing = estimate.get("pricing") or {}
    pricing_inputs = estimate.get("pricing_inputs") or {}

    # Header
    title_addr = address or "Estimate"
    parts.append(f"# Quote summary — {title_addr}")
    header_meta = []
    if estimate_id:
        header_meta.append(f"**Estimate ID:** `{estimate_id}`")
    if isinstance(lat, (int, float)) and isinstance(lng, (int, float)):
        header_meta.append(f"**Coordinates:** {lat:.5f}, {lng:.5f}")
    iq = solar.get("imagery_quality")
    if iq:
        header_meta.append(f"**Imagery quality:** {iq}")
    if header_meta:
        parts.append("\n".join(header_meta))

    # Property
    comps = _parse_address(address)
    prop_lines = ["## Property"]
    if address:
        prop_lines.append(f"- **Address:** {address}")
    if comps.get("city"):
        prop_lines.append(f"- **City:** {comps['city']}")
    if comps.get("state"):
        prop_lines.append(f"- **State:** {comps['state']}")
    if comps.get("zip"):
        prop_lines.append(f"- **ZIP:** {comps['zip']}")
    if isinstance(lat, (int, float)) and isinstance(lng, (int, float)):
        prop_lines.append(f"- **Lat / Lng:** {lat:.5f}, {lng:.5f}")
    sat = estimate.get("satellite_image_url")
    if sat:
        prop_lines.append(f"- **Satellite imagery:** {sat}")
    if len(prop_lines) > 1:
        parts.append("\n".join(prop_lines))

    # Roof measurement
    total_sqft = solar.get("total_roof_area_sq_ft")
    segments = solar.get("segments") or []
    if total_sqft:
        roof_lines = ["## Roof measurement",
                      f"- **Total slanted area:** {total_sqft:,.0f} sq ft",
                      f"- **Segments:** {len(segments)}"]
        if iq:
            roof_lines.append(f"- **Imagery quality:** {iq}")
        parts.append("\n".join(roof_lines))
        seg_table = _segment_table(segments)
        if seg_table:
            parts.append(seg_table)
    else:
        parts.append("## Roof measurement\n_Not yet measured — call `start_estimate` first._")

    # Selected material
    if pricing_inputs.get("material_name"):
        mat_name = pricing_inputs["material_name"]
        mat_price = pricing_inputs.get("material_unit_price_cents")
        line = f"## Selected material\n- **{mat_name}**"
        if mat_price:
            line += f" · {_usd(mat_price)} / sq ft"
        parts.append(line)

    # Line items + pricing breakdown + financing
    line_items = pricing.get("line_items") or []
    if line_items:
        li_table = _line_items_table(line_items)
        if li_table:
            parts.append("## Line items\n" + li_table)
    else:
        parts.append("## Pricing\n_Pricing not yet computed — call `compute_pricing` first._")

    # Add-ons (only if we have sqft to base them on)
    if total_sqft:
        addon_table, addon_total = _addon_table(float(total_sqft))
        parts.append(
            "## Estimated add-ons (ballpark)\n"
            + addon_table
            + "\n\n_Ballpark from sqft — adjust for actual job specs._"
        )

    # Pricing breakdown
    if pricing:
        breakdown = ["## Pricing breakdown"]
        breakdown.append(f"- **Subtotal:** {_usd(pricing.get('subtotal_cents'))}")
        margin_pct = pricing.get("margin_pct")
        margin_addon = pricing.get("margin_addon_cents")
        if margin_pct is not None:
            breakdown.append(
                f"- **Margin ({margin_pct}%):** +{_usd(margin_addon)}"
            )
        tax_pct = pricing.get("sales_tax_pct")
        tax_cents = pricing.get("sales_tax_cents")
        if tax_pct is not None:
            breakdown.append(
                f"- **Sales tax ({tax_pct:g}%, labor exempt):** {_usd(tax_cents)}"
            )
        breakdown.append(
            f"- **Customer total:** **{_usd(pricing.get('customer_total_cents'))}**"
        )
        parts.append("\n".join(breakdown))

        financing = pricing.get("financing_options") or []
        fin_md = _financing_list(financing)
        if fin_md:
            parts.append("## Financing options\n" + fin_md)

    # Finalized marker
    if estimate.get("finalized_at"):
        parts.append(f"_Finalized at {estimate['finalized_at']}._")

    return "\n\n".join(parts) + "\n"
