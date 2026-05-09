"""EagleView Reports API wrapper.

Docs (consulted, gated content — full schemas need a logged-in dev account):
  - https://developer.eagleview.com/documentation/measurement-orders/v1/overview
  - https://developer.eagleview.com/user-guides/developer-guides/authentication-methods
  - https://restdoc.eagleview.com/

API surface (best understanding from the docs above + public Postman collections):
  Auth:    OAuth2 / Bearer token in the `Authorization` header.
           Public docs describe a client-credentials grant against
           POST {base}/auth-service/v1/token. We use a long-lived bearer
           token (settings.EAGLEVIEW_API_KEY) for the hackathon — if that
           proves to be a client_id+secret pair instead, swap _headers()
           to mint a token first.
  Submit:  POST {base}/v2/Order/PlaceOrder
           Body shape and response field for the report id are NOT yet
           validated against a real account. Field names below are marked
           with TODO(eagleview-live).
  Status:  GET  {base}/v2/Order/GetOrderStatus?reportId=<id>
           Status strings observed in public docs: "Pending", "InProgress",
           "Completed", "Cancelled", "Rejected". _map_status collapses
           those to our 3-value Literal.
  Fetch:   GET  {base}/v2/Order/GetReport?reportId=<id>
           Returns the measurement payload. Field names below are marked
           with TODO(eagleview-live).

Cache contract:
  All cache reads/writes go through dao.eagleview_cache_dao. Address
  normalization (lowercase + collapsed whitespace) lives in the DAO — we
  pass raw addresses through.

Mock mode:
  Auto-engages when settings.EAGLEVIEW_API_KEY is empty. Returns a
  deterministic Measurement keyed off the address so unit tests + offline
  development still exercise the cache plumbing end-to-end.
"""

from typing import Literal

import httpx

from dao import eagleview_cache_dao
from logger import get_logger
from models.measurement import Measurement
from settings import settings

log = get_logger(__name__)


# TODO(eagleview-live): confirm against a real account.
_SUBMIT_PATH = "/v2/Order/PlaceOrder"
_STATUS_PATH = "/v2/Order/GetOrderStatus"
_FETCH_PATH = "/v2/Order/GetReport"


class EagleViewError(Exception):
    """Generic EagleView upstream failure."""


class CacheMissError(Exception):
    """Address not yet in cache. Caller should fall back to alternate source."""


class EagleViewProvider:
    """Wraps EagleView REST API. Stateless. Cache lookup via DAO."""

    def __init__(self, *, mock_mode: bool | None = None):
        self.base_url = settings.EAGLEVIEW_BASE_URL.rstrip("/")
        self.api_key = settings.EAGLEVIEW_API_KEY
        self.mock_mode = mock_mode if mock_mode is not None else not bool(self.api_key)

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    async def request_report(self, address: str) -> str:
        """Submit a report job. Returns job_id. Idempotent on address."""
        existing = eagleview_cache_dao.get(address)
        if existing and existing.job_id:
            log.info(
                "eagleview request_report dedupe address=%s job_id=%s",
                address, existing.job_id,
            )
            return existing.job_id

        if self.mock_mode:
            job_id = f"mock-{abs(hash(address))}"
            log.info("eagleview mock request_report address=%s job_id=%s", address, job_id)
            eagleview_cache_dao.put_pending(address, job_id)
            return job_id

        log.info("eagleview request_report address=%s", address)
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{self.base_url}{_SUBMIT_PATH}",
                    headers=self._headers(),
                    json=_build_submit_payload(address),
                )
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPError:
            log.exception("eagleview request_report failed address=%s", address)
            raise EagleViewError(f"EagleView submission failed for {address}")

        # TODO(eagleview-live): confirm field name. PlaceOrder responses in
        # public examples have used both `ReportId` and `OrderId`.
        job_id = str(data.get("ReportId") or data.get("OrderId") or "")
        if not job_id:
            log.error("eagleview request_report missing id in response keys=%s", list(data.keys()))
            raise EagleViewError(f"EagleView response missing report id for {address}")

        eagleview_cache_dao.put_pending(address, job_id)
        return job_id

    async def get_report_status(self, job_id: str) -> Literal["pending", "complete", "failed"]:
        if self.mock_mode:
            return "complete"

        log.info("eagleview get_report_status job_id=%s", job_id)
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{self.base_url}{_STATUS_PATH}",
                    headers=self._headers(),
                    params={"reportId": job_id},
                )
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPError:
            log.exception("eagleview get_report_status failed job_id=%s", job_id)
            raise EagleViewError(f"EagleView status check failed for {job_id}")

        # TODO(eagleview-live): confirm field name (`Status` vs `OrderStatus`).
        raw_status = str(data.get("Status") or data.get("OrderStatus") or "")
        return _map_status(raw_status)

    async def fetch_report(self, job_id: str) -> Measurement:
        """Fetch completed report and translate to our Measurement model.
        Raises EagleViewError if not complete."""
        if self.mock_mode:
            return _mock_measurement(job_id)

        log.info("eagleview fetch_report job_id=%s", job_id)
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(
                    f"{self.base_url}{_FETCH_PATH}",
                    headers=self._headers(),
                    params={"reportId": job_id},
                )
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPError:
            log.exception("eagleview fetch_report failed job_id=%s", job_id)
            raise EagleViewError(f"EagleView fetch failed for {job_id}")

        return _translate_eagleview_response(data)

    async def get_measurements(self, address: str) -> Measurement:
        """Cache-first lookup.
        - Cache hit (status=complete) → return Measurement
        - Cache miss / pending / failed → fire request_report (records pending row),
          raise CacheMissError so the caller can fall back to another source.
        """
        cached = eagleview_cache_dao.get(address)
        if cached and cached.status == "complete" and cached.measurements:
            return Measurement.model_validate(cached.measurements)

        job_id = await self.request_report(address)
        raise CacheMissError(
            f"EagleView job for {address} not ready (job_id={job_id})"
        )


