import math

import pytest
from pydantic import ValidationError

from models import Address, Estimate, LineItem, Measurement, RoofSegment, ViewSet


# ---------- Address ----------


def test_address_round_trips():
    addr = Address(
        raw_input="1600 amphitheatre pkwy",
        formatted_address="1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA",
        lat=37.4220,
        lng=-122.0841,
        place_id="ChIJ2eUgeAK6j4ARbn5u_wAGqWA",
        address_components=[
            {"long_name": "1600", "short_name": "1600", "types": ["street_number"]},
            {"long_name": "Mountain View", "short_name": "Mountain View", "types": ["locality", "political"]},
        ],
    )
    dumped = addr.model_dump()
    rebuilt = Address.model_validate(dumped)
    assert rebuilt == addr
    assert rebuilt.address_components[1]["long_name"] == "Mountain View"


def test_address_is_frozen():
    addr = Address(
        raw_input="x",
        formatted_address="X",
        lat=0.0,
        lng=0.0,
    )
    with pytest.raises(ValidationError):
        addr.lat = 1.0  # type: ignore[misc]


def test_address_components_default_empty():
    addr = Address(raw_input="x", formatted_address="X", lat=0.0, lng=0.0)
    assert addr.address_components == []


# ---------- Measurement.apply_pitch_multiplier ----------


def _base_measurement(**overrides) -> Measurement:
    defaults = dict(
        address="123 Main St",
        total_roof_area_sqft=2000.0,
        predominant_pitch="6:12",
        source="google_solar",
    )
    defaults.update(overrides)
    return Measurement(**defaults)


def test_pitch_multiplier_4_12():
    m = _base_measurement().apply_pitch_multiplier(4, 12)
    assert math.isclose(m.pitch_multiplier_applied, 1.054, abs_tol=0.001)
    assert math.isclose(m.total_roof_area_sqft, 2000.0 * m.pitch_multiplier_applied, abs_tol=0.001)


def test_pitch_multiplier_6_12():
    m = _base_measurement().apply_pitch_multiplier(6, 12)
    assert math.isclose(m.pitch_multiplier_applied, 1.118, abs_tol=0.001)


def test_pitch_multiplier_8_12():
    m = _base_measurement().apply_pitch_multiplier(8, 12)
    assert math.isclose(m.pitch_multiplier_applied, 1.202, abs_tol=0.001)


def test_pitch_multiplier_is_idempotent():
    once = _base_measurement().apply_pitch_multiplier(6, 12)
    twice = once.apply_pitch_multiplier(6, 12)
    # Same object returned, no double-multiplication of area.
    assert twice is once
    assert twice.total_roof_area_sqft == once.total_roof_area_sqft
    assert twice.pitch_multiplier_applied == once.pitch_multiplier_applied


def test_pitch_multiplier_returns_new_instance():
    original = _base_measurement()
    updated = original.apply_pitch_multiplier(6, 12)
    assert updated is not original
    assert original.pitch_multiplier_applied == 1.0  # original untouched
    assert updated.pitch_multiplier_applied != 1.0


# ---------- LineItem validator ----------


def test_lineitem_total_must_match_qty_times_price():
    with pytest.raises(ValidationError):
        LineItem(
            name="Shingles",
            category="materials",
            quantity=10.0,
            unit="bundle",
            unit_price_cents=3500,
            total_cents=99999,  # nowhere near 35000
        )


def test_lineitem_allows_one_cent_rounding_tolerance():
    # quantity * price = 10.5 * 3333 = 34996.5 → rounds to 34997.
    # total of 34996 is 1¢ off → allowed.
    li = LineItem(
        name="Underlayment",
        category="materials",
        quantity=10.5,
        unit="roll",
        unit_price_cents=3333,
        total_cents=34996,
    )
    assert li.total_cents == 34996


# ---------- Estimate validator + JSON round-trip ----------


def _line_items() -> list[LineItem]:
    return [
        LineItem(
            name="Shingles",
            category="materials",
            quantity=20.0,
            unit="bundle",
            unit_price_cents=3500,
            total_cents=70000,
        ),
        LineItem(
            name="Labor",
            category="labor",
            quantity=8.0,
            unit="hr",
            unit_price_cents=7500,
            total_cents=60000,
        ),
    ]


def test_estimate_subtotal_must_match_line_items():
    with pytest.raises(ValidationError):
        Estimate(
            id="est_1",
            property_address="123 Main St",
            measurement=_base_measurement(),
            line_items=_line_items(),
            subtotal_cents=999,  # not 130000
            total_cents=999,
        )


def test_estimate_round_trips_json():
    est = Estimate(
        id="est_1",
        property_address="123 Main St",
        measurement=_base_measurement(),
        line_items=_line_items(),
        subtotal_cents=130000,
        total_cents=145600,
        description="Tear-off + replace, asphalt 30yr",
    )
    payload = est.model_dump_json()
    rebuilt = Estimate.model_validate_json(payload)
    assert rebuilt == est


def test_estimate_allows_no_line_items():
    # Validator only fires when line_items is non-empty.
    est = Estimate(
        id="est_2",
        property_address="123 Main St",
        measurement=_base_measurement(),
        subtotal_cents=0,
        total_cents=0,
    )
    assert est.line_items == []


# ---------- Package imports ----------


def test_public_names_importable_from_package():
    # This file already imports them at module level; reaching this
    # assertion means the package __init__ exposes everything we expect.
    assert {Address, Estimate, LineItem, Measurement, RoofSegment, ViewSet}
