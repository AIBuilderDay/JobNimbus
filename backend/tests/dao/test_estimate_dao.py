from dao import estimate_dao, property_dao
from dao.database import get_connection
from models import Address, Estimate, LineItem, Measurement, RoofSegment


def _seed_property() -> str:
    return property_dao.save(
        Address(
            raw_input="123 Main St",
            formatted_address="123 Main St, Springfield, IL, USA",
            lat=39.7817,
            lng=-89.6501,
        )
    )


def _measurement() -> Measurement:
    return Measurement(
        address="123 Main St",
        total_roof_area_sqft=2400.0,
        predominant_pitch="6:12",
        pitch_multiplier_applied=1.118,
        source="eagleview",
        sources_consulted=["eagleview"],
        segments=[
            RoofSegment(
                pitch_degrees=26.57,
                azimuth_degrees=180.0,
                area_sqft=1200.0,
                pitch_ratio="6:12",
            ),
            RoofSegment(
                pitch_degrees=26.57,
                azimuth_degrees=0.0,
                area_sqft=1200.0,
                pitch_ratio="6:12",
            ),
        ],
        ridge_lf=40.0,
        valley_lf=12.0,
    )


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


def _estimate(id: str = "est_1") -> Estimate:
    return Estimate(
        id=id,
        property_address="123 Main St",
        measurement=_measurement(),
        line_items=_line_items(),
        subtotal_cents=130000,
        total_cents=145600,
        description="Tear-off + replace, asphalt 30yr",
    )


def test_save_then_get_by_id_round_trip(isolated_db):
    pid = _seed_property()
    est = _estimate()
    estimate_dao.save(est, property_id=pid)

    fetched = estimate_dao.get_by_id("est_1")
    assert fetched == est


def test_get_by_id_returns_none_when_missing(isolated_db):
    assert estimate_dao.get_by_id("nope") is None


def test_insert_or_replace_updates_existing(isolated_db):
    pid = _seed_property()
    estimate_dao.save(_estimate(id="est_1"), property_id=pid)

    # Re-save with same id but different description; must not raise.
    updated = _estimate(id="est_1").model_copy(update={"description": "updated"})
    estimate_dao.save(updated, property_id=pid)

    fetched = estimate_dao.get_by_id("est_1")
    assert fetched is not None
    assert fetched.description == "updated"


def test_list_recent_orders_most_recent_first(isolated_db):
    pid = _seed_property()
    estimate_dao.save(_estimate(id="est_old"), property_id=pid)
    estimate_dao.save(_estimate(id="est_new"), property_id=pid)

    # CURRENT_TIMESTAMP has 1-second resolution; force distinct values so
    # the test asserts ordering deterministically.
    with get_connection() as conn:
        conn.execute(
            "UPDATE estimates SET created_at = ? WHERE id = ?",
            ("2026-01-01 00:00:00", "est_old"),
        )
        conn.execute(
            "UPDATE estimates SET created_at = ? WHERE id = ?",
            ("2026-05-01 00:00:00", "est_new"),
        )

    recent = estimate_dao.list_recent(limit=10)
    assert [e.id for e in recent] == ["est_new", "est_old"]


def test_list_recent_respects_limit(isolated_db):
    pid = _seed_property()
    for i in range(5):
        estimate_dao.save(_estimate(id=f"est_{i}"), property_id=pid)

    assert len(estimate_dao.list_recent(limit=3)) == 3
