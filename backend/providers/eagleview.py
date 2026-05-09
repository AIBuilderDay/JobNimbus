"""EagleView Measurement Orders API wrapper.

Status (2026-05-09): scaffolding only — NOT in the runtime measurement path.
OAuth works against prod (`apicenter.eagleview.com/oauth2/v1/token` mints a
real Okta JWT), but the developer sandbox is an Apigee-canned stub:
PlaceOrder hardcodes `report_id=47741613` for any address, GetReport returns
"does not exist!" for every ID. Production access requires EagleView's
manual "Go-live Request" approval. Full write-up + revival steps:
backend/docs/eagleview-api/README.md.

Docs (source: https://developer.eagleview.com/documentation/measurement-orders/v1):
  Token endpoint: POST https://apicenter.eagleview.com/oauth2/v1/token
                  (always production host — sandbox API auth tokens are
                  minted from the same auth server)
  Sandbox base:   https://sandbox.apicenter.eagleview.com
  Production base: https://apicenter.eagleview.com

  PlaceOrder:  POST {base}/v2/Order/PlaceOrder
               Returns {"OrderId": int, "ReportIds": [int, ...]}
  GetReport:   GET  {base}/v3/Report/GetReport?reportId=<int>
               Returns the full report including status. We use this for
               BOTH polling (read .StatusId / .Status) and final fetch
               (read .TotalMeasurements.*). One endpoint, two purposes —
               there is no separate GetOrderStatus in the v3 surface.

Authentication:
  OAuth2 client_credentials grant. POST client_id+secret (HTTP Basic) +
  body `grant_type=client_credentials` to the token endpoint, get back
  {access_token, expires_in (24h), refresh_token (30d), token_type}.
  We mint lazily and cache in-process for the lifetime of the provider
  instance, refreshing 30s before expiry.

Mock mode:
  Auto-engages when EAGLEVIEW_CLIENT_ID or EAGLEVIEW_CLIENT_SECRET is
  missing. Returns a deterministic Measurement keyed off the address so
  unit tests + offline development still exercise the cache plumbing
  end-to-end.
"""

import re
import time
from typing import Literal

import httpx

from dao import eagleview_cache_dao
from logger import get_logger
from models.measurement import Measurement
from settings import settings

log = get_logger(__name__)


# Token is always minted off the production auth host, regardless of
# whether we're calling the sandbox or production API base.
_TOKEN_URL = "https://apicenter.eagleview.com/oauth2/v1/token"
_SUBMIT_PATH = "/v2/Order/PlaceOrder"
_FETCH_PATH = "/v3/Report/GetReport"

# Premium - Residential. Full 3D roof report with line-item measurements.
# Source: developer.eagleview.com /api-documentation > PrimaryProductId.
_PRIMARY_PRODUCT_ID_PREMIUM_RESIDENTIAL = 31

# Refresh ~30s before actual expiry to avoid sending a token that dies
# mid-request.
_TOKEN_REFRESH_MARGIN_S = 30


class EagleViewError(Exception):
    """Generic EagleView upstream failure."""


class CacheMissError(Exception):
    """Address not yet in cache. Caller should fall back to alternate source."""


