"""In-memory chat session store for the agent.

Hackathon-grade: a module-level dict, ephemeral with the process. The
session holds the running list of Anthropic message dicts (with tool_use /
tool_result blocks already interleaved) so the next turn can be sent
straight back to `messages.create`.

If we ever want to persist conversations, the right move is to swap the
module-level dict for a DAO that round-trips this same shape.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any

from logger import get_logger

log = get_logger(__name__)


@dataclass
class Session:
    session_id: str
    messages: list[dict[str, Any]] = field(default_factory=list)
    last_estimate_id: str | None = None  # most recently created estimate, for convenience

    def append(self, message: dict[str, Any]) -> None:
        self.messages.append(message)


_sessions: dict[str, Session] = {}


def get_or_create(session_id: str | None) -> Session:
    """Return the session for `session_id`, creating one if missing or None."""
    if session_id and session_id in _sessions:
        return _sessions[session_id]
    sid = session_id or str(uuid.uuid4())
    sess = Session(session_id=sid)
    _sessions[sid] = sess
    log.info("agent session created id=%s (total=%d)", sid, len(_sessions))
    return sess


def get(session_id: str) -> Session | None:
    return _sessions.get(session_id)


def reset(session_id: str) -> bool:
    if session_id in _sessions:
        del _sessions[session_id]
        log.info("agent session reset id=%s", session_id)
        return True
    return False
