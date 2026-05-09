from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from agent import mcp as mcp_server
from dao.database import init_db, get_connection
from logger import get_logger
from routers import (
    aerial,
    agent,
    benchmark,
    blueprint,
    catalog,
    estimate,
    finalize,
    listings,
    measurement,
    model3d,
    places,
    pricing,
    proposal,
    roof_polygons,
)

log = get_logger(__name__)


def _seed_if_empty() -> None:
    """Seed reference/demo data when tables exist but are empty."""
    with get_connection() as conn:
        count = conn.execute("SELECT COUNT(*) FROM catalog_items").fetchone()[0]
    if count > 0:
        log.info("seed skip — catalog_items already populated (%d rows)", count)
        return
    log.info("seed — tables empty, running seed script")
    from scripts.seed import seed
    seed()


# Mount FastMCP at /mcp so external MCP clients (Claude Desktop, Cursor, …)
# can drive the same tool surface the agent uses internally. http_app() must
# share its lifespan with FastAPI for the streamable-HTTP session manager to
# initialize correctly.
mcp_asgi = mcp_server.http_app(path="/mcp")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("backend starting")
    init_db()
    _seed_if_empty()
    # Run the FastMCP lifespan alongside ours so the MCP session manager spins up.
    async with mcp_asgi.lifespan(app):
        yield
    log.info("backend shutting down")


app = FastAPI(
    title="JobNimbus AI Roofing API",
    version="0.1.0",
    description=(
        "Endpoints for the AI roofing estimator. Group quick reference:\n\n"
        "- **measurement** — generic Solar lookup for any address\n"
        "- **benchmark** — live qualification proof against 5 reference properties\n"
        "- **estimate** — start/get/refine an estimate session\n"
        "- **pricing / proposal / finalize** — cost & document lifecycle\n"
        "- **blueprint** — wireframe roof geometry\n"
        "- **listings / catalog / places / aerial / roof-polygons / model3d** — supporting data"
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    # 5173 is Vite's default; 5174 is what `pnpm dev` uses per package.json.
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["health"])
def health():
    return {"status": "ok", "message": "FastAPI backend running"}


# Core flow
app.include_router(measurement.router)
app.include_router(benchmark.router)
app.include_router(estimate.router)
app.include_router(pricing.router)
app.include_router(proposal.router)
app.include_router(finalize.router)
app.include_router(blueprint.router)

# Supporting
app.include_router(listings.router)
app.include_router(catalog.router)
app.include_router(places.router)
app.include_router(aerial.router)
app.include_router(model3d.router)
app.include_router(roof_polygons.router)

# Agent — chat + file ingestion. SSE streamed.
app.include_router(agent.router)

# MCP server — same tool surface the agent uses, exposed for external clients.
app.mount("/mcp", mcp_asgi)
