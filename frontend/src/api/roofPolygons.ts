interface SegmentPolygon {
  segment_id: number;
  polygon: [number, number, number][];
}

interface RoofPolygonsResponse {
  polygons: SegmentPolygon[];
}

export async function fetchRoofPolygons(
  lat: number,
  lng: number,
): Promise<RoofPolygonsResponse | null> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lng: lng.toString(),
  });

  const res = await fetch(`/api/roof-polygons?${params}`);
  if (!res.ok) return null;
  return res.json();
}
