"""Anthropic-powered agent loop wired to the FastMCP tool surface.

`run_turn` yields a stream of typed events that the FastAPI router pipes
out as SSE. The frontend listens to those events to render assistant text
deltas, tool calls, tool results, and errors.

Event shape (always JSON):

    { "type": "session", "session_id": "..." }            # first event
    { "type": "text_delta", "text": "..." }               # streamed token
    { "type": "text_done", "text": "..." }                # full text block
    { "type": "tool_use_start", "id": "...", "name": "..." }
    { "type": "tool_use_input", "id": "...", "name": "...", "input": {...} }
    { "type": "tool_result", "id": "...", "name": "...",
      "is_error": false, "result": <json>, "duration_ms": 123 }
    { "type": "error", "message": "..." }                 # fatal — loop aborted
    { "type": "done", "stop_reason": "end_turn"|... }     # turn finished

We bridge Anthropic's streaming API to our SSE generator with an
asyncio.Queue: a producer task drives `messages.stream` and pushes events
into the queue, while the consumer (this generator) pulls from the queue
and yields. Between completions we run any tool calls Claude requested
through the FastMCP `Client`, push tool_result events, and start the next
completion.
"""
from __future__ import annotations

import asyncio
import json
import time
from typing import Any, AsyncIterator, Callable

from anthropic import AsyncAnthropic
from fastmcp import Client
from fastmcp.exceptions import ToolError

from agent import sessions
from agent.files import FilePart
from agent.mcp_server import mcp
from logger import get_logger
from settings import settings

log = get_logger(__name__)

ANTHROPIC_MODEL = "claude-sonnet-4-5"
MAX_TOOL_TURNS = 12  # safety cap so a misbehaving loop doesn't run forever
MAX_TOKENS = 4096

SYSTEM_PROMPT = """\
You are a roofing-estimate copilot for JobNimbus contractors.

Your job: given an address (typed, parsed from a PDF, or extracted from a
spreadsheet/image), drive the estimate flow end-to-end:
1. Resolve the address. If ambiguous, call `autocomplete_address` and ask
   the user to pick one.
2. Call `start_estimate` with the resolved address — keep the `estimate_id`.
3. Call `compute_pricing` with sensible defaults, then summarize the
   measurement and price clearly. Always quote money in dollars (cents/100).
4. Offer to refine — material, margin, waste, sales tax, add-ons. When the
   user says e.g. "drop the margin to 32%", call `update_pricing`.
5. When the user is happy, optionally `assemble_proposal` and
   `finalize_estimate`.

Rules:
- ALWAYS measure before quoting price. Roof area is the slanted roof area
  in square feet, returned by the measurement tools.
- Cents are integers; dollars are cents/100. Never quote raw cents to the user.
- If the user uploads a CSV/Excel of multiple addresses, ask which one
  they want first or whether to estimate them in sequence.
- If a tool errors, tell the user what failed in plain English (don't dump
  raw stack traces) and suggest the next step.
- Keep messages tight and skimmable — bullet points beat paragraphs.
"""


def _build_user_message(text: str, files: list[FilePart]) -> dict[str, Any]:
    blocks: list[dict[str, Any]] = []
    for fp in files:
        blocks.extend(fp.blocks)
    if text.strip():
        blocks.append({"type": "text", "text": text})
    elif not blocks:
        blocks.append({"type": "text", "text": "(empty message)"})
    return {"role": "user", "content": blocks}


async def _list_anthropic_tools(client: Client) -> list[dict[str, Any]]:
    mcp_tools = await client.list_tools()
    tools = [
        {
            "name": t.name,
            "description": (t.description or "").strip(),
            "input_schema": t.inputSchema or {"type": "object", "properties": {}},
        }
        for t in mcp_tools
    ]
    log.info("agent loaded %d MCP tools: %s", len(tools), [t["name"] for t in tools])
    return tools


