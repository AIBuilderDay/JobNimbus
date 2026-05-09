import { useRef, useState, useMemo, useCallback } from "react";
import { BufferGeometry, Float32BufferAttribute, MeshBasicMaterial, DoubleSide } from "three";
import { Outlines } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

interface Props {
  vertices: [number, number, number][];
  segmentIndex: number;
  isSelected: boolean;
  onToggle: (index: number) => void;
}

function triangulate(vertices: [number, number, number][]): number[] {
  if (vertices.length === 3) return [0, 1, 2];
  if (vertices.length === 4) return [0, 1, 2, 0, 2, 3];

  const normal = new THREE.Vector3();
  const a = new THREE.Vector3(...vertices[0]);
  const b = new THREE.Vector3(...vertices[1]);
  const c = new THREE.Vector3(...vertices[2]);
  normal.crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();

  const absX = Math.abs(normal.x);
  const absY = Math.abs(normal.y);
  const absZ = Math.abs(normal.z);

  let u = 0, v = 1;
  if (absX >= absY && absX >= absZ) { u = 1; v = 2; }
  else if (absY >= absX && absY >= absZ) { u = 0; v = 2; }

  const coords2d = vertices.map((vt) => [vt[u], vt[v]] as [number, number]);
  const earcut = THREE.ShapeUtils.triangulateShape(
    coords2d.map(([x, y]) => new THREE.Vector2(x, y)),
    []
  );
  if (earcut.length > 0) return earcut.flat();

  const indices: number[] = [];
  for (let i = 1; i < vertices.length - 1; i++) {
    indices.push(0, i, i + 1);
  }
  return indices;
}

export default function RoofSegmentOverlay({ vertices, segmentIndex, isSelected, onToggle }: Props) {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    const positions = new Float32Array(vertices.flat());
    geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
    const indices = triangulate(vertices);
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [vertices]);

  const material = useMemo(() => {
    const opacity = isSelected ? 0.45 : hovered ? 0.25 : 0.15;
    return new MeshBasicMaterial({
      color: "#3868C6",
      transparent: true,
      opacity,
      side: DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
  }, [isSelected, hovered]);

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onToggle(segmentIndex);
  }, [onToggle, segmentIndex]);

  const handlePointerEnter = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = "pointer";
  }, []);

  const handlePointerLeave = useCallback(() => {
    setHovered(false);
    document.body.style.cursor = "auto";
  }, []);

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      onClick={handleClick}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      {isSelected && <Outlines thickness={2} color="#ffffff" screenspace />}
    </mesh>
  );
}
