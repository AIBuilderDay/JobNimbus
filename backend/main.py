from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from dao.database import init_db, get_connection
from logger import get_logger
from routers import aerial, catalog, estimate, listings, places, model3d, proposal, roof_polygons

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("backend starting")
    init_db()
    _seed_if_empty()
    yield
    log.info("backend shutting down")


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "message": "FastAPI backend running"}


app.include_router(estimate.router)
app.include_router(listings.router)
app.include_router(catalog.router)
app.include_router(places.router)
app.include_router(aerial.router)
app.include_router(model3d.router)
app.include_router(proposal.router)
app.include_router(roof_polygons.router)
