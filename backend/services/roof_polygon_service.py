import io

import numpy as np
import tifffile

from logger import get_logger

log = get_logger(__name__)


def _parse_geotiff(data: bytes) -> tuple[np.ndarray, dict]:
    """Read GeoTIFF bytes → (pixel_array, geo_transform)."""
    with tifffile.TiffFile(io.BytesIO(data)) as tif:
        page = tif.pages[0]
        array = page.asarray()

        tags = page.tags
        scale_tag = tags.get("ModelPixelScaleTag") or tags.get(33550)
        tie_tag = tags.get("ModelTiepointTag") or tags.get(33922)

        if scale_tag and tie_tag:
            scale = scale_tag.value
            tie = tie_tag.value
            gt = {
                "ox": float(tie[3]),
                "oy": float(tie[4]),
                "pi": float(tie[0]),
                "pj": float(tie[1]),
                "sx": float(scale[0]),
                "sy": float(scale[1]),
            }
        else:
            log.warning("GeoTIFF missing geo-transform tags, using identity")
            gt = {"ox": 0, "oy": 0, "pi": 0, "pj": 0, "sx": 1, "sy": 1}

    return array, gt


def _px_to_lnglat(col: float, row: float, gt: dict) -> tuple[float, float]:
    lng = gt["ox"] + (col - gt["pi"]) * gt["sx"]
    lat = gt["oy"] - (row - gt["pj"]) * gt["sy"]
    return lng, lat


def _lnglat_to_px(lng: float, lat: float, gt: dict) -> tuple[float, float]:
    col = (lng - gt["ox"]) / gt["sx"] + gt["pi"]
    row = (gt["oy"] - lat) / gt["sy"] + gt["pj"]
    return col, row


def _boundary_pixels(mask: np.ndarray, seg_id: int) -> np.ndarray | None:
    """Get ordered boundary pixel coords for a segment mask value."""
    binary = mask == seg_id
    if not binary.any():
        return None

    padded = np.pad(binary, 1, mode="constant", constant_values=False)
    interior = (
        binary
        & padded[:-2, 1:-1]
        & padded[2:, 1:-1]
        & padded[1:-1, :-2]
        & padded[1:-1, 2:]
    )
    boundary = binary & ~interior

    rows, cols = np.where(boundary)
    if len(rows) < 3:
        return None

    cy, cx = rows.mean(), cols.mean()
    angles = np.arctan2(rows - cy, cols - cx)
    order = np.argsort(angles)

    pts = np.column_stack([cols[order], rows[order]])

    n = len(pts)
    if n > 80:
        indices = np.linspace(0, n - 1, 80, dtype=int)
        pts = pts[indices]

    return pts


def _douglas_peucker(pts: np.ndarray, epsilon: float) -> np.ndarray:
    """Simplify polyline with Douglas-Peucker."""
    if len(pts) <= 2:
        return pts

    start, end = pts[0].astype(float), pts[-1].astype(float)
    line_vec = end - start
    line_len = np.linalg.norm(line_vec)

    if line_len < 1e-12:
        return pts[[0]]

    dists = np.abs(np.cross(line_vec, start - pts.astype(float))) / line_len
    dists[0] = dists[-1] = 0
    max_idx = int(np.argmax(dists))

    if dists[max_idx] > epsilon:
        left = _douglas_peucker(pts[: max_idx + 1], epsilon)
        right = _douglas_peucker(pts[max_idx:], epsilon)
        return np.vstack([left[:-1], right])

    return pts[[0, -1]]


def extract_roof_polygons(
    mask_bytes: bytes,
    dsm_bytes: bytes,
) -> list[dict]:
    """Extract precise polygons from mask + DSM GeoTIFFs.

    Returns list of {"segment_id": int, "polygon": [[lng, lat, height], ...]}.
    """
    mask, mask_gt = _parse_geotiff(mask_bytes)
    dsm, dsm_gt = _parse_geotiff(dsm_bytes)

    log.info("mask shape=%s dtype=%s  dsm shape=%s dtype=%s", mask.shape, mask.dtype, dsm.shape, dsm.dtype)

    unique_ids = np.unique(mask)
    unique_ids = unique_ids[unique_ids > 0]
    log.info("mask segment ids: %s", unique_ids.tolist())

    results = []

    for seg_id in unique_ids:
        seg_id_int = int(seg_id)
        px_pts = _boundary_pixels(mask, seg_id_int)
        if px_pts is None:
            continue

        lnglat_pts = np.array([_px_to_lnglat(c, r, mask_gt) for c, r in px_pts])

        simplified = _douglas_peucker(lnglat_pts, epsilon=0.000003)

        polygon = []
        h, w = dsm.shape[:2]
        for lng, lat in simplified:
            dc, dr = _lnglat_to_px(lng, lat, dsm_gt)
            dr_i = int(np.clip(round(dr), 0, h - 1))
            dc_i = int(np.clip(round(dc), 0, w - 1))
            height = float(dsm[dr_i, dc_i])
            polygon.append([round(float(lng), 8), round(float(lat), 8), round(height, 2)])

        if len(polygon) >= 3:
            if polygon[0] != polygon[-1]:
                polygon.append(polygon[0])
            results.append({
                "segment_id": seg_id_int - 1,
                "polygon": polygon,
            })

    log.info("extracted %d segment polygons", len(results))
    return results
