import { PolygonLayer } from "@deck.gl/layers";
import type { RoofSegmentStat } from "../types/solar";

function segmentToPolygon(
  segment: RoofSegmentStat,
): [number, number, number][] {
  const { sw, ne } = segment.boundingBox;
  const alt = segment.planeHeightAtCenterMeters;
  return [
    [sw.longitude, sw.latitude, alt],
    [ne.longitude, sw.latitude, alt],
    [ne.longitude, ne.latitude, alt],
    [sw.longitude, ne.latitude, alt],
  ];
}

function segmentColor(
  segment: RoofSegmentStat,
  isSelected: boolean,
): [number, number, number, number] {
  if (isSelected) return [56, 104, 198, 180];

  const q = segment.stats.sunshineQuantiles;
  const median = q[Math.floor(q.length / 2)] ?? 0;
  const t = Math.min(1, Math.max(0, (median - 400) / 1400));

  const r = Math.round(40 + t * 215);
  const g = Math.round(80 + t * 140);
  const b = Math.round(180 - t * 140);
  return [r, g, b, 140];
}

export function createRoofSegmentLayer(
  segments: RoofSegmentStat[],
  selectedIndex: number,
) {
  return new PolygonLayer<RoofSegmentStat>({
    id: "roof-segments",
    data: segments,
    getPolygon: (d: RoofSegmentStat) => segmentToPolygon(d),
    getFillColor: (d: RoofSegmentStat, { index }: { index: number }) =>
      segmentColor(d, index === selectedIndex),
    getLineColor: (_d: RoofSegmentStat, { index }: { index: number }) =>
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
