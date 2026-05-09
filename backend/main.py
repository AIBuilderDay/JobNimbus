from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from logger import get_logger
from routers import aerial, estimate, places, model3d

log = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("backend starting")
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
app.include_router(places.router)
app.include_router(aerial.router)
app.include_router(model3d.router)
