import asyncio
import base64

import httpx

from config import get_replicate_api_token

REPLICATE_API_BASE = "https://api.replicate.com/v1"
MODEL = "tencent/hunyuan-3d-3.1"


def _image_to_data_uri(img_bytes: bytes) -> str:
    b64 = base64.b64encode(img_bytes).decode()
    return f"data:image/jpeg;base64,{b64}"


async def create_prediction(images: list[bytes]) -> str:
    """Submit a Hunyuan3D prediction. Returns prediction ID."""
    token = get_replicate_api_token()

    input_data: dict = {
        "image": _image_to_data_uri(images[0]),
        "output_format": "glb",
        "remove_background": True,
        "foreground_ratio": 0.85,
    }

    if len(images) > 1:
        input_data["mv_images"] = [_image_to_data_uri(img) for img in images[1:]]

    url = f"{REPLICATE_API_BASE}/models/{MODEL}/predictions"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json={"input": input_data}, headers=headers)

    resp.raise_for_status()
    return resp.json()["id"]


async def poll_prediction(
    prediction_id: str,
    timeout: float = 300.0,
    interval: float = 3.0,
) -> dict:
    """Poll prediction until complete. Returns full prediction response."""
    token = get_replicate_api_token()
    url = f"{REPLICATE_API_BASE}/predictions/{prediction_id}"
    headers = {"Authorization": f"Bearer {token}"}

    elapsed = 0.0
    async with httpx.AsyncClient(timeout=10.0) as client:
        while elapsed < timeout:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            data = resp.json()

            status = data.get("status")
            if status == "succeeded":
                return data
            if status in ("failed", "canceled"):
                error = data.get("error", "Unknown error")
                raise RuntimeError(f"Prediction {status}: {error}")

            await asyncio.sleep(interval)
            elapsed += interval

    raise TimeoutError(f"Prediction {prediction_id} timed out after {timeout}s")


async def download_model(model_url: str) -> bytes:
    """Download generated GLB from Replicate output URL."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(model_url)
    resp.raise_for_status()
    return resp.content


async def generate_3d_model(images: list[bytes]) -> bytes:
    """End-to-end: submit prediction, poll, download GLB. Returns GLB bytes."""
    prediction_id = await create_prediction(images)
    result = await poll_prediction(prediction_id)

    output = result.get("output")
    if not output:
        raise RuntimeError("Prediction succeeded but no output URL returned")

    # Output can be a string URL or a list of URLs
    model_url = output if isinstance(output, str) else output[0]
    return await download_model(model_url)
