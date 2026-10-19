/** Đặt vị trí từng linh kiện mỗi khung: bung (hệ model) + cầm (neo theo model). Dùng three nhưng không cần React/WebGL → test bằng Node. */
import * as THREE from "three";
import { explodeOffset, type Vec2 } from "./parts.ts";

export type PartState = {
  id: string;
  name: string;
  mesh: THREE.Mesh;
  root: THREE.Object3D;
  base: THREE.Vector3; // vị trí gốc của mesh trong hệ parent (để trả lại khi gỡ model)
  baseRoot: THREE.Vector3; // gốc toạ độ của mesh trong hệ root
  center: THREE.Vector3; // tâm riêng của mesh (không gộp mesh con), hệ root
  modelCenter: THREE.Vector3; // tâm cả model, hệ root
  rootOffset: THREE.Vector3; // phần đã kéo, cộng dồn trong hệ root → xoay/zoom cùng model
  lastGrab: Vec2; // offset màn hình đã quy đổi tới khung trước
};

/** Mỗi Mesh trong root là một linh kiện, theo thứ tự cha trước con (traverse = pre-order). */
export function makeParts(root: THREE.Object3D): PartState[] {
  root.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  const modelCenter = root.worldToLocal(new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3()));
  return meshes.map((mesh, i) => {
    const g = mesh.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const ownBox = (g.boundingBox as THREE.Box3).clone().applyMatrix4(mesh.matrixWorld);
    return {
      id: mesh.uuid,
      name: mesh.name || `Linh kiện ${i + 1}`,
      mesh,
      root,
      base: mesh.position.clone(),
      baseRoot: root.worldToLocal(mesh.getWorldPosition(new THREE.Vector3())),
      center: root.worldToLocal(ownBox.getCenter(new THREE.Vector3())),
      modelCenter,
      rootOffset: new THREE.Vector3(),
      lastGrab: { x: 0, y: 0 },
    };
  });
}

const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), target = new THREE.Vector3();

/**
 * Yêu cầu: matrixWorld của root đã cập nhật cho khung này.
 * offsets: offset cầm theo mặt phẳng màn hình (đơn vị world) từ Controller; chỉ phần tăng giữa hai khung được
 * quy đổi sang hệ root rồi cộng dồn → kéo luôn đúng hướng màn hình, còn sau khi thả thì linh kiện xoay/zoom cùng model.
 */
export function placeParts(parts: PartState[], explode: number, offsets: Record<string, Vec2>): void {
  for (const p of parts) {
    const grab = offsets[p.id];
    if (!grab) {
      p.rootOffset.set(0, 0, 0); // nắm tay / chưa từng kéo
      p.lastGrab = { x: 0, y: 0 };
    } else if (grab.x !== p.lastGrab.x || grab.y !== p.lastGrab.y) {
      const a = p.root.worldToLocal(tmpA.set(0, 0, 0));
      const b = p.root.worldToLocal(tmpB.set(grab.x - p.lastGrab.x, grab.y - p.lastGrab.y, 0));
      p.rootOffset.add(b.sub(a));
      p.lastGrab = { x: grab.x, y: grab.y };
    }
    const off = explodeOffset(p.center, p.modelCenter, explode);
    p.root.localToWorld(
      target.set(p.baseRoot.x + off.x + p.rootOffset.x, p.baseRoot.y + off.y + p.rootOffset.y, p.baseRoot.z + off.z + p.rootOffset.z),
    );
    const parent = p.mesh.parent;
    if (!parent) continue;
    // đặt vị trí tuyệt đối: cha có thể vừa dịch ở bước trước (pre-order) → cập nhật ma trận của cha trước
    parent.updateWorldMatrix(false, false);
    p.mesh.position.copy(parent.worldToLocal(target));
  }
}
