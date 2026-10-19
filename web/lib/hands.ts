import type { Hand } from "./controller.ts";

/** Các cặp điểm nối thành khung xương bàn tay (giống tracker.py). */
export const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15],
  [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

/** Phần cần dùng của HandLandmarkerResult (giữ lib thuần, không import mediapipe). */
export type DetectResult = {
  landmarks: { x: number; y: number; z: number }[][];
  handedness: { categoryName: string }[][];
};

/**
 * Bản Python lật frame trước khi nhận diện; ở web ta nhận diện trên video gốc
 * rồi lật x và đổi nhãn (MediaPipe giả định ảnh đầu vào đã lật gương) → kết quả tương đương.
 */
export function toHands(r: DetectResult): Hand[] {
  return r.landmarks.map((lm, i) => ({
    landmarks: lm.map((p) => ({ x: 1 - p.x, y: p.y, z: p.z })),
    side: r.handedness[i]?.[0]?.categoryName === "Left" ? "Right" : "Left",
  }));
}

/** Chế độ VIDEO yêu cầu timestamp (ms) tăng nghiêm ngặt. */
export const nextTimestamp = (last: number, now: number) => Math.max(last + 1, Math.floor(now));
