import { useMemo, useCallback, type Dispatch, type SetStateAction } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface HouseModelProps {
  mode: "abstract" | "satellite" | "topdown";
  selected: string[];
  setSelected: Dispatch<SetStateAction<string[]>>;
  hovered: string | null;
  setHovered: (id: string | null) => void;
  rotation: number;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface FaceDef {
  id: string;
  pts: Vec3[];
  normal: Vec3;
  tone: string;
  type: "wall" | "roof" | "window" | "door" | "porch" | "railing" | "post";
}

interface TopdownFaceDef {
  id: string;
  points: string;
  label: string;
}

interface RoofMetaEntry {
  label: string;
  area: number;
  pitch: string;
  azimuth: number;
}

interface RoofFace {
  id: string;
  label: string;
  area: number;
}

/* ------------------------------------------------------------------ */
/*  Roof metadata                                                      */
/* ------------------------------------------------------------------ */

export const ROOF_META: Record<string, RoofMetaEntry> = {
  rE:  { label: "Main East",    area: 480, pitch: "6/12", azimuth: 90  },
  rW:  { label: "Main West",    area: 480, pitch: "6/12", azimuth: 270 },
  rGE: { label: "Garage East",  area: 260, pitch: "6/12", azimuth: 90  },
  rGW: { label: "Garage West",  area: 260, pitch: "6/12", azimuth: 270 },
  rPE: { label: "Porch East",   area: 140, pitch: "4/12", azimuth: 90  },
  rPW: { label: "Porch West",   area: 140, pitch: "4/12", azimuth: 270 },
};

export const ROOF_FACES: RoofFace[] = Object.entries(ROOF_META).map(
  ([id, meta]) => ({ id, label: meta.label, area: meta.area }),
);

/* ------------------------------------------------------------------ */
/*  Top-down face polygons                                             */
/* ------------------------------------------------------------------ */

export const TOPDOWN_FACES: TopdownFaceDef[] = [
  { id: "rE",  points: "200,80 350,80 350,220 200,220",   label: "Main East"   },
  { id: "rW",  points: "50,80 200,80 200,220 50,220",     label: "Main West"   },
  { id: "rGE", points: "200,230 320,230 320,330 200,330",  label: "Garage East" },
  { id: "rGW", points: "80,230 200,230 200,330 80,330",    label: "Garage West" },
  { id: "rPE", points: "200,340 310,340 310,400 200,400",  label: "Porch East"  },
  { id: "rPW", points: "90,340 200,340 200,400 90,400",    label: "Porch West"  },
];

/* ------------------------------------------------------------------ */
/*  3D house builder                                                   */
/* ------------------------------------------------------------------ */

const W = 6;   // main block width
const D = 4;   // main block depth
const H = 3;   // wall height
const R = 1.8; // ridge rise
const GW = 4;  // garage width
const GD = 3;  // garage depth
const GH = 2.6;
const GR = 1.2;
const PW = 3.6;
const PD = 2;
const PH = 2.4;
const PR = 0.6;

function v(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

function normal(pts: Vec3[]): Vec3 {
  const a = pts[0];
  const b = pts[1];
  const c = pts[2];
  const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
  const vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z;
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  return { x: nx / len, y: ny / len, z: nz / len };
}

function buildHouse(): FaceDef[] {
  const faces: FaceDef[] = [];

  const push = (
    id: string,
    pts: Vec3[],
    tone: string,
    type: FaceDef["type"],
  ) => {
    faces.push({ id, pts, normal: normal(pts), tone, type });
  };

  // --- Main block ---
  const mx = -W / 2, mz = -D / 2;

  // Walls
  push("mWF", [v(mx, 0, mz + D), v(mx + W, 0, mz + D), v(mx + W, H, mz + D), v(mx, H, mz + D)], "#e8ddd0", "wall");
  push("mWB", [v(mx + W, 0, mz), v(mx, 0, mz), v(mx, H, mz), v(mx + W, H, mz)], "#e8ddd0", "wall");
  push("mWL", [v(mx, 0, mz), v(mx, 0, mz + D), v(mx, H, mz + D), v(mx, H + R, mz + D / 2), v(mx, H, mz)], "#ddd2c4", "wall");
  push("mWR", [v(mx + W, 0, mz + D), v(mx + W, 0, mz), v(mx + W, H, mz), v(mx + W, H + R, mz + D / 2), v(mx + W, H, mz + D)], "#ddd2c4", "wall");

  // Roof slopes
  push("rE", [v(mx, H, mz + D), v(mx + W, H, mz + D), v(mx + W, H + R, mz + D / 2), v(mx, H + R, mz + D / 2)], "#7a6e5f", "roof");
  push("rW", [v(mx + W, H, mz), v(mx, H, mz), v(mx, H + R, mz + D / 2), v(mx + W, H + R, mz + D / 2)], "#7a6e5f", "roof");

  // Windows (front)
  const wy = 1.0, wh = 1.4, ww = 0.8;
  push("mWin1", [
    v(mx + 1.0, wy, mz + D + 0.01), v(mx + 1.0 + ww, wy, mz + D + 0.01),
    v(mx + 1.0 + ww, wy + wh, mz + D + 0.01), v(mx + 1.0, wy + wh, mz + D + 0.01),
  ], "#8cb4d8", "window");
  push("mWin2", [
    v(mx + W - 1.0 - ww, wy, mz + D + 0.01), v(mx + W - 1.0, wy, mz + D + 0.01),
    v(mx + W - 1.0, wy + wh, mz + D + 0.01), v(mx + W - 1.0 - ww, wy + wh, mz + D + 0.01),
  ], "#8cb4d8", "window");

  // Door
  const dw = 1.0, dh = 2.0;
  push("mDoor", [
    v(mx + W / 2 - dw / 2, 0, mz + D + 0.01), v(mx + W / 2 + dw / 2, 0, mz + D + 0.01),
    v(mx + W / 2 + dw / 2, dh, mz + D + 0.01), v(mx + W / 2 - dw / 2, dh, mz + D + 0.01),
  ], "#6b5c4a", "door");

  // --- Garage block ---
  const gx = mx + W + 0.5, gz = mz + D - GD;

  // Walls
  push("gWF", [v(gx, 0, gz + GD), v(gx + GW, 0, gz + GD), v(gx + GW, GH, gz + GD), v(gx, GH, gz + GD)], "#e2d7ca", "wall");
  push("gWB", [v(gx + GW, 0, gz), v(gx, 0, gz), v(gx, GH, gz), v(gx + GW, GH, gz)], "#e2d7ca", "wall");
  push("gWL", [v(gx, 0, gz), v(gx, 0, gz + GD), v(gx, GH, gz + GD), v(gx, GH + GR, gz + GD / 2), v(gx, GH, gz)], "#d6cbbe", "wall");
  push("gWR", [v(gx + GW, 0, gz + GD), v(gx + GW, 0, gz), v(gx + GW, GH, gz), v(gx + GW, GH + GR, gz + GD / 2), v(gx + GW, GH, gz + GD)], "#d6cbbe", "wall");

  // Garage roof
  push("rGE", [v(gx, GH, gz + GD), v(gx + GW, GH, gz + GD), v(gx + GW, GH + GR, gz + GD / 2), v(gx, GH + GR, gz + GD / 2)], "#7a6e5f", "roof");
  push("rGW", [v(gx + GW, GH, gz), v(gx, GH, gz), v(gx, GH + GR, gz + GD / 2), v(gx + GW, GH + GR, gz + GD / 2)], "#7a6e5f", "roof");

  // Garage door
  const gdw = 2.8, gdh = 2.2;
  push("gDoor", [
    v(gx + GW / 2 - gdw / 2, 0, gz + GD + 0.01), v(gx + GW / 2 + gdw / 2, 0, gz + GD + 0.01),
    v(gx + GW / 2 + gdw / 2, gdh, gz + GD + 0.01), v(gx + GW / 2 - gdw / 2, gdh, gz + GD + 0.01),
  ], "#8a7d6e", "door");

  // Garage window (side)
  push("gWin", [
    v(gx + GW + 0.01, 1.0, gz + GD / 2 - 0.4), v(gx + GW + 0.01, 1.0, gz + GD / 2 + 0.4),
    v(gx + GW + 0.01, 1.0 + 1.0, gz + GD / 2 + 0.4), v(gx + GW + 0.01, 1.0 + 1.0, gz + GD / 2 - 0.4),
  ], "#8cb4d8", "window");

  // --- Porch ---
  const px = mx - PW - 0.5, pz = mz + D - PD;

  // Porch floor
  push("pFloor", [v(px, 0.15, pz), v(px + PW, 0.15, pz), v(px + PW, 0.15, pz + PD), v(px, 0.15, pz + PD)], "#c8bfb2", "porch");

  // Porch posts (as thin box faces)
  const postW = 0.15;
  const postPositions: [number, number][] = [
    [px + 0.2, pz + PD - 0.2],
    [px + PW - 0.2, pz + PD - 0.2],
    [px + 0.2, pz + 0.2],
    [px + PW - 0.2, pz + 0.2],
  ];
  postPositions.forEach(([ppx, ppz], i) => {
    push(`pPost${i}F`, [
      v(ppx, 0.15, ppz + postW / 2), v(ppx + postW, 0.15, ppz + postW / 2),
      v(ppx + postW, PH, ppz + postW / 2), v(ppx, PH, ppz + postW / 2),
    ], "#b5a899", "post");
    push(`pPost${i}S`, [
      v(ppx + postW, 0.15, ppz - postW / 2), v(ppx + postW, 0.15, ppz + postW / 2),
      v(ppx + postW, PH, ppz + postW / 2), v(ppx + postW, PH, ppz - postW / 2),
    ], "#a89b8d", "post");
  });

  // Railing front
  push("pRailF", [
    v(px + 0.35, 0.8, pz + PD - 0.15), v(px + PW - 0.35, 0.8, pz + PD - 0.15),
    v(px + PW - 0.35, 0.95, pz + PD - 0.15), v(px + 0.35, 0.95, pz + PD - 0.15),
  ], "#c2b7aa", "railing");
  // Railing side
  push("pRailS", [
    v(px + 0.2, 0.8, pz + 0.35), v(px + 0.2, 0.8, pz + PD - 0.35),
    v(px + 0.2, 0.95, pz + PD - 0.35), v(px + 0.2, 0.95, pz + 0.35),
  ], "#b5a899", "railing");

  // Porch roof
  push("rPE", [v(px, PH, pz + PD), v(px + PW, PH, pz + PD), v(px + PW, PH + PR, pz + PD / 2), v(px, PH + PR, pz + PD / 2)], "#7a6e5f", "roof");
  push("rPW", [v(px + PW, PH, pz), v(px, PH, pz), v(px, PH + PR, pz + PD / 2), v(px + PW, PH + PR, pz + PD / 2)], "#7a6e5f", "roof");

  return faces;
}

/* ------------------------------------------------------------------ */
/*  Projection helpers                                                 */
/* ------------------------------------------------------------------ */

const SCALE = 46;
const CX = 220;
const CY = 180;
const ELEV = 0.55;

function project(
  pt: Vec3,
  rot: number,
): { x: number; y: number; depth: number } {
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);
  const cosE = Math.cos(ELEV);
  const sinE = Math.sin(ELEV);

  // Rotate around Y axis
  const rx = pt.x * cosR - pt.z * sinR;
  const rz = pt.x * sinR + pt.z * cosR;
  const ry = pt.y;

  // Tilt for elevation
  const ey = ry * cosE - rz * sinE;
  const ez = ry * sinE + rz * cosE;

  return {
    x: CX + rx * SCALE,
    y: CY - ey * SCALE,
    depth: ez,
  };
}

function centroid(pts: Vec3[]): Vec3 {
  const n = pts.length;
  let sx = 0, sy = 0, sz = 0;
  for (const p of pts) { sx += p.x; sy += p.y; sz += p.z; }
  return { x: sx / n, y: sy / n, z: sz / n };
}

function polygonPoints(pts: Vec3[], rot: number): string {
  return pts.map((p) => {
    const pr = project(p, rot);
    return `${pr.x.toFixed(1)},${pr.y.toFixed(1)}`;
  }).join(" ");
}

/* ------------------------------------------------------------------ */
/*  Lighting                                                           */
/* ------------------------------------------------------------------ */

function lightColor(
  base: string,
  n: Vec3,
  rot: number,
): string {
  // Directional light from upper-right-front
  const lx = 0.4, ly = 0.7, lz = 0.55;
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);

  // Rotate normal with the house
  const rnx = n.x * cosR - n.z * sinR;
  const rnz = n.x * sinR + n.z * cosR;

  const dot = Math.max(0, rnx * lx + n.y * ly + rnz * lz);
  const ambient = 0.35;
  const intensity = ambient + (1 - ambient) * dot;

  // Parse hex color
  const r = parseInt(base.slice(1, 3), 16);
  const g = parseInt(base.slice(3, 5), 16);
  const b = parseInt(base.slice(5, 7), 16);

  const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v)));

  return `rgb(${clamp(r * intensity)},${clamp(g * intensity)},${clamp(b * intensity)})`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const HOUSE = buildHouse();

