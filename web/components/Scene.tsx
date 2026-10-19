"use client";
import { Edges, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Component, memo, Suspense, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import type { Transform } from "@/lib/controller";
import { FIT_SIZE, fitScale } from "@/lib/model";

function Cube() {
  // Nghiêng sẵn để nhìn thẳng vẫn thấy là khối 3D (bản Python có texture viền nên không cần)
  return (
    <mesh scale={FIT_SIZE} rotation={[0.45, -0.6, 0]}>
      <boxGeometry />
      <meshStandardMaterial color="#e6edf3" roughness={0.55} />
      <Edges color="#3df5c4" />
    </mesh>
  );
}

/** Model tải về có thể to/nhỏ/lệch tâm bất kỳ → đưa về giữa và co giãn cho vừa. */
function GltfModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const { offset, scale } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    return {
      offset: box.getCenter(new THREE.Vector3()).negate(),
      scale: fitScale(box.getSize(new THREE.Vector3())),
    };
  }, [scene]);
  return (
    <group scale={scale}>
      <primitive object={scene} position={offset} />
    </group>
  );
}

type BoundaryProps = { onError: (e: Error) => void; children: ReactNode };
/** glb hỏng → báo lỗi và hiện khối lập phương thay vì làm trắng trang. */
class ModelBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: Error) {
    this.props.onError(e);
  }
  render() {
    return this.state.failed ? <Cube /> : this.props.children;
  }
}

const deg = THREE.MathUtils.degToRad;

function Rig({ onFrame, children }: { onFrame: (dt: number) => Transform; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const t = onFrame(dt);
    const g = ref.current;
    if (!g) return;
    // Ursina và three ngược chiều quay: đổi dấu để giữ đúng cảm giác như bản Python
    g.rotation.set(-deg(t.rotX), -deg(t.rotY), 0);
    g.position.set(t.x, t.y, 0);
    g.scale.setScalar(t.zoom);
  });
  return <group ref={ref}>{children}</group>;
}

type Props = {
  modelUrl: string | null;
  onFrame: (dt: number) => Transform;
  onModelError: (e: Error) => void;
};

export const Scene = memo(function Scene({ modelUrl, onFrame, onModelError }: Props) {
  return (
    <Canvas camera={{ position: [0, 0, 20], fov: 40 }} dpr={[1, 2]}>
      <color attach="background" args={["#07090c"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 10]} intensity={1.6} />
      <directionalLight position={[-6, -4, -8]} intensity={0.4} color="#3df5c4" />
      <Rig onFrame={onFrame}>
        <ModelBoundary key={modelUrl ?? "cube"} onError={onModelError}>
          <Suspense fallback={<Cube />}>{modelUrl ? <GltfModel url={modelUrl} /> : <Cube />}</Suspense>
        </ModelBoundary>
      </Rig>
    </Canvas>
  );
});
