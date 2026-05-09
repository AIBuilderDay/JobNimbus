import { useState, useEffect, useMemo } from "react";
import { Html, Line } from "@react-three/drei";

interface CapturedPoint {
  position: [number, number, number];
}

export default function SegmentCalibrator() {
  const [points, setPoints] = useState<CapturedPoint[]>([]);
  const [polygons, setPolygons] = useState<[number, number, number][][]>([]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && points.length >= 3) {
        const verts = points.map((p) => p.position);
        setPolygons((prev) => [...prev, verts]);
        console.log(`[CALIBRATOR] Polygon complete:`);
        console.log(JSON.stringify(verts));
        setPoints([]);
      }
      if (e.key === "Escape") {
        setPoints([]);
        console.log("[CALIBRATOR] Points cleared");
      }
      if (e.key === "Backspace") {
        setPoints((prev) => prev.slice(0, -1));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [points]);

  const closedPolygonPoints = useMemo(() => {
    return polygons.map((verts) => [...verts, verts[0]]);
  }, [polygons]);

  const progressPoints = useMemo(() => {
    if (points.length < 2) return null;
    return points.map((p) => p.position);
  }, [points]);

  return (
    <group
      onPointerDown={(e) => {
        e.stopPropagation();
        const p = e.point;
        const pos: [number, number, number] = [
          Math.round(p.x * 1000) / 1000,
          Math.round(p.y * 1000) / 1000,
          Math.round(p.z * 1000) / 1000,
        ];
        console.log(`[CALIBRATOR] Point: [${pos.join(", ")}]`);
        setPoints((prev) => [...prev, { position: pos }]);
      }}
    >
      {points.map((pt, i) => (
        <mesh key={`pt-${i}`} position={pt.position}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshBasicMaterial color="#ff4444" />
          <Html center style={{ pointerEvents: "none" }}>
            <span style={{ color: "#ff4444", fontSize: 10, fontFamily: "monospace", fontWeight: "bold" }}>
              {i}
            </span>
          </Html>
        </mesh>
      ))}

      {closedPolygonPoints.map((pts, pi) => (
        <Line key={`poly-${pi}`} points={pts} color="#44ff44" lineWidth={2} />
      ))}

      {progressPoints && (
        <Line points={progressPoints} color="#ff4444" lineWidth={2} />
      )}

      <Html position={[0, 3, 0]} center style={{ pointerEvents: "none" }}>
        <div style={{ background: "rgba(0,0,0,0.8)", color: "white", padding: "8px 12px", borderRadius: 8, fontSize: 11, fontFamily: "monospace", whiteSpace: "nowrap" }}>
          CALIBRATOR: Click roof corners | Enter=save polygon | Esc=clear | Backspace=undo
          <br />
          Points: {points.length} | Saved polygons: {polygons.length}
        </div>
      </Html>
    </group>
  );
}
