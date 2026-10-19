import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { makeParts, placeParts } from "./placeParts.ts";

const box = (x: number) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  m.position.set(x, 0, 0);
  return m;
};
const worldX = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3()).x;
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≠ ${b}`);

function scene() {
  const rig = new THREE.Group(); // Rig: xoay/zoom theo Controller
  const root = new THREE.Group();
  rig.add(root);
  return { rig, root };
}

test("mesh lồng trong mesh: linh kiện con chỉ dịch theo offset của chính nó (không cộng dồn của cha)", () => {
  const { rig, root } = scene();
  const p = box(2), c = box(2), q = box(-6); // C nằm trong P → world x = 4
  p.add(c);
  root.add(p, q);
  rig.updateMatrixWorld(true);
  const parts = makeParts(root);
  assert.equal(parts.length, 3);
  // bbox cả model: x ∈ [-6.5, 4.5] → tâm -1; explode 1 → mỗi linh kiện dịch thêm (tâm nó − (−1))
  placeParts(parts, 1, {});
  rig.updateMatrixWorld(true);
  close(worldX(p), 2 + 3);
  close(worldX(c), 4 + 5);
  close(worldX(q), -6 - 5);
});

test("offset cầm neo theo model: kéo khi model xoay 180° đi sang phải màn hình, xoay lại thì linh kiện đi theo model", () => {
  const { rig, root } = scene();
  const m = box(0);
  root.add(m);
  rig.updateMatrixWorld(true);
  const parts = makeParts(root);
  const id = parts[0].id;
  rig.rotation.y = Math.PI;
  rig.updateMatrixWorld(true);
  placeParts(parts, 0, { [id]: { x: 1, y: 0 } }); // kéo sang phải 1 đơn vị world
  rig.updateMatrixWorld(true);
  close(worldX(m), 1);
  rig.rotation.y = 0; // xoay model lại, không kéo thêm
  rig.updateMatrixWorld(true);
  placeParts(parts, 0, { [id]: { x: 1, y: 0 } });
  rig.updateMatrixWorld(true);
  close(worldX(m), -1); // linh kiện xoay cùng model
  rig.scale.setScalar(3); // zoom: khoảng lệch phóng to cùng model
  rig.updateMatrixWorld(true);
  placeParts(parts, 0, { [id]: { x: 1, y: 0 } });
  rig.updateMatrixWorld(true);
  close(worldX(m), -3);
});

test("offset bị xoá (nắm tay) → linh kiện về đúng chỗ gốc", () => {
  const { rig, root } = scene();
  const m = box(0.5);
  root.add(m);
  rig.updateMatrixWorld(true);
  const parts = makeParts(root);
  placeParts(parts, 0, { [parts[0].id]: { x: 2, y: 0 } });
  placeParts(parts, 0, {});
  rig.updateMatrixWorld(true);
  close(worldX(m), 0.5);
});