# ---------- helpers ----------


def _build_submit_payload(address: str) -> dict:
    """Body for PlaceOrder. Real EagleView payloads expect parsed address
    components (street, city, state, zip) plus a product/report-type code.
    For now we send a single-line address; once we have a sandbox account
    we'll parse the address before submission."""
    # TODO(eagleview-live): split address into components and add the
    # correct product code (Premium Residential measurement report).
    return {
        "Address": address,
        "ReportType": "PremiumResidential",
    }


def _map_status(raw: str) -> Literal["pending", "complete", "failed"]:
    """Map EagleView status strings to our 3-value Literal.
    Unknown statuses default to 'pending' and log a warning so we can
    discover new values without erroring out a precache run."""
    normalized = raw.strip().lower()
    if normalized in {"completed", "complete", "delivered", "ready"}:
        return "complete"
    if normalized in {"cancelled", "canceled", "rejected", "failed", "error"}:
        return "failed"
    if normalized in {"pending", "inprogress", "in_progress", "in progress", "processing", "submitted", "queued"}:
        return "pending"
    log.warning("eagleview unknown status mapped to pending raw=%s", raw)
    return "pending"


def _translate_eagleview_response(data: dict) -> Measurement:
    """Extract our Measurement fields from the EagleView payload.
    All field names below are TODO(eagleview-live) until validated against
    a real report. Defaults are conservative: missing line items become 0
    rather than failing validation."""
    address = str(data.get("Address") or data.get("PropertyAddress") or "")
    total_area = float(data.get("TotalRoofArea") or data.get("TotalArea") or 0.0)
    pitch = str(data.get("PredominantPitch") or data.get("Pitch") or "0:12")

    return Measurement(
        address=address,
        total_roof_area_sqft=total_area,
        predominant_pitch=pitch,
        # EagleView reports total roof area as the slanted (already-pitched)
        # value, so no multiplier needed downstream — leave at the default 1.0.
        pitch_multiplier_applied=1.0,
        source="eagleview",
        sources_consulted=["eagleview"],
        ridge_lf=float(data.get("RidgeLength") or data.get("Ridges") or 0.0),
        hip_lf=float(data.get("HipLength") or data.get("Hips") or 0.0),
        valley_lf=float(data.get("ValleyLength") or data.get("Valleys") or 0.0),
        rake_lf=float(data.get("RakeLength") or data.get("Rakes") or 0.0),
        eave_lf=float(data.get("EaveLength") or data.get("Eaves") or 0.0),
        flashing_lf=float(data.get("FlashingLength") or data.get("Flashing") or 0.0),
        step_flashing_lf=float(data.get("StepFlashingLength") or data.get("StepFlashing") or 0.0),
        raw=data,
    )


def _mock_measurement(job_id: str) -> Measurement:
    """Deterministic stub for mock mode and tests. Numbers are roughly in
    the range of the benchmark example properties (2,500–4,500 sqft, 6:12
    pitch) but vary by job_id hash so cache identity tests still distinguish
    addresses."""
    seed = abs(hash(job_id))
    base_area = 2500.0 + (seed % 2000)
    return Measurement(
        address="",
        total_roof_area_sqft=base_area,
        predominant_pitch="6:12",
        pitch_multiplier_applied=1.0,
        source="eagleview",
        sources_consulted=["eagleview"],
        ridge_lf=80.0,
        hip_lf=100.0,
        valley_lf=40.0,
        rake_lf=90.0,
        eave_lf=180.0,
        flashing_lf=25.0,
        step_flashing_lf=20.0,
        raw={"mock": True, "job_id": job_id},
    )
