from dao import eagleview_cache_dao


def test_get_returns_none_when_missing(isolated_db):
    assert eagleview_cache_dao.get("21106 Kenswick") is None


def test_put_pending_then_get_returns_pending(isolated_db):
    eagleview_cache_dao.put_pending("21106 Kenswick", job_id="job_abc")
    cached = eagleview_cache_dao.get("21106 Kenswick")

    assert cached is not None
    assert cached.status == "pending"
    assert cached.job_id == "job_abc"
    assert cached.measurements is None
    assert cached.completed_at is None


def test_update_complete_flips_status_and_stores_measurements(isolated_db):
    eagleview_cache_dao.put_pending("21106 Kenswick", job_id="job_abc")

    raw = {"upstream": "blob", "rawNumber": 42}
    measurements = {"total_roof_area_sqft": 2400.0, "predominant_pitch": "6:12"}
    eagleview_cache_dao.update_complete("21106 Kenswick", raw=raw, measurements=measurements)

    cached = eagleview_cache_dao.get("21106 Kenswick")
    assert cached is not None
    assert cached.status == "complete"
    assert cached.measurements == measurements
    assert cached.completed_at is not None


def test_update_failed_flips_status(isolated_db):
    eagleview_cache_dao.put_pending("21106 Kenswick", job_id="job_abc")
    eagleview_cache_dao.update_failed("21106 Kenswick", reason="upstream 500")

    cached = eagleview_cache_dao.get("21106 Kenswick")
    assert cached is not None
    assert cached.status == "failed"


def test_address_normalization_collapses_variants_to_same_row(isolated_db):
    # All three of these should hit the same cache row.
    eagleview_cache_dao.put_pending("21106 Kenswick", job_id="job_abc")

    assert eagleview_cache_dao.get("21106 Kenswick") is not None
    assert eagleview_cache_dao.get("  21106 KENSWICK  ") is not None
    assert eagleview_cache_dao.get("21106  Kenswick") is not None

    # And updating via a variant updates the same row.
    eagleview_cache_dao.update_complete(
        "  21106 KENSWICK  ",
        raw={},
        measurements={"x": 1},
    )
    cached = eagleview_cache_dao.get("21106 Kenswick")
    assert cached is not None
    assert cached.status == "complete"
    assert cached.measurements == {"x": 1}


def test_put_pending_replaces_existing_row(isolated_db):
    eagleview_cache_dao.put_pending("21106 Kenswick", job_id="job_old")
    eagleview_cache_dao.put_pending("21106 Kenswick", job_id="job_new")

    cached = eagleview_cache_dao.get("21106 Kenswick")
    assert cached is not None
    assert cached.job_id == "job_new"
    assert cached.status == "pending"