export default function HouseModel({
  mode,
  selected,
  setSelected,
  hovered,
  setHovered,
  rotation,
}: HouseModelProps) {
  /* -- Abstract mode rendering -- */
  const abstractFaces = useMemo(() => {
    const rot = rotation;

    // Project, cull backfaces, sort by depth (painter's algorithm)
    const projected = HOUSE.map((face) => {
      const cen = centroid(face.pts);
      const proj = project(cen, rot);
      const points = polygonPoints(face.pts, rot);

      // Backface culling: rotate normal and check z component
      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);
      const cosE = Math.cos(ELEV);
      const sinE = Math.sin(ELEV);
      const rny = face.normal.y;
      const rnz = face.normal.x * sinR + face.normal.z * cosR;
      const nz = rny * sinE + rnz * cosE;

      return {
        ...face,
        points,
        depth: proj.depth,
        visible: nz > -0.05,
        litColor: lightColor(face.tone, face.normal, rot),
      };
    })
      .filter((f) => f.visible)
      .sort((a, b) => a.depth - b.depth);

    return projected;
  }, [rotation]);

  /* -- Satellite mode uses fixed rotation -- */
  const satRotation = 0.62;
  const satelliteFaces = useMemo(() => {
    const rot = satRotation;

    const projected = HOUSE.map((face) => {
      const cen = centroid(face.pts);
      const proj = project(cen, rot);
      const points = polygonPoints(face.pts, rot);

      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);
      const cosE = Math.cos(ELEV);
      const sinE = Math.sin(ELEV);
      const rnz = face.normal.x * sinR + face.normal.z * cosR;
      const nz = face.normal.y * sinE + rnz * cosE;

      return {
        ...face,
        points,
        depth: proj.depth,
        visible: nz > -0.05,
        litColor: lightColor(face.tone, face.normal, rot),
      };
    })
      .filter((f) => f.visible)
      .sort((a, b) => a.depth - b.depth);

    return projected;
  }, []);

  /* -- Handlers -- */
  const isRoof = (id: string) => id in ROOF_META;

  const handleClick = useCallback(
    (id: string) => {
      if (!isRoof(id)) return;
      setSelected((prev) =>
        prev.includes(id)
          ? prev.filter((s) => s !== id)
          : [...prev, id],
      );
    },
    [setSelected],
  );

  const handleHover = useCallback(
    (id: string | null) => {
      if (id !== null && !isRoof(id)) {
        setHovered(null);
        return;
      }
      setHovered(id);
    },
    [setHovered],
  );

  /* -- Fill color logic -- */
  const fillColor = (
    face: { id: string; litColor: string; type: FaceDef["type"] },
    viewMode: "abstract" | "satellite",
  ): string => {
    const isSel = selected.includes(face.id);
    const isHov = hovered === face.id;
    const roofFace = isRoof(face.id);

    if (viewMode === "satellite") {
      if (roofFace && isSel) return "rgba(56,104,198,0.55)";
      if (roofFace && isHov) return "rgba(56,104,198,0.3)";
      // Studio render: charcoal roofs, cream walls
      if (face.type === "roof") return "#4a4540";
      if (face.type === "window") return "#6a8faa";
      return face.litColor;
    }

    // Abstract
    if (roofFace && isSel) return "rgba(56,104,198,0.7)";
    if (roofFace && isHov) return "rgba(76,133,229,0.45)";
    return face.litColor;
  };

  const strokeColor = (
    face: { id: string; type: FaceDef["type"] },
    viewMode: "abstract" | "satellite",
  ): string => {
    const roofFace = isRoof(face.id);
    const isSel = selected.includes(face.id);

    if (roofFace && isSel) return "rgba(56,104,198,0.9)";
    if (roofFace && hovered === face.id) return "rgba(76,133,229,0.6)";

    if (viewMode === "satellite") return "rgba(0,0,0,0.12)";
    return "rgba(0,0,0,0.08)";
  };

  /* ---------------------------------------------------------------- */
  /*  Render: Top-down mode                                            */
  /* ---------------------------------------------------------------- */
  if (mode === "topdown") {
    return (
      <svg
        viewBox="0 0 400 480"
        width="100%"
        height="100%"
        style={{ cursor: "crosshair" }}
      >
        {/* Background */}
        <rect width="400" height="480" fill="transparent" />

        {TOPDOWN_FACES.map((face) => {
          const isSel = selected.includes(face.id);
          const isHov = hovered === face.id;

          return (
            <g key={face.id}>
              <polygon
                points={face.points}
                fill={
                  isSel
                    ? "rgba(56,104,198,0.55)"
                    : isHov
                      ? "rgba(76,133,229,0.25)"
                      : "rgba(122,110,95,0.35)"
                }
                stroke={
                  isSel
                    ? "rgba(56,104,198,0.9)"
                    : "rgba(255,255,255,0.2)"
                }
                strokeWidth={isSel ? 2 : 1}
                style={{ cursor: "pointer" }}
                onClick={() => handleClick(face.id)}
                onMouseEnter={() => handleHover(face.id)}
                onMouseLeave={() => handleHover(null)}
              />
              {/* Label */}
              <text
                x={(() => {
                  const coords = face.points.split(" ").map((p) => parseFloat(p.split(",")[0]));
                  return coords.reduce((a, b) => a + b, 0) / coords.length;
                })()}
                y={(() => {
                  const coords = face.points.split(" ").map((p) => parseFloat(p.split(",")[1]));
                  return coords.reduce((a, b) => a + b, 0) / coords.length;
                })()}
                textAnchor="middle"
                dominantBaseline="central"
                fill={isSel ? "#fff" : "rgba(255,255,255,0.6)"}
                fontSize="11"
                fontFamily="Inter, system-ui, sans-serif"
                fontWeight={isSel ? 600 : 400}
                style={{ pointerEvents: "none" }}
              >
                {face.label}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render: Satellite mode                                           */
  /* ---------------------------------------------------------------- */
  if (mode === "satellite") {
    return (
      <svg viewBox="0 0 440 360" width="100%" height="100%">
        {satelliteFaces.map((face) => (
          <polygon
            key={face.id}
            points={face.points}
            fill={fillColor(face, "satellite")}
            stroke={strokeColor(face, "satellite")}
            strokeWidth={0.7}
            strokeLinejoin="round"
            style={{
              cursor: isRoof(face.id) ? "pointer" : "default",
              transition: "fill 0.15s ease",
            }}
            onClick={() => handleClick(face.id)}
            onMouseEnter={() => handleHover(face.id)}
            onMouseLeave={() => handleHover(null)}
          />
        ))}

        {/* Callout pins on selected roof faces */}
        {selected
          .filter((id) => id in ROOF_META)
          .map((id) => {
            const face = HOUSE.find((f) => f.id === id);
            if (!face) return null;
            const cen = centroid(face.pts);
            const pr = project(cen, satRotation);
            const meta = ROOF_META[id];

            return (
              <g key={`pin-${id}`}>
                {/* Pin line */}
                <line
                  x1={pr.x}
                  y1={pr.y}
                  x2={pr.x}
                  y2={pr.y - 32}
                  stroke="rgba(56,104,198,0.7)"
                  strokeWidth={1.2}
                  strokeDasharray="2,2"
                />
                {/* Pin dot */}
                <circle
                  cx={pr.x}
                  cy={pr.y - 32}
                  r={3}
                  fill="#3868C6"
                  stroke="#fff"
                  strokeWidth={1.5}
                />
                {/* Label bg */}
                <rect
                  x={pr.x - 36}
                  y={pr.y - 52}
                  width={72}
                  height={16}
                  rx={4}
                  fill="rgba(255,255,255,0.92)"
                  stroke="rgba(56,104,198,0.3)"
                  strokeWidth={0.5}
                />
                {/* Label text */}
                <text
                  x={pr.x}
                  y={pr.y - 41}
                  textAnchor="middle"
                  fontSize="9"
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight={600}
                  fill="#152952"
                >
                  {meta.label} · {meta.area}sf
                </text>
              </g>
            );
          })}
      </svg>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render: Abstract mode (default)                                  */
  /* ---------------------------------------------------------------- */
  return (
    <svg viewBox="0 0 440 360" width="100%" height="100%">
      {abstractFaces.map((face) => (
        <polygon
          key={face.id}
          points={face.points}
          fill={fillColor(face, "abstract")}
          stroke={strokeColor(face, "abstract")}
          strokeWidth={0.5}
          strokeLinejoin="round"
          style={{
            cursor: isRoof(face.id) ? "pointer" : "default",
            transition: "fill 0.15s ease",
          }}
          onClick={() => handleClick(face.id)}
          onMouseEnter={() => handleHover(face.id)}
          onMouseLeave={() => handleHover(null)}
        />
      ))}
    </svg>
  );
}
