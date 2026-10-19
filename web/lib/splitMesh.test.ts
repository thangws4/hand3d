import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { splitMesh } from "./splitMesh.ts";

function twoTriangles(interleaved = false) {
  const pos = [0, 0, 0, 1, 0, 0, 0, 1, 0, 5, 0, 0, 6, 0, 0, 5, 1, 0];
  const uv = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
  const g = new THREE.BufferGeometry();
  if (interleaved) {
    const data: number[] = [];
    for (let i = 0; i < 6; i++) data.push(...pos.slice(3 * i, 3 * i + 3), ...uv.slice(2 * i, 2 * i + 2));
    const ib = new THREE.InterleavedBuffer(new Float32Array(data), 5);
    g.setAttribute("position", new THREE.InterleavedBufferAttribute(ib, 3, 0));
    g.setAttribute("uv", new THREE.InterleavedBufferAttribute(ib, 2, 3));
  } else {
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  }
  g.setIndex([0, 1, 2, 3, 4, 5]);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial());
  m.position.set(1, 2, 3);
  return m;
}

const worldVerts = (meshes: THREE.Mesh[]) =>
  meshes
    .flatMap((m) => {
      m.updateMatrixWorld(true);
      const p = m.geometry.getAttribute("position");
      return Array.from({ length: p.count }, (_, i) =>
        new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(m.matrixWorld).toArray().map((v) => +v.toFixed(5)).join(","),
      );
    })
    .sort();

test("mesh 2 mảnh rời → 2 mesh: đủ tam giác, đủ attribute, cùng material, vị trí world không đổi", () => {
  const src = twoTriangles();
  const parts = splitMesh(src);
  assert.equal(parts.length, 2);
  assert.equal(parts.reduce((n, m) => n + (m.geometry.index?.count ?? 0) / 3, 0), 2);
  for (const m of parts) {
    assert.ok(m.geometry.getAttribute("position") && m.geometry.getAttribute("uv"));
    assert.equal(m.material, src.material);
  }
  assert.deepEqual(worldVerts(parts), worldVerts([src]));
});

test("attribute xen kẽ (interleaved, GLTFLoader có thể tạo) vẫn tách và chép đúng", () => {
  const src = twoTriangles(true);
  const parts = splitMesh(src);
  assert.equal(parts.length, 2);
  assert.deepEqual(worldVerts(parts), worldVerts([src]));
  const uv = parts[0].geometry.getAttribute("uv");
  assert.equal(uv.itemSize, 2);
});

test("một mảnh liền hoặc không có index → không tách", () => {
  const one = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  assert.deepEqual(splitMesh(one), []);
  const noIndex = new THREE.Mesh(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3)));
  assert.deepEqual(splitMesh(noIndex), []);
});
