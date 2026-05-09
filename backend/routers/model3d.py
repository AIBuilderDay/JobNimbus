import base64
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from logger import get_logger
from services.google.street_view import get_building_images
from services.image_cleanup import clean_images
from services.replicate import generate_3d_model
from services.tripo import generate_segmented_mesh
from settings import settings

log = get_logger(__name__)
router = APIRouter(prefix="/api/model3d")

_models: dict[str, dict[str, Any]] = {}


class CaptureRequest(BaseModel):
    estimate_id: str
    lat: float
    lng: float


class CaptureResponse(BaseModel):
    estimate_id: str
    images: list[str]


class ConfirmRequest(BaseModel):
    estimate_id: str
    selected_indices: list[int]


class ModelStatus(BaseModel):
    estimate_id: str
    status: str
    error: str | None = None


async def _run_generation(estimate_id: str, images: list[bytes]):
    try:
        _models[estimate_id]["status"] = "cleaning"
        images = await clean_images(images)

        _models[estimate_id]["status"] = "generating"
        glb_bytes = await generate_3d_model(images)

        _models[estimate_id]["status"] = "completed"
        _models[estimate_id]["glb"] = glb_bytes
    except Exception as e:
        _models[estimate_id]["status"] = "failed"
        _models[estimate_id]["error"] = f"Generation failed: {e}"


async def _run_full_pipeline(estimate_id: str, lat: float, lng: float):
    try:
        _models[estimate_id]["status"] = "capturing"
        images = await get_building_images(lat, lng, num_views=4)

        _models[estimate_id]["status"] = "cleaning"
        images = await clean_images(images)

        _models[estimate_id]["status"] = "generating"
        glb_bytes = await generate_3d_model(images)

        _models[estimate_id]["status"] = "completed"
        _models[estimate_id]["glb"] = glb_bytes
    except Exception as e:
        _models[estimate_id]["status"] = "failed"
        _models[estimate_id]["error"] = str(e)


class GenerateRequest(BaseModel):
    estimate_id: str
    lat: float
    lng: float


@router.post("/generate")
async def generate(req: GenerateRequest, background_tasks: BackgroundTasks) -> ModelStatus:
    log.info("POST /api/model3d/generate estimate_id=%s lat=%s lng=%s", req.estimate_id, req.lat, req.lng)
    if not settings.GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=503, detail="Google Maps API key is not configured.")

    _models[req.estimate_id] = {"status": "pending", "glb": None, "error": None}
    background_tasks.add_task(_run_full_pipeline, req.estimate_id, req.lat, req.lng)
    return ModelStatus(estimate_id=req.estimate_id, status="pending")


@router.post("/capture")
async def capture_images(req: CaptureRequest) -> CaptureResponse:
    log.info("POST /api/model3d/capture estimate_id=%s lat=%s lng=%s", req.estimate_id, req.lat, req.lng)
    if not settings.GOOGLE_MAPS_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Google Maps API key is not configured.",
        )

    try:
        images = await get_building_images(req.lat, req.lng, num_views=4)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    b64_images = [base64.b64encode(img).decode() for img in images]

    _models[req.estimate_id] = {
        "status": "review",
        "glb": None,
        "error": None,
        "captured_images": images,
    }

    return CaptureResponse(estimate_id=req.estimate_id, images=b64_images)


@router.post("/confirm")
async def confirm_generation(
    req: ConfirmRequest,
    background_tasks: BackgroundTasks,
) -> ModelStatus:
    entry = _models.get(req.estimate_id)
    if not entry or "captured_images" not in entry:
        raise HTTPException(status_code=404, detail="No captured images found. Run /capture first.")

    all_images: list[bytes] = entry["captured_images"]

    if req.selected_indices:
        selected = []
        for i in req.selected_indices:
            if 0 <= i < len(all_images):
                selected.append(all_images[i])
        if not selected:
            raise HTTPException(status_code=400, detail="No valid image indices provided.")
        images_to_use = selected
    else:
        images_to_use = all_images

    entry["status"] = "pending"
    background_tasks.add_task(_run_generation, req.estimate_id, images_to_use)
    return ModelStatus(estimate_id=req.estimate_id, status="pending")


