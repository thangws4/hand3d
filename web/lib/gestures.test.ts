import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, Smooth } from "./gestures.ts";
import { fist, makeHand, peace, pinch, point, thumbsUp } from "./testing.ts";

test("classify nhận đúng 6 cử chỉ", () => {
  assert.equal(classify(makeHand([0.2, 0.2, 0.2, 0.2], [0.2, 0.5])), "OPEN");
  assert.equal(classify(fist()), "FIST");
  assert.equal(classify(makeHand([0.2, 0.2, 0.2, 0.2], [0.5, 0.22])), "PINCH");
  assert.equal(classify(point(0.5, 0.2)), "POINT");
  assert.equal(classify(peace(0.5, 0.2)), "PEACE");
  assert.equal(classify(thumbsUp()), "THUMBS_UP");
});

test("helper pinch ở nhiều vị trí vẫn là PINCH", () => {
  for (const [x, y] of [[0.2, 0.2], [0.5, 0.1], [0.8, 0.3]] as const) {
    assert.equal(classify(pinch(x, y)), "PINCH");
  }
});

test("Smooth là EMA và reset xoá lịch sử", () => {
  const s = new Smooth(0.5);
  assert.equal(s.next(0), 0);
  assert.equal(s.next(10), 5);
  s.reset();
  assert.equal(s.next(8), 8);
});
