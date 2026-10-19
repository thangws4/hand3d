import { FINGERS, INDEX_TIP, MIDDLE_MCP, THUMB_TIP, WRIST, type Landmark } from "./gestures.ts";

/** Bàn tay giả: cổ tay (0.5, 0.9), gốc ngón giữa (0.5, 0.6) → handSize = 0.3. */
export function makeHand(
  tipsY: number[],
  thumb: [number, number] = [0.5, 0.5],
  index: [number, number] = [0.5, 0.2],
): Landmark[] {
  const lm: Landmark[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
  lm[WRIST] = { x: 0.5, y: 0.9 };
  lm[MIDDLE_MCP] = { x: 0.5, y: 0.6 };
  FINGERS.forEach(([tip, pip], i) => {
    lm[pip] = { x: 0.5, y: 0.5 };
    lm[tip] = { x: 0.5, y: tipsY[i] };
  });
  lm[THUMB_TIP] = { x: thumb[0], y: thumb[1] };
  lm[INDEX_TIP] = { x: index[0], y: index[1] };
  return lm;
}

export const pinch = (x: number, y: number) => makeHand([0.2, 0.2, 0.2, 0.2], [x, y + 0.02], [x, y]);
export const point = (x: number, y: number) => makeHand([0.2, 0.7, 0.7, 0.7], [0.2, 0.5], [x, y]);
export const peace = (x: number, y: number) => makeHand([0.2, 0.2, 0.7, 0.7], [0.2, 0.5], [x, y]);
export const fist = () => makeHand([0.7, 0.7, 0.7, 0.7], [0.2, 0.5], [0.5, 0.7]);
export const thumbsUp = () => makeHand([0.7, 0.7, 0.7, 0.7], [0.5, 0.1], [0.5, 0.7]);
