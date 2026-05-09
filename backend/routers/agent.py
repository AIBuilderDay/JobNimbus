"""HTTP surface for the agent.

POST /api/agent/chat       — multipart form: text + N files. Returns SSE.
GET  /api/agent/sessions/{id}  — read transcript (debug / reload).
DELETE /api/agent/sessions/{id} — wipe a session.
GET  /api/agent/health      — does ANTHROPIC_API_KEY exist? quick probe.

The chat endpoint accepts multipart/form-data so the frontend can attach
PDFs, CSVs, Excel sheets, and images alongside the user's text in one
request. SSE is one frame per agent event (see agent/runner.py for the
event taxonomy).
"""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from agent import sessions
from agent.files import FilePart, parse_upload
from agent.runner import run_turn
from logger import get_logger
from settings import settings

log = get_logger(__name__)
router = APIRouter(prefix="/api/agent", tags=["agent"])

MAX_FILES_PER_TURN = 8
MAX_FILE_BYTES = 25 * 1024 * 1024  # 25 MB per file


@router.get("/health")
def agent_health() -> dict[str, Any]:
    """Tells the frontend whether the agent is ready to serve."""
    ok = bool(settings.ANTHROPIC_API_KEY)
    return {"status": "ok" if ok else "missing_api_key", "anthropic_configured": ok}


@router.post("/chat")
async def chat(
    message: str = Form(""),
    session_id: str | None = Form(None),
    files: list[UploadFile] = File(default_factory=list),
) -> StreamingResponse:
    """Stream agent events as SSE.

    Form fields:
        message: User text (may be empty if only files attached).
        session_id: Continue an existing session, or omit to start new.
        files: Optional uploads (PDF / CSV / XLSX / JPG / PNG / GIF / WEBP).
    """
    log.info(
        "POST /api/agent/chat session_id=%s message_len=%d files=%d",
        session_id, len(message), len(files),
    )

    if not message.strip() and not files:
        raise HTTPException(status_code=400, detail="Provide a message or at least one file.")
    if len(files) > MAX_FILES_PER_TURN:
        raise HTTPException(status_code=400, detail=f"Too many files (max {MAX_FILES_PER_TURN}).")

    # Read + parse uploads upfront so we can fail loudly before the SSE stream opens.
    file_parts: list[FilePart] = []
    for upload in files:
        data = await upload.read()
        if len(data) > MAX_FILE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File {upload.filename!r} exceeds {MAX_FILE_BYTES // (1024 * 1024)}MB limit.",
            )
        try:
            part = parse_upload(upload.filename or "upload", upload.content_type, data)
        except ValueError as e:
            log.warning("upload rejected filename=%s err=%s", upload.filename, e)
            raise HTTPException(status_code=400, detail=str(e))
        file_parts.append(part)
        log.info("upload accepted filename=%s kind=%s summary=%s", part.filename, part.kind, part.summary)

    async def event_stream():
        try:
            async for ev in run_turn(session_id, message, file_parts):
                yield _sse_frame(ev)
        except Exception as e:  # noqa: BLE001 — SSE must always close cleanly
            log.exception("agent stream crashed")
            yield _sse_frame({"type": "error", "message": f"Server error: {e}"})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            # Disable nginx-style proxy buffering so events flush immediately.
            "X-Accel-Buffering": "no",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


def _sse_frame(event: dict[str, Any]) -> str:
    """Serialize one agent event into an SSE frame."""
    etype = event.get("type", "message")
    data = json.dumps(event, default=str)
    return f"event: {etype}\ndata: {data}\n\n"


@router.get("/sessions/{session_id}")
def get_session(session_id: str) -> dict[str, Any]:
    log.info("GET /api/agent/sessions/%s", session_id)
    sess = sessions.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    return {
        "session_id": sess.session_id,
        "messages": sess.messages,
        "last_estimate_id": sess.last_estimate_id,
        "message_count": len(sess.messages),
    }


@router.delete("/sessions/{session_id}")
def delete_session(session_id: str) -> dict[str, Any]:
    log.info("DELETE /api/agent/sessions/%s", session_id)
    ok = sessions.reset(session_id)
    if not ok:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    return {"status": "deleted", "session_id": session_id}
