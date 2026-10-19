/** Tách một mesh thành nhiều mesh theo mảnh rời (three, không React → test bằng Node). */
import * as THREE from "three";
import { groupTriangles, MAX_AUTO_PARTS } from "./looseParts.ts";

export const AUTO_SPLIT_MAX_MESHES = 4; // model có nhiều mesh hơn coi như đã chia linh kiện sẵn

export function splitMesh(mesh: THREE.Mesh, maxParts = MAX_AUTO_PARTS): THREE.Mesh[] {
  const geo = mesh.geometry;
  const index = geo.index;
  const pos = geo.getAttribute("position");
  if (!index || !pos || Array.isArray(mesh.material) || geo.groups.length > 1) return [];

  const flat = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    flat[3 * i] = pos.getX(i);
    flat[3 * i + 1] = pos.getY(i);
    flat[3 * i + 2] = pos.getZ(i);
  }
  const { groupOfTriangle, groupCount } = groupTriangles(flat, index.array, maxParts);
  if (groupCount < 2) return [];

  const tris: number[][] = Array.from({ length: groupCount }, () => []);
  for (let t = 0; t < groupOfTriangle.length; t++) tris[groupOfTriangle[t]].push(t);

  return tris.map((list) => {
    const remap = new Map<number, number>();
    const newIndex: number[] = [];
    for (const t of list) {
      for (let k = 0; k < 3; k++) {
        const v = index.getX(3 * t + k);
        let n = remap.get(v);
        if (n === undefined) remap.set(v, (n = remap.size));
        newIndex.push(n);
      }
    }
    const out = new THREE.BufferGeometry();
    const olds = [...remap.keys()];
    for (const [name, attr] of Object.entries(geo.attributes)) {
      const size = attr.itemSize;
      const Ctor = attr.array.constructor as new (n: number) => THREE.TypedArray;
      const arr = new Ctor(olds.length * size);
      // getComponent đọc đúng cả attribute xen kẽ (InterleavedBufferAttribute)
      olds.forEach((old, i) => {
        for (let c = 0; c < size; c++) arr[i * size + c] = attr.getComponent(old, c);
      });
      out.setAttribute(name, new THREE.BufferAttribute(arr, size, attr.normalized));
    }
    out.setIndex(newIndex);
    const m = new THREE.Mesh(out, mesh.material);
    m.position.copy(mesh.position);
    m.quaternion.copy(mesh.quaternion);
    m.scale.copy(mesh.scale);
    return m;
  });
}
