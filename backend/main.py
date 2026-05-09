from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import aerial, estimate, places

app = FastAPI()

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
