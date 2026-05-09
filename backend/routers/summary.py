"""Markdown summary endpoint for an estimate.

Returns a single `text/markdown` blob the MCP agent (or any external
client) can drop straight into a chat reply. Composition logic lives in
`services.summary` — this router is a thin shell.
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse

from logger import get_logger
from routers.estimate import _estimates
from services.summary import build_markdown_summary

log = get_logger(__name__)
router = APIRouter(prefix="/api/estimate", tags=["summary"])


@router.get(
    "/{estimate_id}/summary",
    response_class=PlainTextResponse,
    responses={200: {"content": {"text/markdown": {}}}},
)
def get_estimate_summary(estimate_id: str) -> PlainTextResponse:
    log.info("GET /api/estimate/%s/summary", estimate_id)
    estimate = _estimates.get(estimate_id)
    if not estimate:
        log.warning("GET /api/estimate/%s/summary not found", estimate_id)
        raise HTTPException(status_code=404, detail="Estimate not found")
    body = build_markdown_summary(estimate)
    log.info("GET /api/estimate/%s/summary ok %d bytes", estimate_id, len(body))
    return PlainTextResponse(content=body, media_type="text/markdown")
