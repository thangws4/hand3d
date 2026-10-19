import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyError, errorMessage, GenError } from "./genErrors.ts";

// Thông điệp thật thu được ở spike 2026-10-19 (gọi ẩn danh và với token giả)
const ANON_QUOTA =
  "You have exceeded your ZeroGPU quota (120s requested vs. 178s left). Try again in 23:59:57. Authenticate with a Hugging Face token for more quota - https://huggingface.co/settings/tokens";

test("quota kèm câu 'Authenticate…' nghĩa là token không được chấp nhận → bad_token", () => {
  const e = classifyError({ type: "status", stage: "error", title: "ZeroGPU quota exceeded", message: ANON_QUOTA });
  assert.equal(e.code, "bad_token");
  assert.equal(e.retryIn, "23:59:57");
});

test("hết hạn mức của tài khoản có token (không có câu Authenticate) → quota, trích thời gian chờ", () => {
  const e = classifyError({ title: "ZeroGPU quota exceeded", message: "You have exceeded your ZeroGPU quota (120s requested vs. 40s left). Try again in 5:12:00." });
  assert.equal(e.code, "quota");
  assert.equal(e.retryIn, "5:12:00");
  assert.match(errorMessage(e), /5:12:00/);
});

test("lỗi worker / mạng / Space không chạy → space_down", () => {
  assert.equal(classifyError({ title: "ZeroGPU worker error", message: "RuntimeError" }).code, "space_down");
  assert.equal(classifyError(new TypeError("Failed to fetch")).code, "space_down");
  assert.equal(classifyError(new Error("Could not resolve app config")).code, "space_down");
});

test("401/Invalid token → bad_token", () => {
  assert.equal(classifyError(new Error("Invalid user token")).code, "bad_token");
  assert.equal(classifyError("HTTP 401 Unauthorized").code, "bad_token");
});

test("message dạng mảng ValidationError vẫn ra chữ đọc được", () => {
  const e = classifyError({ title: "Error", message: [{ is_valid: false, message: "Ảnh rỗng" }] });
  assert.equal(e.code, "unknown");
  assert.match(errorMessage(e), /Ảnh rỗng/);
});

test("không nhận ra → fallback; GenError đi qua nguyên vẹn", () => {
  assert.equal(classifyError("lạ quá").code, "unknown");
  assert.equal(classifyError("lạ quá", "space_down").code, "space_down");
  const g = new GenError("timeout", "x");
  assert.equal(classifyError(g), g);
});

test("mỗi mã lỗi có thông điệp tiếng Việt riêng", () => {
  const codes = ["bad_image", "bad_token", "quota", "space_down", "timeout", "cancelled", "unknown"] as const;
  const texts = codes.map((c) => errorMessage(new GenError(c, "gốc")));
  assert.equal(new Set(texts).size, codes.length);
  assert.match(errorMessage(new GenError("bad_token", "")), /huggingface\.co\/settings\/tokens/);
});

test("Space bận (queue full) → space_down; không được phép truy cập Space → bad_token", () => {
  assert.equal(classifyError(new Error("This application is currently busy. Please try again.")).code, "space_down");
  assert.equal(classifyError(new Error("Not authorized to access this space.")).code, "bad_token");
});
