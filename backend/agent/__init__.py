"""Agent package — Anthropic-powered roofing assistant + FastMCP tool surface.

The agent loop lives in `runner.py`. The MCP tool definitions (which double
as Anthropic tools) live in `mcp_server.py`. File ingestion (PDF / CSV /
Excel / image) lives in `files.py`. Conversation memory lives in
`sessions.py`.
"""

from agent.mcp_server import mcp  # re-exported so main.py can mount it

__all__ = ["mcp"]
