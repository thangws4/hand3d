"use client";
import { useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, memo, Suspense, useCallback, useEffect, useMemo, useRef, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import type { HitTest, Transform } from "@/lib/controller";
import { DEMO_PARTS, type DemoPart } from "@/lib/demoModel";
import { fitScale } from "@/lib/model";
import { makeParts, placeParts, type PartState } from "@/lib/placeParts";

export type PartSummary = { id: string; name: string };
export type FrameFn = (dt: number, hitTest: HitTest) => { transform: Transform; highlight: string | null };

function PartGeometry({ part }: { part: DemoPart }) {
  const [a, b, c] = part.size;
  if (part.shape === "box") return <boxGeometry args={[a, b, c]} />;
  if (part.shape === "sphere") return <sphereGeometry args={[a, 24, 16]} />;
  return <cylinderGeometry args={[a, c, b, 24]} />;
}

/** Robot mẫu: mỗi khối là một mesh có tên → một linh kiện. */
function DemoRobot() {
  return (
    <group>
      {DEMO_PARTS.map((p) => (
        <mesh key={p.id} name={p.name} position={p.position}>
          <PartGeometry part={p} />
          <meshStandardMaterial color={p.color} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/** Model tải về có thể to/nhỏ/lệch tâm bất kỳ → đưa về giữa và co giãn cho vừa. */
export function GltfModel({ url }: { url: string }) {
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
/** glb hỏng → báo lỗi và hiện robot mẫu thay vì làm trắng trang. */
export class ModelBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: Error) {
    this.props.onError(e);
  }
  render() {
    return this.state.failed ? <DemoRobot /> : this.props.children;
  }
}

const materialsOf = (mesh: THREE.Mesh) => (Array.isArray(mesh.material) ? mesh.material : [mesh.material]);

function setHighlight(mesh: THREE.Mesh, on: boolean) {
  for (const m of materialsOf(mesh)) {
    if (!("emissive" in m)) continue;
    const e = (m as THREE.MeshStandardMaterial).emissive;
    e.copy(on ? new THREE.Color("#1f6f5c") : (m.userData.baseEmissive as THREE.Color));
  }
}

/** Mỗi Mesh trong model là một linh kiện. Clone material để làm sáng một linh kiện không lây sang mesh dùng chung material. */
function collectParts(root: THREE.Object3D): PartState[] {
  const parts = makeParts(root);
  for (const { mesh } of parts) {
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => m.clone()) : mesh.material.clone();
    for (const m of materialsOf(mesh)) {
      if ("emissive" in m) m.userData.baseEmissive = (m as THREE.MeshStandardMaterial).emissive.clone();
    }
  }
  return parts;
}

/** Chạy sau khi model trong cùng Suspense đã sẵn sàng; khi unmount trả mesh về chỗ cũ (scene glb được cache và dùng lại). */
function PartsCollector({ rootRef, partsRef, onParts }: {
  rootRef: RefObject<THREE.Group | null>;
  partsRef: RefObject<PartState[]>;
  onParts: (parts: PartSummary[]) => void;
}) {
  // useEffect (không phải useLayoutEffect): ref của group cha (rootRef) chỉ được gán sau layout effect của con
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const parts = collectParts(root);
    partsRef.current = parts;
    onParts(parts.map(({ id, name }) => ({ id, name })));
    return () => {
      for (const p of parts) {
        p.mesh.position.copy(p.base);
        setHighlight(p.mesh, false);
      }
      partsRef.current = [];
    };
  }, [rootRef, partsRef, onParts]);
  return null;
}

const deg = THREE.MathUtils.degToRad;

function Rig({ onFrame, partsRef, children }: { onFrame: FrameFn; partsRef: RefObject<PartState[]>; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const hitTest = useCallback<HitTest>(
    (x, y) => {
      const parts = partsRef.current;
      if (parts.length < 2) return null; // model liền một khối: không cầm linh kiện
      raycaster.setFromCamera(new THREE.Vector2(x * 2 - 1, -(y * 2 - 1)), camera);
      const hit = raycaster.intersectObjects(parts.map((p) => p.mesh), false)[0];
      return hit ? (parts.find((p) => p.mesh === hit.object)?.id ?? null) : null;
    },
    [camera, raycaster, partsRef],
  );
  useFrame((_, dt) => {
    const { transform: t, highlight } = onFrame(dt, hitTest);
    const g = ref.current;
    if (!g) return;
    // Ursina và three ngược chiều quay: đổi dấu để giữ đúng cảm giác như bản Python
    g.rotation.set(-deg(t.rotX), -deg(t.rotY), 0);
    g.position.set(t.x, t.y, 0);
    g.scale.setScalar(t.zoom);
    g.updateMatrixWorld(true);
    placeParts(partsRef.current, t.explode, t.partOffsets);
    for (const p of partsRef.current) setHighlight(p.mesh, p.id === highlight);
  });
  return <group ref={ref}>{children}</group>;
}

type Props = {
  modelUrl: string | null;
  onFrame: FrameFn;
  onModelError: (e: Error) => void;
  onParts: (parts: PartSummary[]) => void;
};

export const Scene = memo(function Scene({ modelUrl, onFrame, onModelError, onParts }: Props) {
  const rootRef = useRef<THREE.Group>(null);
  const partsRef = useRef<PartState[]>([]);
  return (
    <Canvas camera={{ position: [0, 0, 20], fov: 40 }} dpr={[1, 2]}>
      <color attach="background" args={["#07090c"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 10]} intensity={1.6} />
      <directionalLight position={[-6, -4, -8]} intensity={0.4} color="#3df5c4" />
      <Rig onFrame={onFrame} partsRef={partsRef}>
        <group ref={rootRef}>
          <ModelBoundary key={modelUrl ?? "demo"} onError={onModelError}>
            <Suspense fallback={null}>
              {modelUrl ? <GltfModel url={modelUrl} /> : <DemoRobot />}
              <PartsCollector rootRef={rootRef} partsRef={partsRef} onParts={onParts} />
            </Suspense>
          </ModelBoundary>
        </group>
      </Rig>
    </Canvas>
  );
});
