import { test } from "node:test";
import assert from "node:assert/strict";
import { explodeOffset } from "./parts.ts";

test("explodeOffset = (tâm linh kiện − tâm model) × độ bung", () => {
  assert.deepEqual(explodeOffset({ x: 2, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 0.5), { x: 1, y: 0, z: 0 });
  assert.deepEqual(explodeOffset({ x: 1, y: 2, z: 3 }, { x: 1, y: 1, z: 1 }, 2), { x: 0, y: 2, z: 4 });
});

test("độ bung 0 hoặc linh kiện nằm đúng tâm → không dịch", () => {
  assert.deepEqual(explodeOffset({ x: 5, y: -1, z: 2 }, { x: 0, y: 0, z: 0 }, 0), { x: 0, y: 0, z: 0 });
  assert.deepEqual(explodeOffset({ x: 1, y: 1, z: 1 }, { x: 1, y: 1, z: 1 }, 1.5), { x: 0, y: 0, z: 0 });
});
