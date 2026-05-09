"""Pitch multiplier math + idempotency.

This is one of the qualification-protecting tests: if these go red, our
submitted sqft is wrong on every pitched roof.
"""
import pytest

from models.measurement import Measurement


def _stub(area: float = 1000.0) -> Measurement:
    return Measurement(
        address="x",
        total_roof_area_sqft=area,
        predominant_pitch="6:12",
        source="google_solar",
    )


@pytest.mark.parametrize("rise,run,expected", [
    (4, 12, 1.054),
    (6, 12, 1.118),
    (8, 12, 1.202),
])
def test_multiplier_math(rise, run, expected):
    m = _stub().apply_pitch_multiplier(rise, run)
    assert abs(m.pitch_multiplier_applied - expected) < 0.001
    assert abs(m.total_roof_area_sqft - 1000 * expected) < 1.0


def test_idempotent():
    m1 = _stub().apply_pitch_multiplier(6, 12)
    m2 = m1.apply_pitch_multiplier(6, 12)
    assert m1 == m2
