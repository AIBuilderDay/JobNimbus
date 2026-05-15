import { GeoJsonLayer } from "@deck.gl/layers";
import { _TerrainExtension as TerrainExtension } from "@deck.gl/extensions";
import type { RoofSegment } from "../types/solar";

function isValidCoord(c: number[]): boolean {
  const [lng, lat] = c;
  return (
    Number.isFinite(lng) && Number.isFinite(lat) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
}

function segmentToCoords(
  segment: RoofSegment,
): number[][] | null {
  if (segment.polygon && segment.polygon.length >= 3) {
    if (segment.polygon.every(isValidCoord)) return segment.polygon;
    return null;
  }
  if (!segment.bounding_box) return null;
  const { sw, ne } = segment.bounding_box;
  if (
    !Number.isFinite(sw.latitude) || !Number.isFinite(sw.longitude) ||
    !Number.isFinite(ne.latitude) || !Number.isFinite(ne.longitude)
  ) return null;
  return [
    [sw.longitude, sw.latitude, 0],
    [ne.longitude, sw.latitude, 0],
    [ne.longitude, ne.latitude, 0],
    [sw.longitude, ne.latitude, 0],
    [sw.longitude, sw.latitude, 0],
  ];
}

function segmentColor(
  isSelected: boolean,
  area: number,
): [number, number, number, number] {
  if (isSelected) return [56, 104, 198, 180];
  const t = Math.min(1, Math.max(0, (area - 50) / 500));
  const r = Math.round(40 + t * 215);
  const g = Math.round(80 + t * 140);
  const b = Math.round(180 - t * 140);
  return [r, g, b, 140];
}

interface SegmentFeatureProps {
  index: number;
  area: number;
}

export function createRoofSegmentLayer(
  segments: RoofSegment[],
  selectedIndices: number[],
) {
  const selectedSet = new Set(selectedIndices);

  const features = segments
    .map((seg, idx) => {
      const coords = segmentToCoords(seg);
      if (!coords) {
        console.warn(`[roofSegmentLayer] segment ${idx} skipped: polygon=${!!seg.polygon} bounding_box=${!!seg.bounding_box}`, seg);
        return null;
      }
      return {
        type: "Feature" as const,
        geometry: {
          type: "Polygon" as const,
          coordinates: [coords],
        },
        properties: { index: idx, area: seg.area_sq_ft },
      };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  return new GeoJsonLayer<SegmentFeatureProps>({
    id: "roof-segments",
    data: {
      type: "FeatureCollection",
      features,
    },
    extensions: [new TerrainExtension()],
    parameters: { depthCompare: "always" },
    getFillColor: (f) => segmentColor(selectedSet.has(f.properties.index), f.properties.area),
    getLineColor: (f) =>
      selectedSet.has(f.properties.index)
        ? [56, 104, 198, 255]
        : [255, 255, 255, 120],
    getLineWidth: 2,
    lineWidthUnits: "pixels",
    filled: true,
    stroked: true,
    pickable: true,
    autoHighlight: true,
    highlightColor: [76, 133, 229, 100],
    updateTriggers: {
      getFillColor: [selectedIndices],
      getLineColor: [selectedIndices],
    },
  });
}