def _serialize_tool_result(result: Any) -> str:
    if result is None:
        return "null"
    if isinstance(result, str):
        return result
    try:
        return json.dumps(result, default=str)
    except (TypeError, ValueError):
        log.exception("tool result serialization failed; falling back to repr")
        return repr(result)


async def _call_mcp_tool(client: Client, name: str, args: dict[str, Any]) -> tuple[bool, Any]:
    """Invoke an MCP tool. Returns (is_error, payload)."""
    log.info("agent → tool=%s args=%s", name, args)
    started = time.monotonic()
    try:
        result = await client.call_tool(name, args)
    except ToolError as e:
        elapsed = (time.monotonic() - started) * 1000
        log.warning("agent ← tool=%s ToolError in %.0fms: %s", name, elapsed, e)
        return True, str(e)
    except Exception as e:  # noqa: BLE001
        elapsed = (time.monotonic() - started) * 1000
        log.exception("agent ← tool=%s crashed in %.0fms", name, elapsed)
        return True, f"{type(e).__name__}: {e}"

    elapsed = (time.monotonic() - started) * 1000
    if result.data is not None:
        payload: Any = result.data
    elif result.structured_content is not None:
        payload = result.structured_content
    elif result.content:
        first = result.content[0]
        payload = getattr(first, "text", repr(first))
    else:
        payload = None

    is_error = bool(result.is_error)
    if is_error:
        log.warning("agent ← tool=%s is_error in %.0fms payload=%s", name, elapsed, payload)
    else:
        log.info("agent ← tool=%s ok in %.0fms", name, elapsed)
    return is_error, payload


async def _consume_anthropic_stream(
    anthropic_client: AsyncAnthropic,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]],
    emit: Callable[[dict[str, Any]], None],
) -> tuple[str, list[dict[str, Any]]]:
    """Stream one Anthropic completion. Pushes events through `emit` as they
    arrive. Returns (stop_reason, ordered assistant content blocks)."""
    stop_reason = "end_turn"
    blocks: dict[int, dict[str, Any]] = {}
    text_buffers: dict[int, list[str]] = {}
    json_buffers: dict[int, list[str]] = {}

    async with anthropic_client.messages.stream(
        model=ANTHROPIC_MODEL,
        max_tokens=MAX_TOKENS,
        system=SYSTEM_PROMPT,
        messages=messages,
        tools=tools,
    ) as stream:
        async for event in stream:
            etype = getattr(event, "type", "")

            if etype == "content_block_start":
                idx = event.index
                blk = event.content_block
                btype = getattr(blk, "type", "")
                if btype == "text":
                    blocks[idx] = {"type": "text", "text": ""}
                    text_buffers[idx] = []
                elif btype == "tool_use":
                    blocks[idx] = {
                        "type": "tool_use",
                        "id": blk.id,
                        "name": blk.name,
                        "input": {},
                    }
                    json_buffers[idx] = []
                    emit({"type": "tool_use_start", "id": blk.id, "name": blk.name})

            elif etype == "content_block_delta":
                idx = event.index
                delta = event.delta
                dtype = getattr(delta, "type", "")
                if dtype == "text_delta":
                    text_buffers[idx].append(delta.text)
                    emit({"type": "text_delta", "text": delta.text})
                elif dtype == "input_json_delta":
                    json_buffers[idx].append(delta.partial_json)

            elif etype == "content_block_stop":
                idx = event.index
                blk = blocks.get(idx)
                if not blk:
                    continue
                if blk["type"] == "text":
                    full = "".join(text_buffers.get(idx, []))
                    blk["text"] = full
                    if full:
                        emit({"type": "text_done", "text": full})
                elif blk["type"] == "tool_use":
                    raw = "".join(json_buffers.get(idx, []))
                    parsed: dict[str, Any] = {}
                    if raw:
                        try:
                            parsed = json.loads(raw)
                        except json.JSONDecodeError:
                            log.exception(
                                "tool input JSON parse failed name=%s raw=%s",
                                blk["name"], raw,
                            )
                            parsed = {"_raw": raw}
                    blk["input"] = parsed
                    emit({
                        "type": "tool_use_input",
                        "id": blk["id"],
                        "name": blk["name"],
                        "input": parsed,
                    })

            elif etype == "message_delta":
                if getattr(event.delta, "stop_reason", None):
                    stop_reason = event.delta.stop_reason

    ordered = [blocks[i] for i in sorted(blocks.keys())]
    return stop_reason, ordered