class EagleViewProvider:
    """Wraps EagleView Measurement Orders REST API. Cache lookup via DAO.
    Holds an in-memory OAuth2 token for the lifetime of the instance."""

    def __init__(self, *, mock_mode: bool | None = None):
        self.base_url = settings.EAGLEVIEW_BASE_URL.rstrip("/")
        self.client_id = settings.EAGLEVIEW_CLIENT_ID
        self.client_secret = settings.EAGLEVIEW_CLIENT_SECRET
        self.mock_mode = (
            mock_mode if mock_mode is not None
            else not (self.client_id and self.client_secret)
        )
        self._access_token: str | None = None
        self._token_expires_at: float = 0.0  # epoch seconds

    async def _get_access_token(self) -> str:
        """Mint or return cached OAuth2 access token (client_credentials)."""
        if self._access_token and time.time() < self._token_expires_at - _TOKEN_REFRESH_MARGIN_S:
            return self._access_token

        log.info("eagleview minting access token")
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    _TOKEN_URL,
                    auth=(self.client_id, self.client_secret),
                    data={"grant_type": "client_credentials"},
                )
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPError:
            log.exception("eagleview token mint failed")
            raise EagleViewError("EagleView authentication failed")

        token = data.get("access_token")
        if not token:
            log.error("eagleview token response missing access_token keys=%s", list(data.keys()))
            raise EagleViewError("EagleView token response missing access_token")
        expires_in = int(data.get("expires_in") or 86400)

        self._access_token = token
        self._token_expires_at = time.time() + expires_in
        return token

    async def _headers(self) -> dict[str, str]:
        token = await self._get_access_token()
        return {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    async def request_report(self, address: str) -> str:
        """Submit a report job. Returns report_id (stringified). Idempotent
        on address — re-calls return the same id from cache."""
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
                    headers=await self._headers(),
                    json=_build_submit_payload(address),
                )
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPError:
            log.exception("eagleview request_report failed address=%s", address)
            raise EagleViewError(f"EagleView submission failed for {address}")

        # PlaceOrder returns {"OrderId": int, "ReportIds": [int, ...]}.
        # We track the first report id since each PlaceOrder produces one
        # measurement report (additional ids would be add-ons).
        report_ids = data.get("ReportIds") or []
        report_id = report_ids[0] if report_ids else data.get("OrderId")
        if not report_id:
            log.error("eagleview request_report missing id keys=%s", list(data.keys()))
            raise EagleViewError(f"EagleView response missing report id for {address}")

        job_id = str(report_id)
        eagleview_cache_dao.put_pending(address, job_id)
        return job_id

    async def get_report_status(self, job_id: str) -> Literal["pending", "complete", "failed"]:
        """Poll status. Single-source: hits GetReport and reads its status
        fields. EagleView v3 has no separate GetOrderStatus — GetReport
        returns the status itself, plus the measurements once complete."""
        if self.mock_mode:
            return "complete"

        data = await self._fetch_report_payload(job_id)
        # The Status field is the human-readable string ("In Progress",
        # "Completed"). DisplayStatus is similar but UI-formatted.
        raw_status = str(data.get("Status") or data.get("DisplayStatus") or "")
        return _map_status(raw_status)

    async def fetch_report(self, job_id: str) -> Measurement:
        """Fetch completed report and translate to our Measurement model.
        Caller is responsible for checking status first — we don't re-check
        here, so calling fetch_report on an in-flight order may yield an
        empty Measurement (zeroed line items)."""
        if self.mock_mode:
            return _mock_measurement(job_id)

        data = await self._fetch_report_payload(job_id)
        return _translate_eagleview_response(data)

    async def _fetch_report_payload(self, job_id: str) -> dict:
        """Shared GET /v3/Report/GetReport — used by both status polling
        and final fetch."""
        log.info("eagleview GetReport job_id=%s", job_id)
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(
                    f"{self.base_url}{_FETCH_PATH}",
                    headers=await self._headers(),
                    params={"reportId": job_id},
                )
                resp.raise_for_status()
                return resp.json()
        except httpx.HTTPError:
            log.exception("eagleview GetReport failed job_id=%s", job_id)
            raise EagleViewError(f"EagleView GetReport failed for {job_id}")

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
    """Body for PlaceOrder. EagleView wants address parts (street/city/
    state/zip) + a PrimaryProductId integer. We parse a single-line
    address for hackathon convenience; in prod we'd carry the structured
    address from the geocoder through."""
    parts = _parse_address(address)
    return {
        "OrderReports": {
            "ReportAddresses": {
                "Address": parts["street"],
                "City": parts["city"],
                "State": parts["state"],
                "Zip": parts["zip"],
                "Country": "USA",
            },
            "PrimaryProductId": _PRIMARY_PRODUCT_ID_PREMIUM_RESIDENTIAL,
        }
    }


