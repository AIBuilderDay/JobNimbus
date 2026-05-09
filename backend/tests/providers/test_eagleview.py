import httpx
import pytest
import respx

from dao import eagleview_cache_dao
from models.measurement import Measurement
from providers.eagleview import (
    CacheMissError,
    EagleViewError,
    EagleViewProvider,
    _build_submit_payload,
    _map_status,
    _parse_address,
    _to_float,
    _translate_eagleview_response,
)


# Field names + shape derived from the official Measurement Orders v1 docs
# (developer.eagleview.com /api-documentation). Run
# `task backend:eagleview-dump` once we have a real completed sandbox order
# to swap in the live response and confirm every field above is present
# with the expected type — strings vs numbers in particular.
SAMPLE_REPORT_PAYLOAD = {
    "ReportId": 9001,
    "Status": "Completed",
    "DisplayStatus": "Completed",
    "StatusId": 4,
    "Street": "21106 Kenswick Meadows Ct",
    "City": "Humble",
    "State": "TX",
    "Zip": "77338",
    "TotalMeasurements": {
        "Area": "2443",
        "AreaValue": 2443.0,
        "PrimaryPitch": "6:12",
        "PitchValue": 6.0,
        "LengthRidge": "26",
        "LengthValley": "38",
        "LengthEave": "164",
        "LengthRake": "83",
        "LengthHip": "101",
        "LengthFlashing": "25",
        "LengthStepFlashing": "21",
    },
}


# Real token endpoint — production host even when API calls go to sandbox.
_TOKEN_URL = "https://apicenter.eagleview.com/oauth2/v1/token"
_TOKEN_RESPONSE = {
    "access_token": "eyJ-test-token",
    "expires_in": 86400,
    "refresh_token": "rt-test",
    "token_type": "Bearer",
}


def _set_live_creds(monkeypatch):
    from settings import settings
    monkeypatch.setattr(settings, "EAGLEVIEW_CLIENT_ID", "ci-test")
    monkeypatch.setattr(settings, "EAGLEVIEW_CLIENT_SECRET", "cs-test")
    monkeypatch.setattr(settings, "EAGLEVIEW_BASE_URL", "https://api.eagleview.test")


# ---------- mock-mode (no httpx) ----------


def test_mock_mode_auto_engages_when_creds_missing(monkeypatch):
    from settings import settings
    monkeypatch.setattr(settings, "EAGLEVIEW_CLIENT_ID", "")
    monkeypatch.setattr(settings, "EAGLEVIEW_CLIENT_SECRET", "")
    p = EagleViewProvider()
    assert p.mock_mode is True


def test_mock_mode_auto_engages_when_only_one_cred_present(monkeypatch):
    """Both client_id and client_secret are required — having just one
    isn't enough to mint a token, so we fall back to mock mode."""
    from settings import settings
    monkeypatch.setattr(settings, "EAGLEVIEW_CLIENT_ID", "ci-only")
    monkeypatch.setattr(settings, "EAGLEVIEW_CLIENT_SECRET", "")
    p = EagleViewProvider()
    assert p.mock_mode is True


def test_mock_mode_explicit_overrides_creds(monkeypatch):
    from settings import settings
    monkeypatch.setattr(settings, "EAGLEVIEW_CLIENT_ID", "ci-real")
    monkeypatch.setattr(settings, "EAGLEVIEW_CLIENT_SECRET", "cs-real")
    p = EagleViewProvider(mock_mode=True)
    assert p.mock_mode is True


@pytest.mark.asyncio
async def test_mock_mode_end_to_end_no_http(isolated_db):
    """Full submission → status → fetch path in mock mode hits no httpx."""
    p = EagleViewProvider(mock_mode=True)
    addr = "21106 Kenswick Meadows Ct, Humble, TX 77338"

    job_id = await p.request_report(addr)
    assert job_id.startswith("mock-")

    status = await p.get_report_status(job_id)
    assert status == "complete"

    m = await p.fetch_report(job_id)
    assert isinstance(m, Measurement)
    assert m.source == "eagleview"
    m2 = await p.fetch_report(job_id)
    assert m.total_roof_area_sqft == m2.total_roof_area_sqft


