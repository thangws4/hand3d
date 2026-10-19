/** Biến cử chỉ tay thành phép biến đổi model — port logic update() của main.py. Thuần, không phụ thuộc React/three. */
import { classify, dist, Smooth, type Gesture, type Landmark } from "./gestures.ts";
import type { Vec2 } from "./parts.ts";

export const ROT_SENS = 300; // độ xoay khi tay quét hết chiều ngang khung hình
export const PAN_SENS = 20; // đơn vị dịch chuyển khi tay quét hết khung hình
export const ZOOM_SENS = 3; // chữ V: kéo lên 1/10 khung hình → to thêm ~30%
export const SPIN_SPEED = 90; // độ/giây khi giơ ngón cái
export const ZOOM_MIN = 0.2, ZOOM_MAX = 5;
export const EXPLODE_SENS = 3; // xoè 2 tay: kéo xa thêm 1/10 khung hình → bung thêm 0.3
export const EXPLODE_MAX = 1.5;
export const MAX_DT = 0.1; // tab bị ẩn rồi mở lại: không cho dt lớn làm model quay vọt
export const WHEEL_SENS = 0.0015; // lăn chuột: zoom × exp(−deltaY × WHEEL_SENS)
const DRAG_GESTURES: Gesture[] = ["PINCH", "POINT", "PEACE"];

export type Hand = { landmarks: Landmark[]; side: "Left" | "Right" };
/** Góc tính bằng độ (quy ước Ursina); zoom tương đối, 1 = vừa khung; partOffsets theo mặt phẳng màn hình (đơn vị world). */
export type Transform = {
  rotX: number;
  rotY: number;
  x: number;
  y: number;
  zoom: number;
  explode: number;
  partOffsets: Record<string, Vec2>;
};
/** Linh kiện nằm dưới điểm (x, y) chuẩn hoá của khung 3D, hoặc null. */
export type HitTest = (x: number, y: number) => string | null;
/** Chuột trái/một ngón = rotate (bắt đầu trên linh kiện → cầm); chuột phải hoặc Shift + trái = pan. */
export type PointerMode = "rotate" | "pan";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const initial = (): Transform => ({ rotX: 0, rotY: 0, x: 0, y: 0, zoom: 1, explode: 0, partOffsets: {} });

export class Controller {
  transform: Transform = initial();
  cursor: Vec2 | null = null; // đầu ngón trỏ tay đầu tiên
  hovered: string | null = null; // linh kiện dưới con trỏ
  grabbed: string | null = null; // linh kiện đang cầm
  pointerGrab: string | null = null; // linh kiện đang cầm bằng chuột (tách khỏi tay)
  pointerHovered: string | null = null; // linh kiện dưới chuột
  #pointer: { mode: PointerMode | "grab"; x: number; y: number } | null = null; // điểm kéo chuột trước
  #drag: { gesture: Gesture; x: number; y: number } | null = null; // vị trí khung trước
  #zoomStart: { d0: number; z0: number } | null = null; // lúc bắt đầu zoom 2 tay
  #explodeStart: { d0: number; e0: number } | null = null; // lúc bắt đầu xoè 2 tay
  #smoothX = new Smooth();
  #smoothY = new Smooth();

  reset(): void {
    this.transform = initial();
    this.grabbed = null;
    this.#drag = null;
    this.#zoomStart = null;
    this.#explodeStart = null;
    this.pointerGrab = null;
    this.#pointer = null;
  }

  pointerDown(x: number, y: number, mode: PointerMode, hitTest: HitTest = () => null): void {
    const hit = mode === "rotate" ? hitTest(x, y) : null;
    this.pointerGrab = hit;
    this.#pointer = { mode: hit ? "grab" : mode, x, y };
  }

  pointerMove(x: number, y: number): void {
    const p = this.#pointer;
    if (!p) return;
    const dx = x - p.x, dy = y - p.y;
    const t = this.transform;
    if (p.mode === "grab" && this.pointerGrab) {
      const o = t.partOffsets[this.pointerGrab] ?? { x: 0, y: 0 };
      t.partOffsets[this.pointerGrab] = { x: o.x + dx * PAN_SENS, y: o.y - dy * PAN_SENS };
    } else if (p.mode === "rotate") {
      t.rotY -= dx * ROT_SENS;
      t.rotX -= dy * ROT_SENS;
    } else if (p.mode === "pan") {
      t.x += dx * PAN_SENS;
      t.y -= dy * PAN_SENS;
    }
    p.x = x;
    p.y = y;
  }

