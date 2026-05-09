import asyncio
import base64

import httpx

from logger import get_logger
from settings import settings

log = get_logger(__name__)

TRIPO_API_BASE = "https://api.tripo3d.ai/v2/openapi"


def _auth_headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.TRIPO3D_API_KEY}",
        "Content-Type": "application/json",
    }


async def upload_image(image_bytes: bytes, filename: str = "image.png") -> str:
    """Upload image to Tripo, return file token."""
    log.info("tripo upload_image filename=%s bytes=%d", filename, len(image_bytes))
    url = f"{TRIPO_API_BASE}/upload"

    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "png"
    content_type = f"image/{ext}" if ext in ("png", "jpeg", "jpg", "webp") else "image/png"

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            url,
            headers={"Authorization": f"Bearer {settings.TRIPO3D_API_KEY}"},
            files={"file": (filename, image_bytes, content_type)},
        )

    resp.raise_for_status()
    data = resp.json()["data"]
    token = data["image_token"]
    log.info("tripo upload_image token=%s", token)
    return token


async def create_image_to_model_task(
    image_token: str,
    *,
    generate_parts: bool = True,
) -> str:
    """Create image-to-3D task. Returns task_id."""
    log.info("tripo create_task token=%s generate_parts=%s", image_token, generate_parts)

    body: dict = {
        "type": "image_to_model",
        "file": {"type": "jpg", "file_token": image_token},
    }

    if generate_parts:
        body["generate_parts"] = True
        body["texture"] = False
        body["pbr"] = False
    else:
        body["texture"] = True
        body["pbr"] = True

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{TRIPO_API_BASE}/task",
            headers=_auth_headers(),
            json=body,
        )

    resp.raise_for_status()
    task_id = resp.json()["data"]["task_id"]
    log.info("tripo task created task_id=%s", task_id)
    return task_id


async def create_multiview_task(
    image_tokens: list[str],
    *,
    generate_parts: bool = True,
) -> str:
    """Create multiview-to-3D task from multiple image tokens."""
    log.info("tripo create_multiview_task tokens=%d generate_parts=%s", len(image_tokens), generate_parts)

    files = [{"type": "jpg", "file_token": t} for t in image_tokens]

    body: dict = {
        "type": "multiview_to_model",
        "files": files,
    }

    if generate_parts:
        body["generate_parts"] = True
        body["texture"] = False
        body["pbr"] = False
    else:
        body["texture"] = True
        body["pbr"] = True

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{TRIPO_API_BASE}/task",
            headers=_auth_headers(),
            json=body,
        )

    resp.raise_for_status()
    task_id = resp.json()["data"]["task_id"]
    log.info("tripo multiview task created task_id=%s", task_id)
    return task_id


async def poll_task(
    task_id: str,
    timeout: float = 600.0,
    interval: float = 5.0,
) -> dict:
    """Poll task until terminal state. Returns full task data."""
    url = f"{TRIPO_API_BASE}/task/{task_id}"
    headers = _auth_headers()

    elapsed = 0.0
    async with httpx.AsyncClient(timeout=10.0) as client:
        while elapsed < timeout:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            data = resp.json()["data"]

            status = data.get("status")
            progress = data.get("progress", 0)
            log.info("tripo poll task_id=%s status=%s progress=%s elapsed=%.1fs", task_id, status, progress, elapsed)

            if status == "success":
                return data
            if status in ("failed", "cancelled", "unknown"):
                error = data.get("message", "Unknown error")
                log.error("tripo task %s task_id=%s error=%s", status, task_id, error)
                raise RuntimeError(f"Tripo task {status}: {error}")

            await asyncio.sleep(interval)
            elapsed += interval

    log.error("tripo task timed out task_id=%s timeout=%.1fs", task_id, timeout)
    raise TimeoutError(f"Tripo task {task_id} timed out after {timeout}s")


async def download_model(model_url: str) -> bytes:
    """Download GLB from Tripo output URL."""
    log.info("tripo download_model url=%s", model_url[:80])
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.get(model_url)
    resp.raise_for_status()
    log.info("tripo download_model bytes=%d", len(resp.content))
    return resp.content


async def generate_segmented_mesh(images: list[bytes]) -> bytes:
    """End-to-end: upload images → create task → poll → download GLB."""
    tokens = []
    for i, img in enumerate(images):
        token = await upload_image(img, f"image_{i}.png")
        tokens.append(token)

    if len(tokens) == 1:
        task_id = await create_image_to_model_task(tokens[0], generate_parts=True)
    else:
        task_id = await create_multiview_task(tokens, generate_parts=True)

    result = await poll_task(task_id)

    output = result.get("output", {})
    model_url = output.get("model")
    if not model_url:
        rendered = result.get("rendered_image")
        raise RuntimeError(f"Tripo task succeeded but no model URL. Keys: {list(output.keys())}")

    return await download_model(model_url)
