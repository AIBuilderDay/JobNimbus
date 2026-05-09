/**
 * Rotate a (lng, lat) point clockwise around (centerLng, centerLat) by `azimuthDegrees`.
 * Compass convention: 0° = north, 90° = east, 180° = south, 270° = west.
 *
 * Applies a Mercator-aware longitude scale so 1° of lng matches 1° of lat in real distance
 * at the rotation center's latitude. Without this, rotated polygons get distorted
 * (squashed E-W) at non-equatorial latitudes.
 */
export function rotateLngLat(
  lng: number,
  lat: number,
  centerLng: number,
  centerLat: number,
  azimuthDegrees: number,
): [number, number] {
  const rad = (azimuthDegrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const lngScale = Math.cos((centerLat * Math.PI) / 180) || 1e-9;

  const dx = (lng - centerLng) * lngScale;
  const dy = lat - centerLat;

  // Clockwise rotation (compass convention)
  const rx = dx * cos + dy * sin;
  const ry = -dx * sin + dy * cos;

  return [centerLng + rx / lngScale, centerLat + ry];
}

/**
 * Returns the four bbox corners (SW, SE, NE, NW) optionally rotated around the segment center
 * by `azimuthDegrees`. Each corner is `[lng, lat]`.
 */
export function rotatedBboxCorners(
  bbox: { sw: { latitude: number; longitude: number }; ne: { latitude: number; longitude: number } },
  center: { latitude: number; longitude: number },
  azimuthDegrees: number | null | undefined,
): [number, number][] {
  const corners: [number, number][] = [
    [bbox.sw.longitude, bbox.sw.latitude],
    [bbox.ne.longitude, bbox.sw.latitude],
    [bbox.ne.longitude, bbox.ne.latitude],
    [bbox.sw.longitude, bbox.ne.latitude],
  ];
  if (!azimuthDegrees) return corners;
  return corners.map(([lng, lat]) =>
    rotateLngLat(lng, lat, center.longitude, center.latitude, azimuthDegrees),
  );
}