  pointerUp(): void {
    this.#pointer = null;
    this.pointerGrab = null;
  }

  /** Rê chuột (không kéo): linh kiện dưới chuột; đang kéo thì giữ nguyên. */
  pointerHover(x: number, y: number, hitTest: HitTest = () => null): void {
    if (!this.#pointer) this.pointerHovered = hitTest(x, y);
  }

  clearHover(): void {
    this.pointerHovered = null;
  }

  wheel(deltaY: number): void {
    const t = this.transform;
    t.zoom = clamp(t.zoom * Math.exp(-deltaY * WHEEL_SENS), ZOOM_MIN, ZOOM_MAX);
  }

  /** Thanh trượt độ bung; xoá mốc của 2 tay để nếu tay đang xoè thì lấy giá trị này làm mốc mới. */
  setExplode(v: number): void {
    this.transform.explode = clamp(v, 0, EXPLODE_MAX);
    this.#explodeStart = null;
  }

  step(hands: Hand[], dt: number, hitTest: HitTest = () => null): Gesture[] {
    dt = Math.min(dt, MAX_DT);
    const gestures = hands.map((h) => classify(h.landmarks));
    // con trỏ theo tay đang làm cử chỉ kéo (vd. tay phải chụm khi tay trái đang xoè); không có thì tay đầu tiên
    const dragIdx = gestures.findIndex((g) => DRAG_GESTURES.includes(g));
    const tip0 = hands[dragIdx >= 0 ? dragIdx : 0]?.landmarks[8];
    this.cursor = tip0 ? { x: tip0.x, y: tip0.y } : null;
    this.hovered = this.cursor ? hitTest(this.cursor.x, this.cursor.y) : null;
    const pinches = hands.filter((_, i) => gestures[i] === "PINCH");
    const opens = hands.filter((_, i) => gestures[i] === "OPEN");
    const t = this.transform;

    if (gestures.includes("FIST")) {
      this.reset();
      return gestures;
    }
    if (pinches.length === 2) {
      this.#drag = null;
      this.grabbed = null;
      this.#explodeStart = null;
      const d = dist(pinches[0].landmarks[8], pinches[1].landmarks[8]);
      this.#zoomStart ??= { d0: Math.max(d, 1e-6), z0: t.zoom };
      t.zoom = clamp((this.#zoomStart.z0 * d) / this.#zoomStart.d0, ZOOM_MIN, ZOOM_MAX);
      return gestures;
    }
    this.#zoomStart = null;
    if (opens.length === 2) {
      this.#drag = null;
      this.grabbed = null;
      const d = dist(opens[0].landmarks[9], opens[1].landmarks[9]);
      this.#explodeStart ??= { d0: d, e0: t.explode };
      t.explode = clamp(this.#explodeStart.e0 + (d - this.#explodeStart.d0) * EXPLODE_SENS, 0, EXPLODE_MAX);
      return gestures;
    }
    this.#explodeStart = null;
    if (gestures.includes("THUMBS_UP")) t.rotY += SPIN_SPEED * dt;

    const i = gestures.findIndex((g) => DRAG_GESTURES.includes(g));
    if (i < 0) {
      this.#drag = null; // thả tay: "nhả ly hợp", model đứng yên
      this.grabbed = null;
      return gestures;
    }
    const g = gestures[i];
    const tip = hands[i].landmarks[8];
    let prev = this.#drag;
    if (!prev || prev.gesture !== g) {
      // vừa đổi cử chỉ: xoá lịch sử lọc để không bị giật; chụm bắt đầu trên linh kiện = cầm nó
      this.#smoothX.reset();
      this.#smoothY.reset();
      prev = null;
      this.grabbed = g === "PINCH" ? this.hovered : null;
    }
    const x = this.#smoothX.next(tip.x);
    const y = this.#smoothY.next(tip.y);
    if (prev) {
      const dx = x - prev.x, dy = y - prev.y;
      if (g === "PINCH" && this.grabbed) {
        const o = t.partOffsets[this.grabbed] ?? { x: 0, y: 0 };
        t.partOffsets[this.grabbed] = { x: o.x + dx * PAN_SENS, y: o.y - dy * PAN_SENS };
      } else if (g === "PINCH") {
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
