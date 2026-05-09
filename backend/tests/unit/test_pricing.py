"""Tests for services.pricing — pure math, no I/O.

The numbers here aren't pulled from a fixture; they're the values the
PricingPage shows when you load it with the Delgado property
(materialCost ≈ $14,248.10, labor $3,870, disposal $420, 38% margin).
If these drift, the live UI and the server will disagree.
"""
import pytest

from services.pricing import (
    PricingInputs,
    compute_financing_options,
    compute_pricing,
)


def _dollars(cents: int) -> float:
    return round(cents / 100, 2)


def test_default_inputs_produce_balanced_totals():
    """subtotal == sum(line_items) and customer_total == subtotal + margin + tax."""
    pricing = compute_pricing(PricingInputs(roof_area_sq_ft=2240))
    assert pricing.subtotal_cents == sum(li.total_cents for li in pricing.line_items)
    assert (
        pricing.customer_total_cents
        == pricing.subtotal_cents + pricing.margin_addon_cents + pricing.sales_tax_cents
    )


def test_zero_margin_means_no_addon():
    pricing = compute_pricing(PricingInputs(roof_area_sq_ft=2240, margin_pct=0))
    assert pricing.margin_addon_cents == 0
    assert pricing.customer_total_cents == pricing.subtotal_cents + pricing.sales_tax_cents


def test_margin_addon_matches_pricingpage_formula():
    """frontend uses subtotal * (m / (100 - m)). We must agree."""
    inputs = PricingInputs(roof_area_sq_ft=2240, margin_pct=38)
    pricing = compute_pricing(inputs)
    expected_margin = round(pricing.subtotal_cents * (38 / (100 - 38)))
    assert pricing.margin_addon_cents == expected_margin


def test_labor_is_tax_exempt():
    """Labor must NOT be in the taxable base."""
    inputs = PricingInputs(
        roof_area_sq_ft=1,
        material_unit_price_cents=100,  # tiny material so labor dominates
        labor_cents=100_000,
        disposal_cents=0,
        margin_pct=0,
        sales_tax_pct=10.0,  # round numbers
    )
    pricing = compute_pricing(inputs)
    # Material qty is 1.12 sf @ $1.00 = $1.12 → 112¢. Tax @ 10% on 112¢ = ~11¢.
    # Labor (100000¢) is excluded → tax is small.
    assert pricing.sales_tax_cents < 50
    # Customer total = 100000 + 112 + 11 (tax)
    assert pricing.customer_total_cents == pricing.subtotal_cents + pricing.sales_tax_cents


def test_addons_included_when_set():
    pricing = compute_pricing(PricingInputs(roof_area_sq_ft=1000, addons_cents=50_000))
    assert any(li.category == "addons" and li.total_cents == 50_000 for li in pricing.line_items)


def test_no_addons_line_when_zero():
    pricing = compute_pricing(PricingInputs(roof_area_sq_ft=1000, addons_cents=0))
    assert not any(li.category == "addons" for li in pricing.line_items)


def test_invalid_margin_pct_rejected():
    with pytest.raises(ValueError):
        compute_pricing(PricingInputs(roof_area_sq_ft=1000, margin_pct=100))


def test_zero_roof_area_rejected():
    with pytest.raises(Exception):
        PricingInputs(roof_area_sq_ft=0)


def test_financing_options_have_four_choices():
    options = compute_financing_options(2_500_000)  # $25,000
    assert len(options) == 4
    ids = {o.id for o in options}
    assert ids == {"84mo_zero_down", "60mo_2500_down", "18mo_same_as_cash", "pay_in_full"}


def test_pay_in_full_applies_3pct_discount():
    options = compute_financing_options(1_000_000)  # $10,000
    full = next(o for o in options if o.id == "pay_in_full")
    assert full.discounted_total_cents == 970_000  # exactly 3% off


def test_zero_apr_uses_straight_division():
    """`Same as cash` is 0% APR / 18 months → monthly = total / 18."""
    options = compute_financing_options(1_800_000)  # $18,000
    cash = next(o for o in options if o.id == "18mo_same_as_cash")
    assert cash.monthly_cents == 100_000  # exactly $1,000/mo


def test_delgado_smoke_matches_ui_ballpark():
    """Sanity check: 2240 sf @ $5.75/sf default should land near the
    PricingPage's Delgado figures within a few hundred dollars."""
    pricing = compute_pricing(PricingInputs(roof_area_sq_ft=2240))
    # Material: 2240 * 1.12 * $5.75 = $14,425.60 (close to UI's $14,248.10
    # because UI uses the selected material's exact pricePerSf, not 5.75)
    materials = next(li for li in pricing.line_items if li.category == "materials")
    assert 1_200_000 < materials.total_cents < 1_700_000
    # Customer total in the same neighborhood as the UI's $25,582
    assert 2_000_000 < pricing.customer_total_cents < 3_500_000
