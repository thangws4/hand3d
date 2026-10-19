import { test } from "node:test";
import assert from "node:assert/strict";
import { nextTimestamp, toHands } from "./hands.ts";

test("toHands lật gương x và đổi nhãn Left↔Right (MediaPipe giả định ảnh đã lật)", () => {
  const hands = toHands({
    landmarks: [[{ x: 0.2, y: 0.3, z: 0 }], [{ x: 0.9, y: 0.1, z: 0.5 }]],
    handedness: [[{ categoryName: "Left" }], [{ categoryName: "Right" }]],
  });
  assert.deepEqual(hands, [
    { landmarks: [{ x: 0.8, y: 0.3, z: 0 }], side: "Right" },
    { landmarks: [{ x: 0.09999999999999998, y: 0.1, z: 0.5 }], side: "Left" },
  ]);
});

test("nextTimestamp luôn tăng nghiêm ngặt, kể cả khi đồng hồ đứng yên hoặc lùi", () => {
  assert.equal(nextTimestamp(0, 1000.7), 1000);
  assert.equal(nextTimestamp(1000, 1000.2), 1001);
  assert.equal(nextTimestamp(1001, 500), 1002);
});
