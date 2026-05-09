"""One-shot: submit ONE address to EagleView, poll until done, dump the
raw GetReport JSON for offline inspection.

Status (2026-05-09): does not work against the developer sandbox — submit
returns canned `report_id=47741613` and GetReport on that ID returns
`400 "does not exist!"`. Will work against prod once the Go-live Request
is approved. See backend/docs/eagleview-api/README.md.

Why this exists: providers/eagleview.py has TODO(eagleview-live) markers
on every field name we read out of GetReport, because the real EagleView
docs are gated. This script grabs a real response so we can lock down
those field names, see what the linear measurements actually look like,
and update the test fixture (SAMPLE_REPORT_PAYLOAD) accordingly.

Output (written to backend/tmp/eagleview_dump/):
  01_submit_order_id.txt   — order_id we got back from PlaceOrder
  02_status_log.txt        — every status poll, timestamped
  03_raw_report.json       — full GetReport payload, pretty-printed
  04_measurement.json      — what _translate_eagleview_response made of it

Run:
  task backend:eagleview-dump
  task backend:eagleview-dump -- "21106 Kenswick Meadows Ct, Humble, TX 77338"
"""

import asyncio
import json
import sys
import time
from pathlib import Path

from dao.database import init_db
from logger import get_logger
from providers.eagleview import EagleViewError, EagleViewProvider
from settings import settings

log = get_logger(__name__)


DEFAULT_ADDRESS = "21106 Kenswick Meadows Ct, Humble, TX 77338"
POLL_INTERVAL_SECONDS = 60
MAX_POLL_MINUTES = 30
DUMP_DIR = Path(__file__).resolve().parents[1] / "tmp" / "eagleview_dump"


def _write(path: Path, content: str) -> None:
    path.write_text(content)
    print(f"  wrote {path.relative_to(Path.cwd())}")


async def main(address: str) -> int:
    init_db()
    DUMP_DIR.mkdir(parents=True, exist_ok=True)

    if not (settings.EAGLEVIEW_CLIENT_ID and settings.EAGLEVIEW_CLIENT_SECRET):
        print("ERROR: EAGLEVIEW_CLIENT_ID / EAGLEVIEW_CLIENT_SECRET not set.")
        print("Run via: task backend:eagleview-dump (it wraps with `op run --env-file=.env`).")
        return 2

    provider = EagleViewProvider()
    if provider.mock_mode:
        print("ERROR: provider auto-fell-back to mock mode — credentials weren't picked up.")
        return 2

    print(f"Address:  {address}")
    print(f"Base URL: {provider.base_url}")
    print(f"Output:   {DUMP_DIR}")
    print()

    # 1. Submit. request_report dedupes against existing cache rows, so re-running
    #    the script reuses any in-flight order rather than spawning a new one.
    print("[1/3] Submitting order...")
    try:
        order_id = await provider.request_report(address)
    except EagleViewError as e:
        _write(DUMP_DIR / "01_submit_error.txt", f"{type(e).__name__}: {e}\n")
        print(f"  SUBMIT FAILED: {e}")
        print("  Likely causes: address not covered by sandbox, OR auth/scope issue.")
        return 1
    print(f"  order_id={order_id}")
    _write(DUMP_DIR / "01_submit_order_id.txt", order_id + "\n")

    # 2. Poll status. Sandbox latency is unknown — could be seconds, could be
    #    real-time, could be the full prod 10–30min. We log every poll so we
    #    can see how the status string evolves.
    print(f"[2/3] Polling status (every {POLL_INTERVAL_SECONDS}s, up to {MAX_POLL_MINUTES}min)...")
    status_log: list[str] = []
    deadline = time.time() + MAX_POLL_MINUTES * 60
    poll_n = 0
    while True:
        poll_n += 1
        try:
            status = await provider.get_report_status(order_id)
        except EagleViewError as e:
            line = f"{poll_n}: ERROR {type(e).__name__}: {e}"
            status_log.append(line)
            print(f"  {line}")
            _write(DUMP_DIR / "02_status_log.txt", "\n".join(status_log) + "\n")
            return 1
        line = f"{poll_n} ({time.strftime('%H:%M:%S')}): {status}"
        status_log.append(line)
        print(f"  {line}")
        if status == "complete":
            break
        if status == "failed":
            print("  ORDER FAILED upstream")
            _write(DUMP_DIR / "02_status_log.txt", "\n".join(status_log) + "\n")
            return 1
        if time.time() > deadline:
            print(f"  TIMEOUT after {MAX_POLL_MINUTES}min, last status={status}")
            _write(DUMP_DIR / "02_status_log.txt", "\n".join(status_log) + "\n")
            return 1
        await asyncio.sleep(POLL_INTERVAL_SECONDS)
    _write(DUMP_DIR / "02_status_log.txt", "\n".join(status_log) + "\n")

    # 3. Fetch the report and dump both the raw payload and our translated view.
    print("[3/3] Fetching report...")
    try:
        measurement = await provider.fetch_report(order_id)
    except EagleViewError as e:
        _write(DUMP_DIR / "03_fetch_error.txt", f"{type(e).__name__}: {e}\n")
        print(f"  FETCH FAILED: {e}")
        return 1

    raw = measurement.raw or {}
    _write(DUMP_DIR / "03_raw_report.json", json.dumps(raw, indent=2, sort_keys=True) + "\n")
    _write(
        DUMP_DIR / "04_measurement.json",
        json.dumps(measurement.model_dump(mode="json"), indent=2, sort_keys=True) + "\n",
    )

    print()
    print("Top-level keys in raw GetReport response:")
    for k in sorted(raw.keys()):
        v = raw[k]
        preview = (
            f"<{type(v).__name__} len={len(v)}>"
            if isinstance(v, (list, dict)) and len(v) > 5
            else repr(v)[:80]
        )
        print(f"  {k}: {preview}")
    print()
    print("Translated Measurement:")
    for field, value in measurement.model_dump(mode="json").items():
        if field == "raw":
            continue
        print(f"  {field}: {value}")
    print()
    print("Next step: open 03_raw_report.json, compare its keys against the")
    print("`data.get(...)` calls in providers/eagleview.py:_translate_eagleview_response,")
    print("and swap in real field names (replacing the TODO(eagleview-live) fallbacks).")
    return 0


if __name__ == "__main__":
    addr = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else DEFAULT_ADDRESS
    sys.exit(asyncio.run(main(addr)))
