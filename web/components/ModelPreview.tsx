"use client";
import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { GltfModel, ModelBoundary } from "@/components/Scene";

/** Xem trước glb vừa tạo: tự quay chậm, kéo chuột để xoay. */
export default function ModelPreview({ url, onError }: { url: string; onError: (e: Error) => void }) {
  return (
    <Canvas camera={{ position: [0, 0, 12], fov: 40 }} dpr={[1, 2]}>
      <color attach="background" args={["#0e1217"]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 8, 10]} intensity={1.6} />
      <ModelBoundary key={url} onError={onError}>
        <Suspense fallback={null}>
          <GltfModel url={url} />
        </Suspense>
      </ModelBoundary>
      <OrbitControls autoRotate autoRotateSpeed={1.5} enablePan={false} />
    </Canvas>
  );
}
