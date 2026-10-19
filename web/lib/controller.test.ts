import { test } from "node:test";
import assert from "node:assert/strict";
import { Controller, type Hand } from "./controller.ts";
import type { Landmark } from "./gestures.ts";
import { fist, open, peace, pinch, point, thumbsUp } from "./testing.ts";

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
  assert.deepEqual(c.transform, { rotX: 0, rotY: 0, x: 0, y: 0, zoom: 1, explode: 0, partOffsets: {} });
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
  assert.deepEqual(c.transform, { rotX: 0, rotY: 0, x: 0, y: 0, zoom: 1, explode: 0, partOffsets: {} });
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

const onHead = (x: number) => (x > 0.4 && x < 0.6 ? "dau" : null); // hitTest giả: linh kiện "dau" ở giữa màn hình

test("xoè 2 tay kéo xa/gần → độ bung tăng/giảm theo khoảng cách, kẹp trong [0, 1.5]", () => {
  const c = new Controller();
  c.step([L(open(-0.2)), R(open(0.2))], DT); // d0 = 0.4
  c.step([L(open(-0.3)), R(open(0.3))], DT); // d = 0.6
  close(c.transform.explode, 0.2 * 3);
  c.step([L(open(-0.5)), R(open(0.5))], DT);
  close(c.transform.explode, 1.5);
  c.step([L(open(-0.05)), R(open(0.05))], DT);
  close(c.transform.explode, 0);
});

test("đang bung mà một tay bị nhận nhầm 1 khung → khi xoè lại không nhảy", () => {
  const c = new Controller();
  c.step([L(open(-0.2)), R(open(0.2))], DT);
  c.step([L(open(-0.3)), R(open(0.3))], DT); // explode 0.6
  c.step([L(open(-0.3)), R(point(0.7, 0.3))], DT); // ngắt quãng
  c.step([L(open(-0.4)), R(open(0.4))], DT); // mốc mới: không đổi ngay
  close(c.transform.explode, 0.6);
});

test("chụm khi con trỏ nằm trên linh kiện → cầm nó: linh kiện dịch theo tay, model không xoay", () => {
  const c = new Controller();
  c.step([R(pinch(0.5, 0.2))], DT, onHead);
  assert.equal(c.grabbed, "dau");
  c.step([R(pinch(0.6, 0.2))], DT, onHead); // dx = 0.03 (EMA)
  close(c.transform.partOffsets.dau.x, 0.03 * 20);
  close(c.transform.partOffsets.dau.y, 0);
  close(c.transform.rotY, 0);
  assert.equal(c.grabbed, "dau"); // con trỏ đã rời linh kiện nhưng vẫn đang cầm
});

test("chụm ở chỗ trống → xoay model như cũ, không cầm gì", () => {
  const c = new Controller();
  c.step([R(pinch(0.8, 0.2))], DT, onHead);
  c.step([R(pinch(0.9, 0.2))], DT, onHead);
  assert.equal(c.grabbed, null);
  assert.ok(c.transform.rotY < 0);
  assert.deepEqual(c.transform.partOffsets, {});
});

test("mất tay khi đang cầm → thả, linh kiện nằm yên ở vị trí mới", () => {
  const c = new Controller();
  c.step([R(pinch(0.5, 0.2))], DT, onHead);
  c.step([R(pinch(0.6, 0.2))], DT, onHead);
  const kept = { ...c.transform.partOffsets.dau };
  c.step([], DT, onHead);
  assert.equal(c.grabbed, null);
  assert.deepEqual(c.transform.partOffsets.dau, kept);
});

test("đang cầm mà tay kia chụm (zoom 2 tay) → thả linh kiện", () => {
  const c = new Controller();
  c.step([R(pinch(0.5, 0.2))], DT, onHead);
  c.step([L(pinch(0.2, 0.2)), R(pinch(0.5, 0.2))], DT, onHead);
  assert.equal(c.grabbed, null);
});

test("nắm tay → ráp lại: độ bung 0, offset linh kiện rỗng, không cầm gì", () => {
  const c = new Controller();
  c.step([L(open(-0.2)), R(open(0.2))], DT);
  c.step([L(open(-0.3)), R(open(0.3))], DT);
  c.step([R(pinch(0.5, 0.2))], DT, onHead);
  c.step([R(pinch(0.6, 0.2))], DT, onHead);
  c.step([R(fist())], DT, onHead);
  assert.equal(c.transform.explode, 0);
  assert.deepEqual(c.transform.partOffsets, {});
  assert.equal(c.grabbed, null);
});

test("con trỏ = đầu ngón trỏ của tay đầu tiên; không có tay → null; hovered theo hitTest", () => {
  const c = new Controller();
  c.step([R(point(0.5, 0.4))], DT, onHead);
  assert.deepEqual(c.cursor, { x: 0.5, y: 0.4 });
  assert.equal(c.hovered, "dau");
  c.step([], DT, onHead);
  assert.equal(c.cursor, null);
  assert.equal(c.hovered, null);
});

test("có 2 tay: con trỏ và linh kiện được cầm theo tay đang chụm, không phải hands[0]", () => {
  const c = new Controller();
  const hit = (x: number) => (x < 0.3 ? "trai" : x > 0.7 ? "phai" : null);
  // tay trái xoè (ngón trỏ ở x=0.2 → trên "trai"), tay phải chụm ở x=0.8 → trên "phai"
  c.step([L(open(-0.3)), R(pinch(0.8, 0.2))], DT, hit);
  assert.equal(c.grabbed, "phai");
  assert.deepEqual(c.cursor, { x: 0.8, y: 0.2 });
});
