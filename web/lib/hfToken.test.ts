import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidToken, loadToken, maskToken } from "./hfToken.ts";

const GOOD = "hf_" + "aB3".repeat(12); // 36 ký tự sau hf_

test("isValidToken nhận token hf_ đủ dài, kể cả khi dán kèm khoảng trắng/xuống dòng", () => {
  assert.equal(isValidToken(GOOD), true);
  assert.equal(isValidToken(`  ${GOOD}\n`), true);
});

test("isValidToken từ chối token sai tiền tố, quá ngắn hoặc có ký tự lạ", () => {
  assert.equal(isValidToken("hf_short"), false);
  assert.equal(isValidToken("sk-" + "a".repeat(40)), false);
  assert.equal(isValidToken("hf_" + "a".repeat(20) + "-" + "b".repeat(15)), false);
  assert.equal(isValidToken(""), false);
});

test("loadToken trả chuỗi rỗng khi không có localStorage (ngoài trình duyệt)", () => {
  assert.equal(loadToken(), "");
});

test("maskToken chỉ để lộ 4 ký tự cuối", () => {
  assert.equal(maskToken(GOOD), "hf_••••" + GOOD.slice(-4));
});

test("pickToken: ưu tiên token đã lưu trên trang, sau đó mới tới token từ .env.local (nếu hợp lệ)", async () => {
  const { pickToken } = await import("./hfToken.ts");
  assert.equal(pickToken(GOOD, "hf_" + "z".repeat(34)), GOOD);
  assert.equal(pickToken("", ` ${GOOD} `), GOOD);
  assert.equal(pickToken("", "hf_sai"), "");
  assert.equal(pickToken("", ""), "");
});
