import { test } from "node:test";
import assert from "node:assert/strict";
import { Controller, type Hand } from "./controller.ts";
import type { Landmark } from "./gestures.ts";
import { fist, peace, pinch, point, thumbsUp } from "./testing.ts";

const R = (landmarks: Landmark[]): Hand => ({ landmarks, side: "Right" });
const L = (landmarks: Landmark[]): Hand => ({ landmarks, side: "Left" });
const DT = 1 / 60;
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test("PINCH + di tay sang phải → xoay quanh trục y (âm, theo quy ước Ursina)", () => {
  const c = new Controller();
  c.step([R(pinch(0.5, 0.2))], DT); // khung đầu chỉ ghi nhớ vị trí
  c.step([R(pinch(0.6, 0.2))], DT); // EMA: 0.3·0.6 + 0.7·0.5 = 0.53 → dx = 0.03
  close(c.transform.rotY, -0.03 * 300);
  close(c.transform.rotX, 0);
});

test("POINT + di tay → dịch model", () => {
  const c = new Controller();
  c.step([R(point(0.5, 0.2))], DT);
  c.step([R(point(0.6, 0.3))], DT); // dx = 0.03, dy = 0.03
  close(c.transform.x, 0.03 * 20);
  close(c.transform.y, -0.03 * 20);
});

test("PEACE + kéo lên → phóng to", () => {
  const c = new Controller();
  c.step([R(peace(0.5, 0.2))], DT);
  c.step([R(peace(0.5, 0.1))], DT); // dy = -0.03
  close(c.transform.zoom, 1 + 0.03 * 3);
});

test("Chụm 2 tay kéo xa → zoom theo tỉ lệ khoảng cách, bị kẹp trong [0.2, 5]", () => {
  const c = new Controller();
  c.step([L(pinch(0.3, 0.2)), R(pinch(0.7, 0.2))], DT); // d0 = 0.4
  c.step([L(pinch(0.2, 0.2)), R(pinch(0.8, 0.2))], DT); // d = 0.6
  close(c.transform.zoom, 1.5);
  c.step([L(pinch(0.5, 0.2)), R(pinch(0.5005, 0.2))], DT); // gần như chạm nhau
  close(c.transform.zoom, 0.2);
});

test("FIST đặt lại mọi thứ, kể cả khi tay kia đang chụm", () => {
  const c = new Controller();
  c.step([R(point(0.5, 0.2))], DT);
  c.step([R(point(0.8, 0.3))], DT);
  assert.notEqual(c.transform.x, 0); // đã thực sự dịch trước khi nắm tay
  c.step([L(fist()), R(pinch(0.5, 0.2))], DT);
  assert.deepEqual(c.transform, { rotX: 0, rotY: 0, x: 0, y: 0, zoom: 1 });
});

test("THUMBS_UP tự quay theo dt; dt quá lớn (tab bị ẩn) bị kẹp ở 0.1s", () => {
  const c = new Controller();
  c.step([R(thumbsUp())], 0.05);
  close(c.transform.rotY, 90 * 0.05);
  c.step([R(thumbsUp())], 10);
  close(c.transform.rotY, 90 * 0.05 + 90 * 0.1);
});

test("Đổi cử chỉ giữa chừng không làm model giật", () => {
  const c = new Controller();
  c.step([R(pinch(0.5, 0.2))], DT);
  assert.deepEqual(c.step([R(point(0.9, 0.3))], DT), ["POINT"]); // khung đầu của POINT: chỉ ghi nhớ
  assert.deepEqual(c.transform, { rotX: 0, rotY: 0, x: 0, y: 0, zoom: 1 });
});

test("Tay biến mất rồi quay lại chỗ khác: không nhảy", () => {
  const c = new Controller();
  c.step([R(pinch(0.2, 0.2))], DT);
  c.step([], DT);
  c.step([R(pinch(0.9, 0.2))], DT);
  close(c.transform.rotY, 0);
});

test("step trả về cử chỉ của từng tay theo thứ tự", () => {
  const c = new Controller();
  assert.deepEqual(c.step([L(fist()), R(point(0.5, 0.2))], DT), ["FIST", "POINT"]);
});
