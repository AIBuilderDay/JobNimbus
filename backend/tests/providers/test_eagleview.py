import httpx
import pytest
import respx

from dao import eagleview_cache_dao
from models.measurement import Measurement
from providers.eagleview import (
    CacheMissError,
    EagleViewError,
    EagleViewProvider,
    _map_status,
    _translate_eagleview_response,
)


# TODO(eagleview-live): once we have sandbox creds, run a one-shot script
# that hits PlaceOrder → GetOrderStatus → GetReport for one example
# property and dumps the raw JSON. Replace SAMPLE_REPORT_PAYLOAD below
# with the redacted real response (keep the address, drop any account /
# customer / token fields), then re-validate _translate_eagleview_response
# field names against what the API actually returns. Cross-check against
# Measurement model expectations and update both this test and the field
# fallbacks in providers/eagleview.py:_translate_eagleview_response.
SAMPLE_REPORT_PAYLOAD = {
    "Address": "21106 Kenswick Meadows Ct, Humble, TX 77338",
    "TotalRoofArea": 2443.0,
    "PredominantPitch": "6:12",
    "RidgeLength": 26.0,
    "HipLength": 101.0,
    "ValleyLength": 38.0,
    "RakeLength": 83.0,
    "EaveLength": 164.0,
    "FlashingLength": 25.0,
    "StepFlashingLength": 21.0,
}


# ---------- mock-mode (no httpx) ----------


def test_mock_mode_auto_engages_when_key_missing(monkeypatch):
    from settings import settings
    monkeypatch.setattr(settings, "EAGLEVIEW_API_KEY", "")
    p = EagleViewProvider()
    assert p.mock_mode is True


def test_mock_mode_explicit_overrides_key(monkeypatch):
    from settings import settings
    monkeypatch.setattr(settings, "EAGLEVIEW_API_KEY", "sk-real")
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
    # Determinism: same job_id returns same numbers across calls.
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
    from settings import settings
    monkeypatch.setattr(settings, "EAGLEVIEW_API_KEY", "sk-test")
    monkeypatch.setattr(settings, "EAGLEVIEW_BASE_URL", "https://api.eagleview.test")

    p = EagleViewProvider()
    assert p.mock_mode is False
    addr = "122 NW 13th Ave, Cape Coral, FL 33993"

    async with respx.mock:
        submit = respx.post("https://api.eagleview.test/v2/Order/PlaceOrder").mock(
            return_value=httpx.Response(200, json={"ReportId": "EV-12345"})
        )
        job_id = await p.request_report(addr)

    assert job_id == "EV-12345"
    assert submit.called
    cached = eagleview_cache_dao.get(addr)
    assert cached is not None
    assert cached.status == "pending"
    assert cached.job_id == "EV-12345"


@pytest.mark.asyncio
async def test_live_request_report_500_raises_no_pending_row(isolated_db, monkeypatch):
    from settings import settings
    monkeypatch.setattr(settings, "EAGLEVIEW_API_KEY", "sk-test")
    monkeypatch.setattr(settings, "EAGLEVIEW_BASE_URL", "https://api.eagleview.test")

    p = EagleViewProvider()
    addr = "835 S Cobble Creek, Nixa, MO 65714"

    async with respx.mock:
        respx.post("https://api.eagleview.test/v2/Order/PlaceOrder").mock(
            return_value=httpx.Response(500, json={"error": "boom"})
        )
        with pytest.raises(EagleViewError):
            await p.request_report(addr)

    assert eagleview_cache_dao.get(addr) is None


@pytest.mark.asyncio
async def test_live_full_workflow_submit_status_fetch(isolated_db, monkeypatch):
    """POST submit → GET status (pending → complete) → GET fetch returns
    a fully-populated Measurement."""
    from settings import settings
    monkeypatch.setattr(settings, "EAGLEVIEW_API_KEY", "sk-test")
    monkeypatch.setattr(settings, "EAGLEVIEW_BASE_URL", "https://api.eagleview.test")

    p = EagleViewProvider()
    addr = "21106 Kenswick Meadows Ct, Humble, TX 77338"

    async with respx.mock:
        respx.post("https://api.eagleview.test/v2/Order/PlaceOrder").mock(
            return_value=httpx.Response(200, json={"ReportId": "EV-9001"})
        )
        # First status poll: pending. Second: complete.
        respx.get("https://api.eagleview.test/v2/Order/GetOrderStatus").mock(
            side_effect=[
                httpx.Response(200, json={"Status": "InProgress"}),
                httpx.Response(200, json={"Status": "Completed"}),
            ]
        )
        respx.get("https://api.eagleview.test/v2/Order/GetReport").mock(
            return_value=httpx.Response(200, json=SAMPLE_REPORT_PAYLOAD)
        )

        job_id = await p.request_report(addr)
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
    # raw payload preserved verbatim
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


def test_map_status_unknown_defaults_to_pending():
    # Unknown statuses should not blow up a precache run.
    assert _map_status("WhoKnows") == "pending"


def test_translate_handles_missing_line_items():
    """Real reports sometimes omit fields. We default missing line items
    to 0 rather than failing pydantic validation."""
    minimal = {
        "Address": "x",
        "TotalRoofArea": 1000.0,
        "PredominantPitch": "4:12",
    }
    m = _translate_eagleview_response(minimal)
    assert m.total_roof_area_sqft == 1000.0
    assert m.predominant_pitch == "4:12"
    assert m.ridge_lf == 0.0
    assert m.flashing_lf == 0.0
    assert m.source == "eagleview"