# ---------- cache-aware behavior ----------


@pytest.mark.asyncio
async def test_get_measurements_cache_hit(isolated_db):
    addr = "21106 Kenswick Meadows Ct, Humble, TX 77338"
    cached_measurement = {
        "address": addr,
        "total_roof_area_sqft": 2443.0,
        "predominant_pitch": "6:12",
        "pitch_multiplier_applied": 1.0,
        "source": "eagleview",
        "sources_consulted": ["eagleview"],
        "segments": [],
        "ridge_lf": 26.0,
        "hip_lf": 101.0,
        "valley_lf": 38.0,
        "rake_lf": 83.0,
        "eave_lf": 164.0,
        "flashing_lf": 25.0,
        "step_flashing_lf": 21.0,
        "raw": {},
    }
    eagleview_cache_dao.put_pending(addr, "job_seed")
    eagleview_cache_dao.update_complete(addr, raw={}, measurements=cached_measurement)

    p = EagleViewProvider(mock_mode=True)
    m = await p.get_measurements(addr)
    assert m.total_roof_area_sqft == 2443.0
    assert m.predominant_pitch == "6:12"
    assert m.source == "eagleview"


@pytest.mark.asyncio
async def test_get_measurements_cache_miss_records_pending_and_raises(isolated_db):
    addr = "3820 E Rosebrier St, Springfield, MO 65809"
    p = EagleViewProvider(mock_mode=True)

    with pytest.raises(CacheMissError):
        await p.get_measurements(addr)

    cached = eagleview_cache_dao.get(addr)
    assert cached is not None
    assert cached.status == "pending"
    assert cached.job_id is not None


@pytest.mark.asyncio
async def test_request_report_idempotent_on_address(isolated_db):
    addr = "5914 Copper Lilly Lane, Spring, TX 77389"
    p = EagleViewProvider(mock_mode=True)

    job1 = await p.request_report(addr)
    job2 = await p.request_report(addr)
    assert job1 == job2

    cached = eagleview_cache_dao.get(addr)
    assert cached is not None
    assert cached.job_id == job1


# ---------- live API path (mocked with respx) ----------


@pytest.mark.asyncio
async def test_live_request_report_happy_path(isolated_db, monkeypatch):
    _set_live_creds(monkeypatch)

    p = EagleViewProvider()
    assert p.mock_mode is False
    addr = "122 NW 13th Ave, Cape Coral, FL 33993"

    async with respx.mock:
        token = respx.post(_TOKEN_URL).mock(
            return_value=httpx.Response(200, json=_TOKEN_RESPONSE)
        )
        submit = respx.post("https://api.eagleview.test/v2/Order/PlaceOrder").mock(
            return_value=httpx.Response(200, json={"OrderId": 12345, "ReportIds": [9876]})
        )
        job_id = await p.request_report(addr)

    # We track the first ReportId, which is the actual measurement report.
    assert job_id == "9876"
    assert token.called
    assert submit.called
    assert submit.calls[0].request.headers["authorization"] == "Bearer eyJ-test-token"
    cached = eagleview_cache_dao.get(addr)
    assert cached is not None
    assert cached.status == "pending"
    assert cached.job_id == "9876"


