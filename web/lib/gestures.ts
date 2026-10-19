/** Nhận diện cử chỉ từ 21 landmark của MediaPipe bằng luật hình học — port 1:1 từ gestures.py. */
export type Landmark = { x: number; y: number; z?: number };
export type Gesture = "PINCH" | "POINT" | "PEACE" | "THUMBS_UP" | "FIST" | "OPEN";

export const WRIST = 0, THUMB_TIP = 4, INDEX_MCP = 5, INDEX_TIP = 8, MIDDLE_MCP = 9;
// (đầu ngón, khớp giữa PIP) của ngón trỏ, giữa, áp út, út
export const FINGERS: [number, number][] = [[8, 6], [12, 10], [16, 14], [20, 18]];

export const PINCH_THRESHOLD = 0.3; // chỉnh theo tay và camera của bạn
export const THUMB_UP_THRESHOLD = 0.5; // chỉnh theo tay và camera

export const dist = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y);

/** Cổ tay → gốc ngón giữa; dùng để chuẩn hoá, không phụ thuộc tay xa/gần camera. */
export const handSize = (lm: Landmark[]) => dist(lm[WRIST], lm[MIDDLE_MCP]) || 1e-6;

export const isPinch = (lm: Landmark[]) => dist(lm[THUMB_TIP], lm[INDEX_TIP]) / handSize(lm) < PINCH_THRESHOLD;

/** Ngón nào đang duỗi: [trỏ, giữa, áp út, út]. Ảnh có y tăng dần xuống dưới. */
export const fingersUp = (lm: Landmark[]) => FINGERS.map(([tip, pip]) => lm[tip].y < lm[pip].y);

/** Đầu ngón cái cao hơn gốc ngón trỏ bao nhiêu (chuẩn hoá theo cỡ tay). */
export const thumbLift = (lm: Landmark[]) => (lm[INDEX_MCP].y - lm[THUMB_TIP].y) / handSize(lm);

export function classify(lm: Landmark[]): Gesture {
  if (isPinch(lm)) return "PINCH";
  const [index, middle, ring, pinky] = fingersUp(lm);
  if (index && !middle && !ring && !pinky) return "POINT";
  if (index && middle && !ring && !pinky) return "PEACE";
  if (!index && !middle && !ring && !pinky) return thumbLift(lm) > THUMB_UP_THRESHOLD ? "THUMBS_UP" : "FIST";
  return "OPEN";
}

/** Lọc rung bằng trung bình mũ (EMA). alpha nhỏ = mượt hơn nhưng trễ hơn. */
export class Smooth {
  alpha: number;
  value: number | null = null;
  constructor(alpha = 0.3) {
    this.alpha = alpha;
  }
  next(x: number): number {
    this.value = this.value === null ? x : this.alpha * x + (1 - this.alpha) * this.value;
    return this.value;
  }
  reset(): void {
    this.value = null;
  }
}