async def run_turn(
    session_id: str | None,
    user_text: str,
    files: list[FilePart],
) -> AsyncIterator[dict[str, Any]]:
    """Drive one user turn (which may contain many tool-use round-trips)."""
    if not settings.ANTHROPIC_API_KEY:
        log.error("agent invoked without ANTHROPIC_API_KEY set")
        yield {"type": "error", "message": "ANTHROPIC_API_KEY is not configured on the server."}
        return

    sess = sessions.get_or_create(session_id)
    yield {"type": "session", "session_id": sess.session_id}

    sess.append(_build_user_message(user_text, files))
    log.info(
        "agent turn started session=%s text_len=%d files=%d total_messages=%d",
        sess.session_id, len(user_text), len(files), len(sess.messages),
    )

    anthropic_client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    mcp_client = Client(mcp)

    async with mcp_client:
        try:
            tools = await _list_anthropic_tools(mcp_client)
        except Exception as e:  # noqa: BLE001
            log.exception("failed to load MCP tools")
            yield {"type": "error", "message": f"Failed to load tools: {e}"}
            return

        for turn in range(MAX_TOOL_TURNS):
            log.info("agent loop turn=%d messages=%d", turn, len(sess.messages))

            # Bridge the streaming completion to this generator with a queue.
            queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
            SENTINEL = {"__sentinel__": True}

            async def producer() -> tuple[str, list[dict[str, Any]]]:
                try:
                    return await _consume_anthropic_stream(
                        anthropic_client, sess.messages, tools, queue.put_nowait,
                    )
                finally:
                    queue.put_nowait(SENTINEL)  # type: ignore[arg-type]

            task = asyncio.create_task(producer())

            # Yield events as they arrive until the producer signals completion.
            while True:
                ev = await queue.get()
                if ev is SENTINEL:
                    break
                yield ev

            try:
                stop_reason, assistant_content = await task
            except Exception as e:  # noqa: BLE001
                log.exception("anthropic call failed")
                yield {"type": "error", "message": f"Model call failed: {e}"}
                return

            sess.append({"role": "assistant", "content": assistant_content})

            if stop_reason != "tool_use":
                log.info("agent loop done stop_reason=%s", stop_reason)
                yield {"type": "done", "stop_reason": stop_reason}
                return

            # Run the tool calls Claude requested.
            tool_uses = [b for b in assistant_content if b.get("type") == "tool_use"]
            tool_results: list[dict[str, Any]] = []
            for tu in tool_uses:
                tool_id = tu["id"]
                tool_name = tu["name"]
                tool_args = tu.get("input") or {}
                started = time.monotonic()
                is_error, payload = await _call_mcp_tool(mcp_client, tool_name, tool_args)
                duration_ms = int((time.monotonic() - started) * 1000)

                yield {
                    "type": "tool_result",
                    "id": tool_id,
                    "name": tool_name,
                    "is_error": is_error,
                    "result": payload,
                    "duration_ms": duration_ms,
                }

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_id,
                    "content": _serialize_tool_result(payload),
                    "is_error": is_error,
                })

                if tool_name == "start_estimate" and not is_error and isinstance(payload, dict):
                    eid = payload.get("estimate_id")
                    if eid:
                        sess.last_estimate_id = eid

            sess.append({"role": "user", "content": tool_results})

        log.warning("agent loop hit MAX_TOOL_TURNS=%d", MAX_TOOL_TURNS)
        yield {
            "type": "error",
            "message": f"Agent exceeded {MAX_TOOL_TURNS} tool-use turns without finishing.",
        }