@pytest.mark.asyncio
async def test_live_request_report_sends_structured_address(isolated_db, monkeypatch):
    """PlaceOrder body must use parsed address parts, not a single string —
    EagleView's API requires Street/City/State/Zip separately."""
    _set_live_creds(monkeypatch)

    p = EagleViewProvider()

    async with respx.mock:
        respx.post(_TOKEN_URL).mock(
            return_value=httpx.Response(200, json=_TOKEN_RESPONSE)
        )
        submit = respx.post("https://api.eagleview.test/v2/Order/PlaceOrder").mock(
            return_value=httpx.Response(200, json={"OrderId": 1, "ReportIds": [42]})
        )
        await p.request_report("21106 Kenswick Meadows Ct, Humble, TX 77338")

    body = submit.calls[0].request.read().decode()
    import json as _json
    parsed = _json.loads(body)
    addr_obj = parsed["OrderReports"]["ReportAddresses"]
    assert addr_obj["Address"] == "21106 Kenswick Meadows Ct"
    assert addr_obj["City"] == "Humble"
    assert addr_obj["State"] == "TX"
    assert addr_obj["Zip"] == "77338"
    assert addr_obj["Country"] == "USA"
    # Premium - Residential is product 31.
    assert parsed["OrderReports"]["PrimaryProductId"] == 31


@pytest.mark.asyncio
async def test_live_request_report_500_raises_no_pending_row(isolated_db, monkeypatch):
    _set_live_creds(monkeypatch)

    p = EagleViewProvider()
    addr = "835 S Cobble Creek, Nixa, MO 65714"

    async with respx.mock:
        respx.post(_TOKEN_URL).mock(
            return_value=httpx.Response(200, json=_TOKEN_RESPONSE)
        )
        respx.post("https://api.eagleview.test/v2/Order/PlaceOrder").mock(
            return_value=httpx.Response(500, json={"error": "boom"})
        )
        with pytest.raises(EagleViewError):
            await p.request_report(addr)

    assert eagleview_cache_dao.get(addr) is None


@pytest.mark.asyncio
async def test_live_token_mint_failure_raises(isolated_db, monkeypatch):
    """If the token endpoint itself fails, every API call should raise
    EagleViewError before we ever touch the order endpoints."""
    _set_live_creds(monkeypatch)

    p = EagleViewProvider()
    addr = "835 S Cobble Creek, Nixa, MO 65714"

    async with respx.mock:
        respx.post(_TOKEN_URL).mock(
            return_value=httpx.Response(401, json={"error": "invalid_client"})
        )
        with pytest.raises(EagleViewError):
            await p.request_report(addr)

    assert eagleview_cache_dao.get(addr) is None


@pytest.mark.asyncio
async def test_live_token_cached_across_calls(isolated_db, monkeypatch):
    """Once minted, the bearer token is reused — no second hit on /token
    while we're still inside the TTL window."""
    _set_live_creds(monkeypatch)

    p = EagleViewProvider()
    addr = "21106 Kenswick Meadows Ct, Humble, TX 77338"

    async with respx.mock:
        token = respx.post(_TOKEN_URL).mock(
            return_value=httpx.Response(200, json=_TOKEN_RESPONSE)
        )
        respx.post("https://api.eagleview.test/v2/Order/PlaceOrder").mock(
            return_value=httpx.Response(200, json={"OrderId": 1, "ReportIds": [55]})
        )
        respx.get("https://api.eagleview.test/v3/Report/GetReport").mock(
            return_value=httpx.Response(200, json={"Status": "Completed", **SAMPLE_REPORT_PAYLOAD})
        )

        await p.request_report(addr)
        await p.get_report_status("55")
        await p.get_report_status("55")

    assert token.call_count == 1