def _parse_address(addr: str) -> dict[str, str]:
    """Best-effort split of "Street, City, State ZIP" into parts.
    Tolerant of extra commas or missing zip — anything we can't parse
    becomes empty string and EagleView will reject it explicitly, which
    is better than silently sending garbage."""
    parts = [p.strip() for p in addr.split(",")]
    street = parts[0] if parts else ""
    city = parts[1] if len(parts) > 1 else ""
    state = ""
    zip_code = ""
    if len(parts) > 2:
        # "TX 77338" or "TX  77338-1234"
        m = re.match(r"^\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)\s*$", parts[2])
        if m:
            state, zip_code = m.group(1), m.group(2)
        else:
            state = parts[2]
    return {"street": street, "city": city, "state": state, "zip": zip_code}


def _map_status(raw: str) -> Literal["pending", "complete", "failed"]:
    """Map EagleView status strings (Status / DisplayStatus on GetReport)
    to our 3-value Literal. Unknown statuses default to 'pending' and log
    a warning so we can discover new values without erroring out a
    precache run."""
    normalized = raw.strip().lower()
    if normalized in {"completed", "complete", "delivered", "ready"}:
        return "complete"
    if normalized in {"cancelled", "canceled", "rejected", "failed", "error"}:
        return "failed"
    if normalized in {
        "pending", "inprogress", "in_progress", "in progress",
        "processing", "submitted", "queued", "new", "ordered",
    }:
        return "pending"
    log.warning("eagleview unknown status mapped to pending raw=%s", raw)
    return "pending"


def _to_float(value: object) -> float:
    """EagleView mixes strings and numbers in measurement fields.
    Accept either; default missing/unparseable to 0.0 so a partial
    payload doesn't crash cache writes."""
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = value.replace(",", "").strip()
        if not cleaned:
            return 0.0
        try:
            return float(cleaned)
        except ValueError:
            return 0.0
    return 0.0


def _translate_eagleview_response(data: dict) -> Measurement:
    """Extract our Measurement fields from a GetReport payload.
    Field names follow the v1 docs schema (TotalMeasurements.*) with
    fallbacks to top-level fields, since some report variants flatten."""
    totals = data.get("TotalMeasurements") or {}

    address_parts = [
        str(data.get("Street") or ""),
        str(data.get("City") or ""),
        str(data.get("State") or ""),
        str(data.get("Zip") or ""),
    ]
    address = ", ".join(p for p in address_parts if p).strip(", ")

    # AreaValue (numeric) is preferred; Area (string with units) is the
    # fallback. Same pattern for pitch.
    total_area = _to_float(totals.get("AreaValue") or totals.get("Area") or data.get("Area"))
    pitch_str = (
        totals.get("PrimaryPitch")
        or data.get("Pitch")
        or data.get("PrimaryPitch")
        or "0:12"
    )

    return Measurement(
        address=address,
        total_roof_area_sqft=total_area,
        predominant_pitch=str(pitch_str),
        # EagleView's Area is the slanted (already-pitched) roof surface
        # area, so no multiplier needed downstream.
        pitch_multiplier_applied=1.0,
        source="eagleview",
        sources_consulted=["eagleview"],
        ridge_lf=_to_float(totals.get("LengthRidge") or data.get("LengthRidge")),
        hip_lf=_to_float(totals.get("LengthHip") or data.get("LengthHip")),
        valley_lf=_to_float(totals.get("LengthValley") or data.get("LengthValley")),
        rake_lf=_to_float(totals.get("LengthRake") or data.get("LengthRake")),
        eave_lf=_to_float(totals.get("LengthEave") or data.get("LengthEave")),
        flashing_lf=_to_float(totals.get("LengthFlashing") or data.get("LengthFlashing")),
        step_flashing_lf=_to_float(totals.get("LengthStepFlashing") or data.get("LengthStepFlashing")),
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
