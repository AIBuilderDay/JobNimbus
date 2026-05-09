import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment, Center } from "@react-three/drei";

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return (
    <Center>
      <primitive object={scene} />
    </Center>
  );
}

export default function ModelViewer({ modelUrl }: { modelUrl: string }) {
  return (
    <Canvas camera={{ position: [3, 3, 3], fov: 50 }} style={{ width: "100%", height: "100%" }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <Suspense fallback={null}>
        <Model url={modelUrl} />
        <Environment preset="city" />
      </Suspense>
      <OrbitControls enableDamping dampingFactor={0.1} />
    </Canvas>
  );
}
