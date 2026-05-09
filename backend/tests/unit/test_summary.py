"""Tests for services.summary — pure markdown formatting, no I/O.

We exercise three states: a fully-populated estimate (all sections
present), a partial estimate (measurement only, no pricing), and the
add-on math at a known sqft.
"""
from services.pricing import PricingInputs, compute_pricing
from services.summary import (
    FLAT_ADDONS,
    STANDARD_ADDONS,
    _parse_address,
    build_markdown_summary,
)


def _full_estimate() -> dict:
    """An estimate dict shaped like routers.estimate._estimates[id]."""
    inputs = PricingInputs(
        roof_area_sq_ft=3034,
        material_name="Designer Shingle",
        material_unit_price_cents=240,
    )
    pricing = compute_pricing(inputs)
    return {
        "estimate_id": "abc-123",
        "address": "127 NW 13th Pl, Cape Coral, FL 33991, USA",
        "lat": 26.6406,
        "lng": -82.0431,
        "satellite_image_url": "https://example.com/sat.png",
        "solar": {
            "total_roof_area_sq_ft": 3034,
            "imagery_quality": "HIGH",
            "segments": [
                {"id": "s1", "pitch_degrees": 23.5, "azimuth_degrees": 178.2, "area_sq_ft": 412.0},
                {"id": "s2", "pitch_degrees": 18.0, "azimuth_degrees": 90.0, "area_sq_ft": 380.5},
            ],
        },
        "pricing_inputs": inputs.model_dump(),
        "pricing": pricing.model_dump(),
    }


def test_full_summary_contains_all_sections():
    md = build_markdown_summary(_full_estimate())

    # Header + property
    assert "# Quote summary — 127 NW 13th Pl" in md
    assert "**Estimate ID:** `abc-123`" in md
    assert "## Property" in md
    assert "**City:** Cape Coral" in md
    assert "**State:** FL" in md
    assert "**ZIP:** 33991" in md

    # Roof
    assert "## Roof measurement" in md
    assert "3,034 sq ft" in md
    assert "**Segments:** 2" in md
    assert "| 1 | 23.5 | 178.2 | 412 |" in md

    # Material
    assert "Designer Shingle" in md
    assert "$2.40 / sq ft" in md

    # Line items table — present, and the bundled "Add-ons" lump should be skipped
    assert "## Line items" in md
    assert "Labor" in md
    assert "Disposal & permits" in md

    # Itemized add-ons (ballpark)
    assert "## Estimated add-ons (ballpark)" in md
    assert "Drip edge" in md
    assert "Ice & water shield" in md
    assert "Ridge vent" in md
    assert "Pipe boots & flashing" in md
    assert "Ballpark from sqft" in md

    # Pricing breakdown
    assert "## Pricing breakdown" in md
    assert "**Customer total:**" in md

    # Financing
    assert "## Financing options" in md
    assert "$0 down · 84 mo" in md
    assert "9.99% APR" in md
    assert "Pay in full" in md  # discount option


def test_partial_estimate_marks_missing_pricing():
    """Solar present but no pricing yet — render what we have, mark the gap."""
    estimate = {
        "estimate_id": "abc-123",
        "address": "1 Main St, Tampa, FL 33602, USA",
        "lat": 27.95,
        "lng": -82.46,
        "solar": {
            "total_roof_area_sq_ft": 1000,
            "imagery_quality": "HIGH",
            "segments": [],
        },
    }
    md = build_markdown_summary(estimate)
    assert "Pricing not yet computed" in md
    assert "## Roof measurement" in md
    assert "1,000 sq ft" in md
    # Add-ons still render because we have sqft to base them on
    assert "Drip edge" in md
    # No financing section
    assert "## Financing options" not in md


def test_addon_math_at_1000_sqft():
    """At 1,000 sqft drip edge should be $150 (1000 × 15¢) and the full
    standard set + flat boots should sum to a known total."""
    md = build_markdown_summary({
        "estimate_id": "x",
        "address": "1 Main St, Tampa, FL 33602",
        "solar": {"total_roof_area_sq_ft": 1000, "segments": []},
    })
    # Drip edge row at 1000 sqft × 15¢ = $150.00
    assert "$150.00" in md

    # Total of (1000 × (15+40+30+20+15)) + 12_000 flat = 120_000 + 12_000 = $1,320.00
    expected_cents = sum(c for _, _, c in STANDARD_ADDONS) * 1000 + sum(c for _, _, c in FLAT_ADDONS)
    assert expected_cents == 132_000
    assert "**$1,320.00**" in md


def test_parse_address_handles_usa_suffix_and_state_zip():
    parsed = _parse_address("127 NW 13th Pl, Cape Coral, FL 33991, USA")
    assert parsed == {
        "street": "127 NW 13th Pl",
        "city": "Cape Coral",
        "state": "FL",
        "zip": "33991",
    }


def test_parse_address_short_form():
    parsed = _parse_address("Tampa, FL")
    assert parsed["state"] == "FL"
    assert parsed["zip"] is None


def test_empty_estimate_does_not_crash():
    md = build_markdown_summary({})
    assert "# Quote summary — Estimate" in md
    assert "Not yet measured" in md
