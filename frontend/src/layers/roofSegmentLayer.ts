import { PolygonLayer } from "@deck.gl/layers";
import type { RoofSegment } from "../types/solar";

function segmentToPolygon(
  segment: RoofSegment,
): [number, number, number][] | null {
  if (!segment.bounding_box) return null;
  const { sw, ne } = segment.bounding_box;
  const alt = segment.plane_height_meters ?? 0;
  return [
    [sw.longitude, sw.latitude, alt],
    [ne.longitude, sw.latitude, alt],
    [ne.longitude, ne.latitude, alt],
    [sw.longitude, ne.latitude, alt],
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
  selectedIndex: number,
) {
  const withPolygons = segments.filter((s) => s.bounding_box != null);

  return new PolygonLayer<RoofSegment>({
    id: "roof-segments",
    data: withPolygons,
    getPolygon: (d: RoofSegment) => segmentToPolygon(d)!,
    getFillColor: (d: RoofSegment, { index }: { index: number }) =>
      segmentColor(d, index === selectedIndex),
    getLineColor: (_d: RoofSegment, { index }: { index: number }) =>
      index === selectedIndex
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
      getFillColor: [selectedIndex],
      getLineColor: [selectedIndex],
    },
  });
}
