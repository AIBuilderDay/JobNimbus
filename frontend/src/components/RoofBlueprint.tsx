import { useState, useRef, useCallback, type CSSProperties } from "react";

interface BBoxCorner {
  latitude: number;
  longitude: number;
}

interface SegmentBBox {
  sw: BBoxCorner;
  ne: BBoxCorner;
}

export interface BlueprintSegment {
  id: number;
  index: number;
  pitch_degrees: number | null;
  azimuth_degrees: number | null;
  area_sq_ft: number;
  bounding_box: SegmentBBox;
  center?: { latitude: number; longitude: number };
}

interface Props {
  segments: BlueprintSegment[];
  width?: number;
  height?: number;
  style?: CSSProperties;
  onSegmentClick?: (segment: BlueprintSegment) => void;
  selectedSegmentIds?: number[];
  showLabels?: boolean;
  dark?: boolean;
}

const LIGHT_THEME = {
  bg: "#f8f9fa",
  grid: "#e6e8eb",
  segmentFill: "rgba(56, 104, 198, 0.12)",
  segmentStroke: "#3868C6",
  segmentFillSelected: "rgba(56, 104, 198, 0.42)",
  segmentStrokeSelected: "#1a2440",
  textPrimary: "#1a2440",
  textSecondary: "#5a6478",
  northBg: "white",
  northStroke: "#5a6478",
};

const DARK_THEME = {
  bg: "#0e1830",
  grid: "rgba(255, 255, 255, 0.06)",
  segmentFill: "rgba(148, 182, 240, 0.10)",
  segmentStroke: "rgba(255, 255, 255, 0.85)",
  segmentFillSelected: "rgba(148, 182, 240, 0.32)",
  segmentStrokeSelected: "#ffffff",
  textPrimary: "#ffffff",
  textSecondary: "rgba(255, 255, 255, 0.55)",
  northBg: "rgba(255, 255, 255, 0.08)",
  northStroke: "rgba(255, 255, 255, 0.4)",
};

export default function RoofBlueprint({
  segments,
  width = 480,
  height = 480,
  style,
  onSegmentClick,
  selectedSegmentIds = [],
  showLabels = true,
  dark = false,
}: Props) {
  const c = dark ? DARK_THEME : LIGHT_THEME;
  const selectedSet = new Set(selectedSegmentIds);
  const padding = Math.max(12, Math.round(Math.min(width, height) * 0.06));
  const gridId = dark ? "blueprint-grid-dark" : "blueprint-grid-light";

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; panX: number; panY: number }>({ active: false, startX: 0, startY: 0, panX: 0, panY: 0 });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(5, Math.max(0.3, z - e.deltaY * 0.001)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      setPan({ x: dragRef.current.panX + dx, y: dragRef.current.panY + dy });
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    dragRef.current.active = false;
  }, []);

  if (segments.length === 0) {
    return (
      <div style={{ width, height, display: "flex", alignItems: "center", justifyContent: "center", color: c.textSecondary, fontSize: 13, background: c.bg }}>
        No roof segments to render
      </div>
    );
  }

  const allLats: number[] = [];
  const allLngs: number[] = [];
  segments.forEach((s) => {
    allLats.push(s.bounding_box.sw.latitude, s.bounding_box.ne.latitude);
    allLngs.push(s.bounding_box.sw.longitude, s.bounding_box.ne.longitude);
  });
  const minLat = Math.min(...allLats);
  const maxLat = Math.max(...allLats);
  const minLng = Math.min(...allLngs);
  const maxLng = Math.max(...allLngs);

  const centerLat = (minLat + maxLat) / 2;
  const lngScale = Math.cos((centerLat * Math.PI) / 180);

  const latRange = maxLat - minLat || 1e-9;
  const lngRangeScaled = (maxLng - minLng) * lngScale || 1e-9;

  const usableW = width - 2 * padding;
  const usableH = height - 2 * padding;

  const scale = Math.min(usableW / lngRangeScaled, usableH / latRange);
  const drawW = lngRangeScaled * scale;
  const drawH = latRange * scale;
  const offsetX = (width - drawW) / 2;
  const offsetY = (height - drawH) / 2;

  function project(lat: number, lng: number) {
    const x = offsetX + (lng - minLng) * lngScale * scale;
    const y = offsetY + (maxLat - lat) * scale;
    return { x, y };
  }

  return (
    <div
      style={{ ...style, overflow: "hidden", cursor: dragRef.current.active ? "grabbing" : "grab" }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      style={{ transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`, transformOrigin: "center center" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id={gridId} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke={c.grid} strokeWidth="0.5" />
        </pattern>
      </defs>

      <rect x={0} y={0} width={width} height={height} fill={c.bg} />
      <rect x={0} y={0} width={width} height={height} fill={`url(#${gridId})`} />

      {/* North arrow (top-right) */}
      <g transform={`translate(${width - 28}, 28)`}>
        <circle cx={0} cy={0} r={11} fill={c.northBg} stroke={c.northStroke} strokeWidth={1} />
        <path d="M 0,-7 L 4,4 L 0,2 L -4,4 Z" fill={c.textPrimary} />
        <text x={0} y={-16} textAnchor="middle" fontSize={14} fontWeight={700} fill={c.textPrimary} fontFamily="monospace">
          N
        </text>
      </g>

      {/* Roof segments */}
      {segments.map((seg) => {
        const sw = project(seg.bounding_box.sw.latitude, seg.bounding_box.sw.longitude);
        const ne = project(seg.bounding_box.ne.latitude, seg.bounding_box.ne.longitude);
        const points = [
          `${sw.x},${sw.y}`,
          `${ne.x},${sw.y}`,
          `${ne.x},${ne.y}`,
          `${sw.x},${ne.y}`,
        ].join(" ");
        const cx = (sw.x + ne.x) / 2;
        const cy = (sw.y + ne.y) / 2;
        const pitch = seg.pitch_degrees != null ? `${seg.pitch_degrees.toFixed(0)}°` : "—";
        const isSelected = selectedSet.has(seg.index);

        return (
          <g
            key={seg.id}
            onClick={onSegmentClick ? () => onSegmentClick(seg) : undefined}
            style={{ cursor: onSegmentClick ? "pointer" : "default" }}
          >
            <polygon
              points={points}
              fill={isSelected ? c.segmentFillSelected : c.segmentFill}
              stroke={isSelected ? c.segmentStrokeSelected : c.segmentStroke}
              strokeWidth={isSelected ? 2 : 1}
              strokeLinejoin="round"
            />
            {showLabels && (
              <>
                <text x={cx} y={cy - 5} textAnchor="middle" fontSize={18} fontWeight={700} fill={c.textPrimary}>
                  #{seg.id}
                </text>
                <text x={cx} y={cy + 13} textAnchor="middle" fontSize={12} fill={c.textSecondary} fontFamily="monospace">
                  {Math.round(seg.area_sq_ft)} sf · {pitch}
                </text>
              </>
            )}
            {!showLabels && (
              <text x={cx} y={cy + 4} textAnchor="middle" fontSize={14} fontWeight={700} fill={c.textPrimary}>
                {seg.id}
              </text>
            )}
          </g>
        );
      })}

    </svg>
    </div>
  );
}
