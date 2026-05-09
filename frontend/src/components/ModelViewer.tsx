import { Suspense, useRef, useEffect, useState, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Center, Environment } from "@react-three/drei";
import type { Group } from "three";
import SegmentCalibrator from "./SegmentCalibrator";
import { getOverlaysForAddress } from "../data/roofSegmentOverlays";
import type { BuildingInsightsResponse } from "../types/solar";

const MODEL_MAP: [RegExp, string][] = [
  [/1261\s+20th/i, "/models/1261-20th-st.glb"],
  [/127\s+nw\s+13th/i, "/models/127-nw-13th-pl.glb"],
];

function resolveModel(address: string): string | null {
  for (const [pattern, path] of MODEL_MAP) {
    if (pattern.test(address)) return path;
  }
  return null;
}

const CALIBRATE = import.meta.env.DEV && new URLSearchParams(window.location.search).has("calibrate");

interface ModelProps {
  url: string;
  onClearSegments: () => void;
}

function Model({ url, onClearSegments }: ModelProps) {
  const { scene } = useGLTF(url);
  const ref = useRef<Group>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.traverse((child) => {
        child.castShadow = true;
        child.receiveShadow = true;
      });
    }
  }, [scene]);

  const handleMissed = useCallback(() => {
    onClearSegments();
  }, [onClearSegments]);

  return (
    <Center>
      <primitive ref={ref} object={scene} onClick={CALIBRATE ? undefined : handleMissed} />
      {CALIBRATE && <SegmentCalibrator />}
    </Center>
  );
}

function LoadingOverlay({ stage }: { stage: string }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-3 border-white/20 border-t-white rounded-full animate-spin" />
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[13px] font-mono font-semibold text-white">{stage}</span>
        <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-blue rounded-full animate-pulse" style={{ width: "60%" }} />
        </div>
      </div>
    </div>
  );
}

const LOADING_STAGES = [
  "Connecting to render engine...",
  "Fetching building geometry...",
  "Generating 3D mesh...",
  "Applying materials & textures...",
  "Finalizing model...",
];

interface Props {
  address: string;
  buildingInsights?: BuildingInsightsResponse | null;
  onClearSegments?: () => void;
}

export default function ModelViewer({ address, onClearSegments }: Props) {
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState(LOADING_STAGES[0]);

  const overlayConfig = getOverlaysForAddress(address);
  const defaultRotation = overlayConfig?.rotation ?? 0;
  const [, setRotationDeg] = useState(defaultRotation);

  useEffect(() => {
    setRotationDeg(overlayConfig?.rotation ?? 0);
  }, [address]);

  useEffect(() => {
    setLoading(true);
    setStage(LOADING_STAGES[0]);

    const timers: ReturnType<typeof setTimeout>[] = [];
    LOADING_STAGES.forEach((s, i) => {
      if (i > 0) {
        timers.push(setTimeout(() => setStage(s), i * 800));
      }
    });
    timers.push(setTimeout(() => setLoading(false), LOADING_STAGES.length * 800));

    return () => timers.forEach(clearTimeout);
  }, [address]);

  const modelUrl = resolveModel(address);
  const noop = useCallback(() => {}, []);

  if (!modelUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: "#0e1830" }}>
        <span className="text-white/55 text-[13px] font-mono">No 3D model available for this address</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative" style={{ backgroundColor: "#0e1830" }}>
      {loading && <LoadingOverlay stage={stage} />}
      <div className={`w-full h-full transition-opacity duration-500 ${loading ? "opacity-0" : "opacity-100"}`}>
        <Canvas
          shadows
          camera={{ position: [4, 3, 4], fov: 45, near: 0.01, far: 500 }}
          gl={{ antialias: true, alpha: true }}
        >
          <color attach="background" args={["#0e1830"]} />
          <ambientLight intensity={0.4} />
          <directionalLight position={[10, 15, 10]} intensity={1.2} castShadow />
          <directionalLight position={[-5, 8, -5]} intensity={0.3} />
          <Suspense fallback={null}>
            <Model
              url={modelUrl}
              onClearSegments={onClearSegments ?? noop}
            />
            <Environment preset="city" />
          </Suspense>
          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            minDistance={2}
            maxDistance={50}
            maxPolarAngle={Math.PI / 2}
          />
        </Canvas>
      </div>
    </div>
  );
}
