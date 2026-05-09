import { PolygonLayer } from "@deck.gl/layers";
import { _TerrainExtension as TerrainExtension } from "@deck.gl/extensions";
import type { RoofSegment } from "../types/solar";

function segmentToPolygon(
  segment: RoofSegment,
): [number, number, number][] | null {
  if (segment.polygon && segment.polygon.length >= 3) {
    return segment.polygon as [number, number, number][];
  }
  if (!segment.bounding_box) return null;
  const { sw, ne } = segment.bounding_box;
  return [
    [sw.longitude, sw.latitude, 0],
    [ne.longitude, sw.latitude, 0],
    [ne.longitude, ne.latitude, 0],
    [sw.longitude, ne.latitude, 0],
  ];
}

function segmentColor(
  segment: RoofSegment,
  isSelected: boolean,
): [number, number, number, number] {
  if (isSelected) return [56, 104, 198, 180];

  const area = segment.area_sq_ft;
  const t = Math.min(1, Math.max(0, (area - 50) / 500));

  const r = Math.round(40 + t * 215);
  const g = Math.round(80 + t * 140);
  const b = Math.round(180 - t * 140);
  return [r, g, b, 140];
}

export function createRoofSegmentLayer(
  segments: RoofSegment[],
  selectedIndices: number[],
) {
  const selectedSet = new Set(selectedIndices);
  const withPolygons = segments.filter((s) => s.polygon || s.bounding_box);

  return new PolygonLayer<RoofSegment>({
    id: "roof-segments",
    data: withPolygons,
    extensions: [new TerrainExtension()],
    getPolygon: (d: RoofSegment) => segmentToPolygon(d)!,
    getFillColor: (d: RoofSegment) => segmentColor(d, selectedSet.has(d.id)),
    getLineColor: (d: RoofSegment) =>
      selectedSet.has(d.id)
        ? [56, 104, 198, 255]
        : [255, 255, 255, 120],
    getLineWidth: 2,
    lineWidthUnits: "pixels" as const,
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
