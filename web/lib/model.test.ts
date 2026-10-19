import { test } from "node:test";
import assert from "node:assert/strict";
import { clearModel, fitScale, getModel, isModelFile, setModel } from "./model.ts";

test("fitScale đưa cạnh dài nhất về FIT_SIZE và không chia cho 0", () => {
  assert.equal(fitScale({ x: 2, y: 8, z: 1 }), 0.5);
  assert.ok(Number.isFinite(fitScale({ x: 0, y: 0, z: 0 })));
});

test("isModelFile chỉ nhận .glb/.gltf, không phân biệt hoa thường", () => {
  assert.equal(isModelFile("robot.GLB"), true);
  assert.equal(isModelFile("scene.gltf"), true);
  assert.equal(isModelFile("robot.obj"), false);
  assert.equal(isModelFile("anh.png"), false);
});

test("setModel lưu model dùng chung giữa các trang, clearModel xoá", () => {
  clearModel();
  assert.equal(getModel(), null);
  const m = setModel(new Blob(["x"]), "a.glb");
  assert.deepEqual(getModel(), m);
  assert.match(m.url, /^blob:/);
  clearModel();
  assert.equal(getModel(), null);
});
