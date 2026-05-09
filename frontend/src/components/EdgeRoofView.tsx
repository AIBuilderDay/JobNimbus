import type { CSSProperties } from "react";

interface BBoxCorner {
  latitude: number;
  longitude: number;
}

interface SegmentBBox {
  sw: BBoxCorner;
  ne: BBoxCorner;
}

export interface EdgeRoofSegment {
  id: number;
  pitch_degrees: number | null;
  area_sq_ft: number;
  bounding_box: SegmentBBox;
  center?: BBoxCorner;
}

interface Props {
  segments: EdgeRoofSegment[];
  width?: number;
  height?: number;
  selectedIds?: number[];
  onSegmentClick?: (id: number) => void;
  style?: CSSProperties;
}

type Point = [number, number];
type Polygon = Point[];

function dot(a: Point, b: Point): number {
  return a[0] * b[0] + a[1] * b[1];
}

/**
 * Sutherland-Hodgman polygon clip against a half-plane defined by a point on the
 * dividing line and a normal vector pointing INTO the kept side.
 */
function clipAgainstHalfPlane(
  polygon: Polygon,
  linePoint: Point,
  lineNormal: Point,
): Polygon {
  if (polygon.length === 0) return [];

  function inside(p: Point): boolean {
    return dot([p[0] - linePoint[0], p[1] - linePoint[1]], lineNormal) > 0;
  }

  function intersect(p1: Point, p2: Point): Point {
    const d1 = dot([p1[0] - linePoint[0], p1[1] - linePoint[1]], lineNormal);
    const d2 = dot([p2[0] - linePoint[0], p2[1] - linePoint[1]], lineNormal);
    const denom = d1 - d2 || 1e-12;
    const t = d1 / denom;
    return [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])];
  }

  const out: Polygon = [];
  let prev = polygon[polygon.length - 1];
  let prevIn = inside(prev);
  for (const curr of polygon) {
    const currIn = inside(curr);
    if (currIn) {
      if (!prevIn) out.push(intersect(prev, curr));
      out.push(curr);
    } else if (prevIn) {
      out.push(intersect(prev, curr));
    }
    prev = curr;
    prevIn = currIn;
  }
  return out;
}

function bboxesOverlap(a: SegmentBBox, b: SegmentBBox): boolean {
  if (a.ne.longitude < b.sw.longitude || a.sw.longitude > b.ne.longitude) return false;
  if (a.ne.latitude < b.sw.latitude || a.sw.latitude > b.ne.latitude) return false;
  return true;
}

function centerOf(seg: EdgeRoofSegment): Point {
  if (seg.center) return [seg.center.longitude, seg.center.latitude];
  return [
    (seg.bounding_box.sw.longitude + seg.bounding_box.ne.longitude) / 2,
    (seg.bounding_box.sw.latitude + seg.bounding_box.ne.latitude) / 2,
  ];
}

/**
 * Start with the segment's bbox as a polygon. For every OTHER segment whose bbox
 * overlaps, clip our polygon by the perpendicular bisector between our center and
 * theirs. Result: a non-overlapping region "owned" by this segment, meeting neighbors
 * along clean midlines (approximating ridges/valleys).
 */
function deriveSegmentPolygon(
  index: number,
  segments: EdgeRoofSegment[],
): Polygon {
  const seg = segments[index];
  const aCenter = centerOf(seg);

  let polygon: Polygon = [
    [seg.bounding_box.sw.longitude, seg.bounding_box.sw.latitude],
    [seg.bounding_box.ne.longitude, seg.bounding_box.sw.latitude],
    [seg.bounding_box.ne.longitude, seg.bounding_box.ne.latitude],
    [seg.bounding_box.sw.longitude, seg.bounding_box.ne.latitude],
  ];

  for (let i = 0; i < segments.length; i++) {
    if (i === index) continue;
    const other = segments[i];
    if (!bboxesOverlap(seg.bounding_box, other.bounding_box)) continue;

    const bCenter = centerOf(other);
    const mid: Point = [(aCenter[0] + bCenter[0]) / 2, (aCenter[1] + bCenter[1]) / 2];
    const normal: Point = [aCenter[0] - bCenter[0], aCenter[1] - bCenter[1]];

    polygon = clipAgainstHalfPlane(polygon, mid, normal);
    if (polygon.length === 0) break;
  }
  return polygon;
}

function vertexAverage(polygon: Polygon): Point {
  if (polygon.length === 0) return [0, 0];
  let cx = 0, cy = 0;
  for (const p of polygon) {
    cx += p[0];
    cy += p[1];
  }
  return [cx / polygon.length, cy / polygon.length];
}

