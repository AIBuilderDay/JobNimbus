import asyncio
import base64
import logging

import httpx

from config import get_replicate_api_token

logger = logging.getLogger(__name__)

REPLICATE_API_BASE = "https://api.replicate.com/v1"
CLEANUP_MODEL = "black-forest-labs/flux-kontext-dev"

CLEANUP_PROMPT = (
    "Remove all trees, bushes, vegetation, cars, trucks, and vehicles from this "
    "street view photo. Fill removed areas with sky, pavement, or wall. Keep the "
    "building and all architectural details exactly as they are."
)

_semaphore = asyncio.Semaphore(3)


def _image_to_data_uri(img_bytes: bytes) -> str:
    b64 = base64.b64encode(img_bytes).decode()
    return f"data:image/jpeg;base64,{b64}"


async def clean_image(image_bytes: bytes) -> bytes:
    token = get_replicate_api_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    input_data = {
        "prompt": CLEANUP_PROMPT,
        "input_image": _image_to_data_uri(image_bytes),
        "aspect_ratio": "match_input_image",
        "output_format": "jpg",
        "steps": 20,
        "guidance": 4.0,
    }

    url = f"{REPLICATE_API_BASE}/models/{CLEANUP_MODEL}/predictions"

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json={"input": input_data}, headers=headers)
    resp.raise_for_status()
    prediction_id = resp.json()["id"]

    poll_url = f"{REPLICATE_API_BASE}/predictions/{prediction_id}"
    elapsed = 0.0
    async with httpx.AsyncClient(timeout=10.0) as client:
        while elapsed < 120.0:
            resp = await client.get(poll_url, headers={"Authorization": f"Bearer {token}"})
            resp.raise_for_status()
            data = resp.json()

            status = data.get("status")
            if status == "succeeded":
                output = data.get("output")
                if not output:
                    raise RuntimeError("Cleanup succeeded but no output URL")
                image_url = output if isinstance(output, str) else output[0]
                dl_resp = await client.get(image_url)
                dl_resp.raise_for_status()
                return dl_resp.content
            if status in ("failed", "canceled"):
                raise RuntimeError(f"Cleanup {status}: {data.get('error', 'Unknown')}")

            await asyncio.sleep(2.0)
            elapsed += 2.0

    raise TimeoutError(f"Cleanup prediction {prediction_id} timed out")


async def clean_images(images: list[bytes]) -> list[bytes]:
    if len(images) <= 1:
        return images

    # Last image is satellite top-down — skip cleanup
    street_images = images[:-1]
    satellite = images[-1]

    async def _clean_one(idx: int, img: bytes) -> tuple[int, bytes]:
        async with _semaphore:
            try:
                cleaned = await clean_image(img)
                return idx, cleaned
            except Exception as e:
                logger.warning("Image cleanup failed for index %d: %s", idx, e)
                return idx, img

    tasks = [_clean_one(i, img) for i, img in enumerate(street_images)]
    results = await asyncio.gather(*tasks)

    cleaned = [img for _, img in sorted(results, key=lambda x: x[0])]
    cleaned.append(satellite)
    return cleaned