@pytest.mark.asyncio
async def test_live_full_workflow_submit_status_fetch(isolated_db, monkeypatch):
    """POST PlaceOrder → GET GetReport (in_progress) → GET GetReport
    (completed) → GET GetReport (fetch measurements). v3 has no separate
    status endpoint — GetReport is the single source for both."""
    _set_live_creds(monkeypatch)

    p = EagleViewProvider()
    addr = "21106 Kenswick Meadows Ct, Humble, TX 77338"

    async with respx.mock:
        respx.post(_TOKEN_URL).mock(
            return_value=httpx.Response(200, json=_TOKEN_RESPONSE)
        )
        respx.post("https://api.eagleview.test/v2/Order/PlaceOrder").mock(
            return_value=httpx.Response(200, json={"OrderId": 1, "ReportIds": [9001]})
        )
        # GetReport is hit 3 times: 2 status polls + 1 final fetch.
        respx.get("https://api.eagleview.test/v3/Report/GetReport").mock(
            side_effect=[
                httpx.Response(200, json={"Status": "InProgress"}),
                httpx.Response(200, json={"Status": "Completed"}),
                httpx.Response(200, json=SAMPLE_REPORT_PAYLOAD),
            ]
        )

        job_id = await p.request_report(addr)
        assert job_id == "9001"
        assert await p.get_report_status(job_id) == "pending"
        assert await p.get_report_status(job_id) == "complete"
        m = await p.fetch_report(job_id)

    assert m.total_roof_area_sqft == 2443.0
    assert m.predominant_pitch == "6:12"
    assert m.ridge_lf == 26.0
    assert m.hip_lf == 101.0
    assert m.valley_lf == 38.0
    assert m.rake_lf == 83.0
    assert m.eave_lf == 164.0
    assert m.flashing_lf == 25.0
    assert m.step_flashing_lf == 21.0
    assert m.source == "eagleview"
    assert m.raw == SAMPLE_REPORT_PAYLOAD


# ---------- pure helpers ----------


def test_map_status_known_completed():
    assert _map_status("Completed") == "complete"
    assert _map_status("complete") == "complete"
    assert _map_status("DELIVERED") == "complete"


def test_map_status_known_failed():
    assert _map_status("Cancelled") == "failed"
    assert _map_status("Rejected") == "failed"
    assert _map_status("error") == "failed"


def test_map_status_known_pending():
    assert _map_status("Pending") == "pending"
    assert _map_status("InProgress") == "pending"
    assert _map_status("Processing") == "pending"
    assert _map_status("Ordered") == "pending"


def test_map_status_unknown_defaults_to_pending():
    assert _map_status("WhoKnows") == "pending"


def test_translate_handles_missing_line_items():
    """Real reports during the in-progress window omit measurement fields.
    We default missing values to 0 rather than failing pydantic validation."""
    minimal = {
        "Street": "x",
        "City": "y",
        "State": "TX",
        "Zip": "77338",
        "TotalMeasurements": {
            "Area": "1000",
            "PrimaryPitch": "4:12",
        },
    }
    m = _translate_eagleview_response(minimal)
    assert m.total_roof_area_sqft == 1000.0
    assert m.predominant_pitch == "4:12"
    assert m.ridge_lf == 0.0
    assert m.flashing_lf == 0.0
    assert m.source == "eagleview"


def test_translate_handles_completely_empty_payload():
    m = _translate_eagleview_response({})
    assert m.total_roof_area_sqft == 0.0
    assert m.predominant_pitch == "0:12"
    assert m.source == "eagleview"


def test_to_float_string_with_commas():
    assert _to_float("2,443") == 2443.0
    assert _to_float("1,234,567.89") == 1234567.89


def test_to_float_handles_garbage():
    assert _to_float(None) == 0.0
    assert _to_float("") == 0.0
    assert _to_float("not a number") == 0.0
    assert _to_float([1, 2, 3]) == 0.0


def test_to_float_passes_through_numbers():
    assert _to_float(42) == 42.0
    assert _to_float(42.5) == 42.5


def test_parse_address_standard_format():
    parts = _parse_address("21106 Kenswick Meadows Ct, Humble, TX 77338")
    assert parts == {
        "street": "21106 Kenswick Meadows Ct",
        "city": "Humble",
        "state": "TX",
        "zip": "77338",
    }


def test_parse_address_zip_plus_four():
    parts = _parse_address("123 Main St, Anytown, CA 90210-1234")
    assert parts["state"] == "CA"
    assert parts["zip"] == "90210-1234"


def test_build_submit_payload_uses_premium_residential_product():
    body = _build_submit_payload("21106 Kenswick Meadows Ct, Humble, TX 77338")
    assert body["OrderReports"]["PrimaryProductId"] == 31
    assert body["OrderReports"]["ReportAddresses"]["Country"] == "USA"