export default function EdgeRoofView({
  segments,
  width = 800,
  height = 800,
  selectedIds = [],
  onSegmentClick,
  style,
}: Props) {
  const PADDING = 80;
  const selectedSet = new Set(selectedIds);

  if (segments.length === 0) {
    return (
      <div
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f8fafc",
          color: "#64748b",
          fontSize: 13,
          borderRadius: 12,
          ...style,
        }}
      >
        No roof segments to render
      </div>
    );
  }

  // Derive non-overlapping polygons via Voronoi-like clipping
  const polygons: Polygon[] = segments.map((_, i) => deriveSegmentPolygon(i, segments));

  // Compute the bbox of ALL derived polygons combined
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const poly of polygons) {
    for (const [lng, lat] of poly) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
  }

  // Mercator-aware lng scaling so polygons aren't squashed E-W
  const centerLat = (minLat + maxLat) / 2;
  const lngScale = Math.cos((centerLat * Math.PI) / 180);
  const latRange = maxLat - minLat || 1e-9;
  const lngRangeScaled = (maxLng - minLng) * lngScale || 1e-9;
  const usableW = width - 2 * PADDING;
  const usableH = height - 2 * PADDING;
  const scale = Math.min(usableW / lngRangeScaled, usableH / latRange);
  const drawW = lngRangeScaled * scale;
  const drawH = latRange * scale;
  const offsetX = (width - drawW) / 2;
  const offsetY = (height - drawH) / 2;

  function project([lng, lat]: Point): { x: number; y: number } {
    const x = offsetX + (lng - minLng) * lngScale * scale;
    const y = offsetY + (maxLat - lat) * scale;
    return { x, y };
  }

  const totalArea = segments.reduce((sum, s) => sum + s.area_sq_ft, 0);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      style={{
        backgroundColor: "#f8fafc",
        borderRadius: 12,
        display: "block",
        ...style,
      }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="blueprint-grid-light" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect x={0} y={0} width={width} height={height} fill="url(#blueprint-grid-light)" />

      {/* North arrow (top-right) */}
      <g transform={`translate(${width - 44}, 44)`}>
        <circle cx={0} cy={0} r={14} fill="white" stroke="#475569" strokeWidth={1} />
        <path d="M 0,-9 L 5,5 L 0,2.5 L -5,5 Z" fill="#1e293b" />
        <text x={0} y={-19} textAnchor="middle" fontSize={10} fontWeight={700} fill="#1e293b" fontFamily="monospace">
          N
        </text>
      </g>

      {/* Roof segments */}
      {segments.map((seg, i) => {
        const polygon = polygons[i];
        if (polygon.length < 3) return null;

        const projected = polygon.map(project);
        const points = projected.map((p) => `${p.x},${p.y}`).join(" ");
        const centroidLngLat = vertexAverage(polygon);
        const centroidPx = project(centroidLngLat);
        const isSelected = selectedSet.has(seg.id);
        const pitch = seg.pitch_degrees != null ? `${seg.pitch_degrees.toFixed(0)}°` : "—";

        return (
          <g
            key={seg.id}
            onClick={onSegmentClick ? () => onSegmentClick(seg.id) : undefined}
            style={{ cursor: onSegmentClick ? "pointer" : "default" }}
          >
            <polygon
              points={points}
              fill={isSelected ? "rgba(56, 104, 198, 0.45)" : "rgba(148, 182, 240, 0.4)"}
              stroke={isSelected ? "#1e293b" : "#1e40af"}
              strokeWidth={isSelected ? 2.5 : 1.5}
              strokeLinejoin="round"
            />
            <text
              x={centroidPx.x}
              y={centroidPx.y - 6}
              textAnchor="middle"
              fontSize={14}
              fontWeight={700}
              fill="#0f172a"
              style={{ pointerEvents: "none" }}
            >
              #{seg.id}
            </text>
            <text
              x={centroidPx.x}
              y={centroidPx.y + 12}
              textAnchor="middle"
              fontSize={11}
              fontFamily="monospace"
              fill="#334155"
              style={{ pointerEvents: "none" }}
            >
              {Math.round(seg.area_sq_ft)} sf · {pitch}
            </text>
          </g>
        );
      })}

      {/* Footer summary */}
      <g transform={`translate(${PADDING / 2}, ${height - PADDING / 2 - 16})`}>
        <text fontSize={13} fontWeight={700} fill="#0f172a">
          Total: {Math.round(totalArea).toLocaleString()} sf
        </text>
        <text y={16} fontSize={11} fill="#475569" fontFamily="monospace">
          {segments.length} face{segments.length === 1 ? "" : "s"} · roof takeoff
        </text>
      </g>
    </svg>
  );
}
