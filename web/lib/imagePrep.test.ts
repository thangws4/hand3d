import { test } from "node:test";
import assert from "node:assert/strict";
import { checkImage, fitWithin, MAX_BYTES } from "./imagePrep.ts";

test("checkImage nhận jpg/png/webp dưới 10 MB", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    assert.equal(checkImage({ type, size: 1000 }), null);
  }
});

test("checkImage từ chối định dạng khác và ảnh quá lớn với mã bad_image", () => {
  assert.equal(checkImage({ type: "image/gif", size: 1000 })?.code, "bad_image");
  assert.equal(checkImage({ type: "", size: 1000 })?.code, "bad_image");
  assert.equal(checkImage({ type: "image/png", size: MAX_BYTES + 1 })?.code, "bad_image");
});

test("fitWithin thu nhỏ cạnh dài về 1024, giữ tỉ lệ, không phóng to ảnh nhỏ", () => {
  assert.deepEqual(fitWithin(4000, 3000), { width: 1024, height: 768 });
  assert.deepEqual(fitWithin(3000, 4000), { width: 768, height: 1024 });
  assert.deepEqual(fitWithin(8000, 1000), { width: 1024, height: 128 });
  assert.deepEqual(fitWithin(640, 480), { width: 640, height: 480 });
});
