import { test } from "node:test";
import assert from "node:assert/strict";
import { groupTriangles } from "./looseParts.ts";

/** Tam giác vuông cạnh `s` đặt ở x0. Trả về 3 đỉnh (9 số). */
const tri = (x0: number, s: number) => [x0, 0, 0, x0 + s, 0, 0, x0, s, 0];
/** Ghép nhiều tam giác rời (mỗi tam giác 3 đỉnh riêng). */
function soup(tris: number[][]) {
  const positions = new Float32Array(tris.flat());
  const index = Uint32Array.from({ length: tris.length * 3 }, (_, i) => i);
  return { positions, index };
}

test("hai tam giác rời nhau → 2 nhóm", () => {
  const { positions, index } = soup([tri(0, 1), tri(5, 1)]);
  const g = groupTriangles(positions, index);
  assert.equal(g.groupCount, 2);
  assert.notEqual(g.groupOfTriangle[0], g.groupOfTriangle[1]);
});

test("hai tam giác chung cạnh nhưng đỉnh nhân đôi (đường nối UV) → 1 nhóm", () => {
  // tam giác 2 dùng lại 2 đỉnh của tam giác 1 qua bản sao cùng vị trí, khác chỉ số
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, /* bản sao */ 1, 0, 0, 0, 1, 0, 1, 1, 0]);
  const g = groupTriangles(positions, Uint32Array.from([0, 1, 2, 3, 4, 5]));
  assert.equal(g.groupCount, 1);
});

test("mảnh nhỏ nằm sát mảnh lớn A được gộp vào A, không vào B ở xa", () => {
  const { positions, index } = soup([tri(0, 10), tri(100, 10), tri(10.5, 0.1)]);
  const g = groupTriangles(positions, index, 2);
  assert.equal(g.groupCount, 2);
  assert.equal(g.groupOfTriangle[2], g.groupOfTriangle[0]);
});

test("nhiều mảnh hơn giới hạn → đúng maxParts nhóm, giữ mảnh lớn nhất, nhóm 0 là lớn nhất", () => {
  const { positions, index } = soup([tri(0, 3), tri(6, 5), tri(12, 1), tri(18, 4), tri(24, 2)]);
  const g = groupTriangles(positions, index, 3);
  assert.equal(g.groupCount, 3);
  assert.equal(g.groupOfTriangle[1], 0); // cạnh 5
  assert.equal(g.groupOfTriangle[3], 1); // cạnh 4
  assert.equal(g.groupOfTriangle[0], 2); // cạnh 3
  assert.ok([0, 1, 2].includes(g.groupOfTriangle[2])); // mảnh nhỏ đã gộp
  assert.ok([0, 1, 2].includes(g.groupOfTriangle[4]));
});

test("model liền khối kèm vài mảnh vụn li ti (thường gặp ở model AI/quét) → không tách", () => {
  const { positions, index } = soup([tri(0, 10), tri(2, 0.01), tri(5, 0.01), tri(12, 0.02)]);
  assert.equal(groupTriangles(positions, index).groupCount, 1);
});
