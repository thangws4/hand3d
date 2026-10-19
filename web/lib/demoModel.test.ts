import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_NAME, DEMO_PARTS } from "./demoModel.ts";

test("robot mẫu có ≥ 6 linh kiện, id và tên không trùng, hình hợp lệ", () => {
  assert.equal(DEMO_NAME, "Robot mẫu");
  assert.ok(DEMO_PARTS.length >= 6);
  assert.equal(new Set(DEMO_PARTS.map((p) => p.id)).size, DEMO_PARTS.length);
  assert.equal(new Set(DEMO_PARTS.map((p) => p.name)).size, DEMO_PARTS.length);
  for (const p of DEMO_PARTS) {
    assert.ok(["box", "cylinder", "sphere"].includes(p.shape), p.id);
    assert.ok(p.size.every((s) => s > 0), p.id);
    assert.match(p.color, /^#[0-9a-f]{6}$/i, p.id);
  }
});
