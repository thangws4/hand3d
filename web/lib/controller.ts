/** Biến cử chỉ tay thành phép biến đổi model — port logic update() của main.py. Thuần, không phụ thuộc React/three. */
import { classify, dist, Smooth, type Gesture, type Landmark } from "./gestures.ts";

export const ROT_SENS = 300; // độ xoay khi tay quét hết chiều ngang khung hình
export const PAN_SENS = 20; // đơn vị dịch chuyển khi tay quét hết khung hình
export const ZOOM_SENS = 3; // chữ V: kéo lên 1/10 khung hình → to thêm ~30%
export const SPIN_SPEED = 90; // độ/giây khi giơ ngón cái
export const ZOOM_MIN = 0.2, ZOOM_MAX = 5;
export const MAX_DT = 0.1; // tab bị ẩn rồi mở lại: không cho dt lớn làm model quay vọt
const DRAG_GESTURES: Gesture[] = ["PINCH", "POINT", "PEACE"];

export type Hand = { landmarks: Landmark[]; side: "Left" | "Right" };
/** Góc tính bằng độ (quy ước Ursina); zoom tương đối, 1 = vừa khung. */
export type Transform = { rotX: number; rotY: number; x: number; y: number; zoom: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const initial = (): Transform => ({ rotX: 0, rotY: 0, x: 0, y: 0, zoom: 1 });

export class Controller {
  transform: Transform = initial();
  #drag: { gesture: Gesture; x: number; y: number } | null = null; // vị trí khung trước
  #zoomStart: { d0: number; z0: number } | null = null; // lúc bắt đầu zoom 2 tay
  #smoothX = new Smooth();
  #smoothY = new Smooth();

  reset(): void {
    this.transform = initial();
    this.#drag = null;
    this.#zoomStart = null;
  }

  step(hands: Hand[], dt: number): Gesture[] {
    dt = Math.min(dt, MAX_DT);
    const gestures = hands.map((h) => classify(h.landmarks));
    const pinches = hands.filter((_, i) => gestures[i] === "PINCH");
    const t = this.transform;

    if (gestures.includes("FIST")) {
      this.reset();
      return gestures;
    }
    if (pinches.length === 2) {
      this.#drag = null;
      const d = dist(pinches[0].landmarks[8], pinches[1].landmarks[8]);
      this.#zoomStart ??= { d0: Math.max(d, 1e-6), z0: t.zoom };
      t.zoom = clamp((this.#zoomStart.z0 * d) / this.#zoomStart.d0, ZOOM_MIN, ZOOM_MAX);
      return gestures;
    }
    this.#zoomStart = null;
    if (gestures.includes("THUMBS_UP")) t.rotY += SPIN_SPEED * dt;

    const i = gestures.findIndex((g) => DRAG_GESTURES.includes(g));
    if (i < 0) {
      this.#drag = null; // thả tay: "nhả ly hợp", model đứng yên
      return gestures;
    }
    const g = gestures[i];
    const tip = hands[i].landmarks[8];
    let prev = this.#drag;
    if (!prev || prev.gesture !== g) {
      // vừa đổi cử chỉ: xoá lịch sử lọc để không bị giật
      this.#smoothX.reset();
      this.#smoothY.reset();
      prev = null;
    }
    const x = this.#smoothX.next(tip.x);
    const y = this.#smoothY.next(tip.y);
    if (prev) {
      const dx = x - prev.x, dy = y - prev.y;
      if (g === "PINCH") {
        t.rotY -= dx * ROT_SENS;
        t.rotX -= dy * ROT_SENS;
      } else if (g === "POINT") {
        t.x += dx * PAN_SENS;
        t.y -= dy * PAN_SENS; // ảnh: y tăng xuống dưới; 3D: y tăng lên trên
      } else {
        t.zoom = clamp(t.zoom * (1 - dy * ZOOM_SENS), ZOOM_MIN, ZOOM_MAX); // PEACE: kéo lên = phóng to
      }
    }
    this.#drag = { gesture: g, x, y };
    return gestures;
  }
}
