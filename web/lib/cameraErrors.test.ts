import { test } from "node:test";
import assert from "node:assert/strict";
import { cameraErrorMessage, shouldRetryDefault } from "./cameraErrors.ts";

const err = (name: string) => new DOMException("x", name);

test("mỗi loại lỗi camera có thông điệp riêng", () => {
  assert.match(cameraErrorMessage(err("NotAllowedError")), /quyền camera/);
  assert.match(cameraErrorMessage(err("NotFoundError")), /Không tìm thấy camera/);
  assert.match(cameraErrorMessage(err("NotReadableError")), /đang được ứng dụng khác dùng/);
  assert.match(cameraErrorMessage(new Error("boom")), /boom/);
  assert.match(cameraErrorMessage("lạ"), /lạ/);
});

test("chỉ tự thử camera mặc định khi đang chọn camera cụ thể và camera đó không còn", () => {
  assert.equal(shouldRetryDefault(err("OverconstrainedError"), "abc"), true);
  assert.equal(shouldRetryDefault(err("NotFoundError"), "abc"), true);
  assert.equal(shouldRetryDefault(err("NotFoundError"), ""), false);
  assert.equal(shouldRetryDefault(err("NotAllowedError"), "abc"), false);
});