@router.get("/{estimate_id}/status")
def get_model_status(estimate_id: str) -> ModelStatus:
    entry = _models.get(estimate_id)
    if not entry:
        raise HTTPException(status_code=404, detail="No model generation found")
    return ModelStatus(
        estimate_id=estimate_id,
        status=entry["status"],
        error=entry.get("error"),
    )


@router.get("/{estimate_id}/model.glb")
def get_model_file(estimate_id: str) -> Response:
    entry = _models.get(estimate_id)
    if not entry or entry["status"] != "completed" or not entry.get("glb"):
        raise HTTPException(status_code=404, detail="Model not ready")
    return Response(
        content=entry["glb"],
        media_type="model/gltf-binary",
        headers={"Content-Disposition": f'attachment; filename="{estimate_id}.glb"'},
    )


# --- Tripo3D segmented mesh endpoints ---


class TripoGenerateRequest(BaseModel):
    estimate_id: str
    images: list[str]  # base64-encoded images


async def _run_tripo_pipeline(estimate_id: str, images: list[bytes]):
    try:
        _models[estimate_id]["status"] = "generating"
        glb_bytes = await generate_segmented_mesh(images)
        _models[estimate_id]["status"] = "completed"
        _models[estimate_id]["glb"] = glb_bytes
    except Exception as e:
        log.exception("tripo pipeline failed estimate_id=%s", estimate_id)
        _models[estimate_id]["status"] = "failed"
        _models[estimate_id]["error"] = str(e)


@router.post("/tripo/generate")
async def tripo_generate(req: TripoGenerateRequest, background_tasks: BackgroundTasks) -> ModelStatus:
    log.info("POST /api/model3d/tripo/generate estimate_id=%s images=%d", req.estimate_id, len(req.images))
    if not settings.TRIPO3D_API_KEY:
        raise HTTPException(status_code=503, detail="Tripo3D API key is not configured.")
    if not req.images:
        raise HTTPException(status_code=400, detail="At least one image required.")

    image_bytes = []
    for i, b64 in enumerate(req.images):
        try:
            image_bytes.append(base64.b64decode(b64))
        except Exception:
            raise HTTPException(status_code=400, detail=f"Invalid base64 in image at index {i}")

    _models[req.estimate_id] = {"status": "pending", "glb": None, "error": None}
    background_tasks.add_task(_run_tripo_pipeline, req.estimate_id, image_bytes)
    return ModelStatus(estimate_id=req.estimate_id, status="pending")


class TripoGenerateFromCoordsRequest(BaseModel):
    estimate_id: str
    lat: float
    lng: float


async def _run_tripo_full_pipeline(estimate_id: str, lat: float, lng: float):
    try:
        _models[estimate_id]["status"] = "capturing"
        images = await get_building_images(lat, lng, num_views=4)

        _models[estimate_id]["status"] = "cleaning"
        images = await clean_images(images)

        _models[estimate_id]["status"] = "generating"
        glb_bytes = await generate_segmented_mesh(images)

        _models[estimate_id]["status"] = "completed"
        _models[estimate_id]["glb"] = glb_bytes
    except Exception as e:
        log.exception("tripo full pipeline failed estimate_id=%s", estimate_id)
        _models[estimate_id]["status"] = "failed"
        _models[estimate_id]["error"] = str(e)


@router.post("/tripo/generate-from-coords")
async def tripo_generate_from_coords(
    req: TripoGenerateFromCoordsRequest,
    background_tasks: BackgroundTasks,
) -> ModelStatus:
    log.info("POST /api/model3d/tripo/generate-from-coords estimate_id=%s lat=%s lng=%s", req.estimate_id, req.lat, req.lng)
    if not settings.TRIPO3D_API_KEY:
        raise HTTPException(status_code=503, detail="Tripo3D API key is not configured.")
    if not settings.GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=503, detail="Google Maps API key is not configured.")

    _models[req.estimate_id] = {"status": "pending", "glb": None, "error": None}
    background_tasks.add_task(_run_tripo_full_pipeline, req.estimate_id, req.lat, req.lng)
    return ModelStatus(estimate_id=req.estimate_id, status="pending")
