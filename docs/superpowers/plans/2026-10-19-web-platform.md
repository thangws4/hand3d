# Nền tảng web hand3d — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa app "điều khiển mô hình 3D bằng cử chỉ tay" lên trình duyệt bằng Next.js: trang giới thiệu `/` và trang chơi `/play`, deploy Vercel.

**Architecture:** Next.js App Router trong `web/`. Logic thuần (cử chỉ, controller, helper) nằm trong `web/lib/*.ts`, test bằng `node --test` (Node 22 chạy TS trực tiếp). Phần trình duyệt: hook `useHandTracker` (camera + MediaPipe Tasks Vision) → `Controller` → React Three Fiber `Scene`. Bản Python ở gốc repo giữ nguyên.

**Tech Stack:** Next.js 16.4.2, React 19, TypeScript, Tailwind CSS v4, three 0.186, @react-three/fiber 9, @react-three/drei 10, @mediapipe/tasks-vision 1.1.1, Node 22 test runner.

**Spec:** `docs/superpowers/specs/2026-10-19-web-platform-design.md`

## Global Constraints

- Mọi file trong `web/lib/*.ts` mà test import phải chạy được bằng Node 22 type stripping: **không** `enum`, `namespace`, parameter properties (`constructor(private x)`), decorator; import kiểu bằng `import type` / `import { type X }`; import tương đối giữa các file lib ghi rõ đuôi `.ts` (vd. `"./gestures.ts"`).
- Lệnh test: `npm test` trong `web/` = `node --test "lib/**/*.test.ts"` (Node 22 **không** nhận dạng `node --test lib`).
- Hằng số giữ nguyên bản Python: `PINCH_THRESHOLD=0.3`, `THUMB_UP_THRESHOLD=0.5`, `ROT_SENS=300`, `PAN_SENS=20`, `ZOOM_SENS=3`, `SPIN_SPEED=90`, `ZOOM_MIN/MAX=0.2/5`, `FIT_SIZE=4`, `Smooth alpha=0.3`.
- Camera three.js đặt như Ursina: `position [0,0,20]`, `fov 40`.
- WASM MediaPipe: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm` (khớp phiên bản npm). Model: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task`.
- Không xin quyền camera trước khi người dùng bấm "Bật camera".
- Toàn bộ chữ hiển thị bằng tiếng Việt có dấu.
- Không sửa file Python ở gốc repo.

## Review Focus

- Tab bị ẩn rồi mở lại → `dt` của khung đầu rất lớn → 👍 làm model quay vọt: controller kẹp `dt ≤ 0.1` (test ở Task 3).
- Tay ra khỏi khung khi đang kéo rồi quay lại chỗ khác → model không được nhảy (test ở Task 3).
- Camera đã nhớ trong localStorage bị rút ra → `OverconstrainedError`/`NotFoundError` → tự thử lại camera mặc định thay vì kẹt lỗi (test `shouldRetryDefault` ở Task 4).
- Thả file không phải glb/gltf hoặc glb hỏng → báo lỗi, giữ khối lập phương, trang không trắng (test `isModelFile` ở Task 4; boundary kiểm thủ công ở Task 7).
- `detectForVideo` nhận timestamp không tăng (hai khung trong cùng 1ms, đồng hồ lùi) → MediaPipe ném lỗi: `nextTimestamp` luôn tăng nghiêm ngặt (test ở Task 4). Model kích thước 0 → `fitScale` không chia cho 0 (test ở Task 4).

---

### Task 1: Khởi tạo project Next.js trong `web/`

**Files:**
- Create: `web/` (create-next-app)
- Modify: `web/tsconfig.json`, `web/package.json`

**Interfaces:**
- Produces: project build được; alias `@/*` → `web/*`; script `npm test`.

- [ ] **Step 1: Tạo project**

Chạy từ gốc repo:
```bash
npx -y create-next-app@16.4.2 web --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --disable-git --no-agent-feedback --yes
```
Expected: thư mục `web/` có `app/`, `package.json`, `tsconfig.json`, `.gitignore` (đã bỏ qua `node_modules`, `.next`).

- [ ] **Step 2: Cài thư viện**

```bash
cd web && npm install three@0.186.1 @react-three/fiber@9.8.2 @react-three/drei@10.7.9 @mediapipe/tasks-vision@1.1.1 && npm install -D @types/three@0.186.0
```

- [ ] **Step 3: Cho phép import có đuôi `.ts`**

Trong `web/tsconfig.json`, thêm vào `compilerOptions`:
```json
"allowImportingTsExtensions": true
```
(`noEmit: true` đã có sẵn, là điều kiện bắt buộc của tuỳ chọn này.)

- [ ] **Step 4: Thêm script test**

Trong `web/package.json`, mục `scripts` thêm:
```json
"test": "node --test \"lib/**/*.test.ts\""
```

- [ ] **Step 5: Kiểm tra build và lint**

```bash
cd web && npm run build && npm run lint
```
Expected: build thành công, lint không lỗi.

- [ ] **Step 6: Commit**

```bash
git add web
git commit -m "Khởi tạo project Next.js cho bản web"
```

---

### Task 2: Port `gestures.py` → `lib/gestures.ts`

**Files:**
- Create: `web/lib/gestures.ts`, `web/lib/testing.ts`, `web/lib/gestures.test.ts`

**Interfaces:**
- Produces (`gestures.ts`):
  - `type Landmark = { x: number; y: number; z?: number }`
  - `type Gesture = "PINCH" | "POINT" | "PEACE" | "THUMBS_UP" | "FIST" | "OPEN"`
  - `dist(a: Landmark, b: Landmark): number`, `handSize(lm: Landmark[]): number`, `isPinch(lm): boolean`, `fingersUp(lm): boolean[]`, `thumbLift(lm): number`, `classify(lm: Landmark[]): Gesture`
  - `class Smooth { constructor(alpha = 0.3); value: number | null; next(x: number): number; reset(): void }`
  - hằng số `WRIST, THUMB_TIP, INDEX_MCP, INDEX_TIP, MIDDLE_MCP, FINGERS, PINCH_THRESHOLD, THUMB_UP_THRESHOLD`
- Produces (`testing.ts`, chỉ dùng trong test): `makeHand(tipsY: number[], thumb?: [number, number], index?: [number, number]): Landmark[]`, `pinch(x, y)`, `point(x, y)`, `peace(x, y)`, `fist()`, `thumbsUp()`

- [ ] **Step 1: Viết helper dựng bàn tay giả (port hàm `hand()` trong `gestures.py`)**

`web/lib/testing.ts`:
```ts
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
```

- [ ] **Step 2: Viết test thất bại (cùng các ca với khối `__main__` của `gestures.py`)**

`web/lib/gestures.test.ts`:
```ts
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
```

- [ ] **Step 3: Chạy test, xác nhận thất bại**

Run: `cd web && npm test`
Expected: FAIL — không tìm thấy module `./gestures.ts`.

- [ ] **Step 4: Viết `gestures.ts`**

`web/lib/gestures.ts`:
```ts
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
```

- [ ] **Step 5: Chạy test, xác nhận qua**

Run: `cd web && npm test`
Expected: `# pass 3`, `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add web/lib/gestures.ts web/lib/testing.ts web/lib/gestures.test.ts
git commit -m "Port nhận diện cử chỉ sang TypeScript"
```

---

### Task 3: Port logic `update()` của `main.py` → `lib/controller.ts`

**Files:**
- Create: `web/lib/controller.ts`, `web/lib/controller.test.ts`

**Interfaces:**
- Consumes: `classify`, `dist`, `Smooth`, `Landmark`, `Gesture` từ `./gestures.ts`
- Produces:
  - `type Hand = { landmarks: Landmark[]; side: "Left" | "Right" }`
  - `type Transform = { rotX: number; rotY: number; x: number; y: number; zoom: number }` — góc tính bằng **độ**, quy ước Ursina; `zoom` là hệ số tương đối (1 = vừa khung)
  - `class Controller { transform: Transform; reset(): void; step(hands: Hand[], dt: number): Gesture[] }` — `step` trả về cử chỉ từng tay (cùng thứ tự `hands`)
  - hằng số `ROT_SENS, PAN_SENS, ZOOM_SENS, SPIN_SPEED, ZOOM_MIN, ZOOM_MAX, MAX_DT`

- [ ] **Step 1: Viết test thất bại**

`web/lib/controller.test.ts`:
```ts
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
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `cd web && npm test`
Expected: FAIL — không tìm thấy module `./controller.ts`.

- [ ] **Step 3: Viết `controller.ts`**

`web/lib/controller.ts`:
```ts
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
```

- [ ] **Step 4: Chạy test, xác nhận qua**

Run: `cd web && npm test`
Expected: `# pass 12`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add web/lib/controller.ts web/lib/controller.test.ts
git commit -m "Port bộ điều khiển cử chỉ → biến đổi model"
```

---

### Task 4: Helper thuần cho camera, tay, model và bảng cử chỉ

**Files:**
- Create: `web/lib/hands.ts`, `web/lib/hands.test.ts`, `web/lib/cameraErrors.ts`, `web/lib/cameraErrors.test.ts`, `web/lib/model.ts`, `web/lib/model.test.ts`, `web/lib/gestureGuide.ts`

**Interfaces:**
- Consumes: `Hand` từ `./controller.ts`
- Produces:
  - `hands.ts`: `CONNECTIONS: [number, number][]`; `type DetectResult = { landmarks: { x: number; y: number; z: number }[][]; handedness: { categoryName: string }[][] }`; `toHands(r: DetectResult): Hand[]` (lật gương x, đổi nhãn); `nextTimestamp(last: number, now: number): number`
  - `cameraErrors.ts`: `cameraErrorMessage(err: unknown): string`; `shouldRetryDefault(err: unknown, deviceId: string): boolean`; `INSECURE_CONTEXT_MESSAGE`, `MODEL_LOAD_MESSAGE`
  - `model.ts`: `FIT_SIZE = 4`; `fitScale(size: { x: number; y: number; z: number }): number`; `isModelFile(name: string): boolean`; `type StoredModel = { url: string; name: string }`; `getModel(): StoredModel | null`; `setModel(blob: Blob, name: string): StoredModel`; `clearModel(): void`
  - `gestureGuide.ts`: `GESTURE_GUIDE: { gesture: string; emoji: string; how: string; action: string }[]`

- [ ] **Step 1: Viết test thất bại**

`web/lib/hands.test.ts`:
```ts
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
```

`web/lib/cameraErrors.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { cameraErrorMessage, shouldRetryDefault } from "./cameraErrors.ts";

const err = (name: string) => new DOMException("x", name);

test("mỗi loại lỗi camera có thông điệp riêng", () => {
  assert.match(cameraErrorMessage(err("NotAllowedError")), /quyền camera/);
  assert.match(cameraErrorMessage(err("NotFoundError")), /Không tìm thấy camera/);
  assert.match(cameraErrorMessage(err("NotReadableError")), /đang được ứng dụng khác dùng/);
  assert.match(cameraErrorMessage(new Error("boom")), /boom/);
  assert.match(cameraErrorMessage("lạ"), /lạ/);
});

test("chỉ tự thử camera mặc định khi đang chọn camera cụ thể và camera đó không còn", () => {
  assert.equal(shouldRetryDefault(err("OverconstrainedError"), "abc"), true);
  assert.equal(shouldRetryDefault(err("NotFoundError"), "abc"), true);
  assert.equal(shouldRetryDefault(err("NotFoundError"), ""), false);
  assert.equal(shouldRetryDefault(err("NotAllowedError"), "abc"), false);
});
```

`web/lib/model.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { clearModel, fitScale, getModel, isModelFile, setModel } from "./model.ts";

test("fitScale đưa cạnh dài nhất về FIT_SIZE và không chia cho 0", () => {
  assert.equal(fitScale({ x: 2, y: 8, z: 1 }), 0.5);
  assert.ok(Number.isFinite(fitScale({ x: 0, y: 0, z: 0 })));
});

test("isModelFile chỉ nhận .glb/.gltf, không phân biệt hoa thường", () => {
  assert.equal(isModelFile("robot.GLB"), true);
  assert.equal(isModelFile("scene.gltf"), true);
  assert.equal(isModelFile("robot.obj"), false);
  assert.equal(isModelFile("anh.png"), false);
});

test("setModel lưu model dùng chung giữa các trang, clearModel xoá", () => {
  clearModel();
  assert.equal(getModel(), null);
  const m = setModel(new Blob(["x"]), "a.glb");
  assert.deepEqual(getModel(), m);
  assert.match(m.url, /^blob:/);
  clearModel();
  assert.equal(getModel(), null);
});
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `cd web && npm test`
Expected: FAIL — không tìm thấy `./hands.ts`, `./cameraErrors.ts`, `./model.ts`.

- [ ] **Step 3: Viết `hands.ts`**

```ts
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
```

- [ ] **Step 4: Viết `cameraErrors.ts`**

```ts
export const INSECURE_CONTEXT_MESSAGE =
  "Trình duyệt chỉ cho dùng camera trên https hoặc localhost. Hãy mở trang bằng https.";
export const MODEL_LOAD_MESSAGE =
  "Không tải được mô hình nhận diện tay (MediaPipe). Kiểm tra kết nối mạng rồi thử lại.";

const errName = (err: unknown) =>
  typeof err === "object" && err !== null && "name" in err ? String((err as { name: unknown }).name) : "";

export function cameraErrorMessage(err: unknown): string {
  switch (errName(err)) {
    case "NotAllowedError":
    case "SecurityError":
      return "Bạn đã chặn quyền camera. Bấm biểu tượng camera trên thanh địa chỉ để cho phép, rồi thử lại.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Không tìm thấy camera. Cắm webcam hoặc chọn camera khác rồi thử lại.";
    case "NotReadableError":
    case "AbortError":
      return "Camera đang được ứng dụng khác dùng (Zoom, Meet, OBS…). Đóng ứng dụng đó rồi thử lại.";
    default:
      return `Không mở được camera: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/** Camera đã nhớ không còn (rút ra, đổi máy) → thử lại với camera mặc định. */
export const shouldRetryDefault = (err: unknown, deviceId: string) =>
  deviceId !== "" && ["OverconstrainedError", "NotFoundError"].includes(errName(err));
```

- [ ] **Step 5: Viết `model.ts`**

```ts
export const FIT_SIZE = 4; // kích thước model sau khi tự co giãn cho vừa màn hình

export type StoredModel = { url: string; name: string };

export const fitScale = (size: { x: number; y: number; z: number }) =>
  FIT_SIZE / Math.max(size.x, size.y, size.z, 1e-6);

export const isModelFile = (name: string) => /\.(glb|gltf)$/i.test(name);

// Model hiện tại, dùng chung giữa các trang khi điều hướng phía client (mất khi tải lại trang).
let current: StoredModel | null = null;

export const getModel = () => current;

export function setModel(blob: Blob, name: string): StoredModel {
  clearModel();
  current = { url: URL.createObjectURL(blob), name };
  return current;
}

export function clearModel(): void {
  if (current) URL.revokeObjectURL(current.url);
  current = null;
}
```

- [ ] **Step 6: Viết `gestureGuide.ts` (dữ liệu dùng chung cho trang chủ và màn hình bắt đầu)**

```ts
export const GESTURE_GUIDE = [
  { gesture: "PINCH", emoji: "🤏", how: "Chụm ngón cái + ngón trỏ, di tay", action: "Xoay mô hình" },
  { gesture: "POINT", emoji: "☝️", how: "Chỉ giơ ngón trỏ, di tay", action: "Kéo mô hình đi" },
  { gesture: "PEACE", emoji: "✌️", how: "Chữ V, kéo lên / xuống", action: "Phóng to / thu nhỏ" },
  { gesture: "THUMBS_UP", emoji: "👍", how: "Giơ ngón cái", action: "Tự quay" },
  { gesture: "FIST", emoji: "✊", how: "Nắm tay", action: "Đặt lại" },
  { gesture: "2× PINCH", emoji: "🤏🤏", how: "Chụm cả 2 tay, kéo xa / gần", action: "Phóng to / thu nhỏ" },
];
```

- [ ] **Step 7: Chạy test, xác nhận qua**

Run: `cd web && npm test`
Expected: `# pass 19`, `# fail 0`.

- [ ] **Step 8: Commit**

```bash
git add web/lib
git commit -m "Thêm helper camera, tay, model và bảng cử chỉ"
```

---

### Task 5: Theme, layout chung và trang giới thiệu `/`

Dùng skill `frontend-design` khi thực hiện task này: giữ cấu trúc và nội dung dưới đây, được phép tinh chỉnh chi tiết thị giác (khoảng cách, hiệu ứng) miễn giữ các token màu/font đã định.

**Files:**
- Modify: `web/app/globals.css`, `web/app/layout.tsx`, `web/app/page.tsx`
- Create: `web/components/SiteHeader.tsx`

**Interfaces:**
- Consumes: `GESTURE_GUIDE` từ `@/lib/gestureGuide`
- Produces: header cao `h-14` (3.5rem) cố định trên mọi trang — Task 7 dùng `h-[calc(100dvh-3.5rem)]`; màu Tailwind `bg-bg`, `bg-panel`, `text-ink`, `text-muted`, `text-accent`, `border-line`; font `font-display`, `font-mono`.

- [ ] **Step 1: Thay `web/app/globals.css`**

```css
@import "tailwindcss";

@theme inline {
  --color-bg: #07090c;
  --color-panel: #0e1217;
  --color-line: #1f2a33;
  --color-ink: #e6edf3;
  --color-muted: #8b98a5;
  --color-accent: #3df5c4;
  --color-warn: #ffb547;
  --font-display: var(--font-space-grotesk);
  --font-mono: var(--font-jetbrains-mono);
}

body {
  background: var(--color-bg);
  color: var(--color-ink);
}

/* Lưới mờ kiểu HUD camera */
.hud-grid {
  background-image:
    linear-gradient(to right, rgb(61 245 196 / 0.05) 1px, transparent 1px),
    linear-gradient(to bottom, rgb(61 245 196 / 0.05) 1px, transparent 1px);
  background-size: 48px 48px;
}
```

- [ ] **Step 2: Viết `web/components/SiteHeader.tsx`**

```tsx
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-line px-5">
      <Link href="/" className="font-mono text-sm tracking-widest text-accent">
        HAND3D<span className="animate-pulse">_</span>
      </Link>
      <nav className="flex gap-6 font-mono text-xs uppercase tracking-wider text-muted">
        <Link href="/" className="hover:text-ink">Giới thiệu</Link>
        <Link href="/play" className="hover:text-ink">Chơi</Link>
      </nav>
    </header>
  );
}
```

- [ ] **Step 3: Thay `web/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin", "vietnamese"], variable: "--font-space-grotesk" });
const mono = JetBrains_Mono({ subsets: ["latin", "vietnamese"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: { default: "Hand 3D", template: "%s · Hand 3D" },
  description: "Điều khiển mô hình 3D bằng cử chỉ tay ngay trên trình duyệt.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${display.variable} ${mono.variable}`}>
      <body className="min-h-dvh font-display antialiased">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Thay `web/app/page.tsx`**

```tsx
import Link from "next/link";
import { GESTURE_GUIDE } from "@/lib/gestureGuide";

const PIPELINE = [
  ["01", "Webcam", "Ảnh từ camera của bạn"],
  ["02", "MediaPipe", "21 điểm khớp trên mỗi bàn tay"],
  ["03", "Cử chỉ", "Luật hình học nhận ra 6 cử chỉ"],
  ["04", "3D", "Three.js xoay, kéo, phóng to mô hình"],
];

export default function Home() {
  return (
    <main className="hud-grid">
      <section className="mx-auto max-w-5xl px-5 pb-20 pt-24">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">● Theo dõi tay thời gian thực</p>
        <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">
          Điều khiển mô hình 3D bằng chính bàn tay bạn.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted">
          Không chuột, không cài đặt. Mở camera, chụm ngón tay để xoay, chỉ tay để kéo, giơ chữ V để phóng to.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-5">
          <Link href="/play" className="bg-accent px-7 py-3 font-mono text-sm font-bold uppercase tracking-wider text-bg transition hover:brightness-110">
            Chơi ngay →
          </Link>
          <span className="font-mono text-xs text-muted">Camera được xử lý ngay trên máy bạn, không gửi đi đâu.</span>
        </div>
      </section>

      <section className="border-y border-line bg-panel/60">
        <ol className="mx-auto grid max-w-5xl gap-px px-5 sm:grid-cols-4">
          {PIPELINE.map(([n, title, desc]) => (
            <li key={n} className="py-8 sm:pr-6">
              <span className="font-mono text-xs text-accent">{n}</span>
              <h2 className="mt-2 text-xl font-medium">{title}</h2>
              <p className="mt-1 text-sm text-muted">{desc}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-20">
        <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-muted">Cử chỉ</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GESTURE_GUIDE.map((g) => (
            <li key={g.gesture} className="border border-line bg-panel p-5">
              <div className="flex items-baseline justify-between">
                <span className="text-3xl">{g.emoji}</span>
                <span className="font-mono text-[10px] tracking-widest text-accent">{g.gesture}</span>
              </div>
              <p className="mt-4 font-medium">{g.action}</p>
              <p className="mt-1 text-sm text-muted">{g.how}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Kiểm tra build, lint và nhìn trang**

```bash
cd web && npm run build && npm run lint
```
Expected: không lỗi. Sau đó chạy `npm run dev`, mở `http://localhost:3000` trên Chrome: thấy tiêu đề lớn, dải 4 bước, lưới 6 cử chỉ; chữ tiếng Việt hiển thị đúng font; console không lỗi. Chụp màn hình và xem lại.

- [ ] **Step 6: Commit**

```bash
git add web/app web/components
git commit -m "Theme HUD, header chung và trang giới thiệu"
```

---

### Task 6: Hook `useHandTracker` và `CameraPreview`

**Files:**
- Create: `web/lib/useHandTracker.ts`, `web/components/CameraPreview.tsx`

**Interfaces:**
- Consumes: `toHands`, `nextTimestamp`, `CONNECTIONS` (`@/lib/hands`); `cameraErrorMessage`, `shouldRetryDefault`, `INSECURE_CONTEXT_MESSAGE`, `MODEL_LOAD_MESSAGE` (`@/lib/cameraErrors`); `Hand` (`@/lib/controller`)
- Produces:
  - `type TrackerStatus = "idle" | "loading" | "running" | "error"`
  - `useHandTracker(deviceId: string): { videoRef: RefObject<HTMLVideoElement | null>; handsRef: RefObject<Hand[]>; status: TrackerStatus; error: string | null; devices: MediaDeviceInfo[]; start: () => void }`
  - `<CameraPreview videoRef handsRef visible />`

- [ ] **Step 1: Viết `web/lib/useHandTracker.ts`**

```ts
"use client";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  cameraErrorMessage,
  INSECURE_CONTEXT_MESSAGE,
  MODEL_LOAD_MESSAGE,
  shouldRetryDefault,
} from "@/lib/cameraErrors";
import type { Hand } from "@/lib/controller";
import { nextTimestamp, toHands } from "@/lib/hands";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";

export type TrackerStatus = "idle" | "loading" | "running" | "error";

const openCamera = (deviceId: string) =>
  navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      width: { ideal: 640 },
      height: { ideal: 480 },
    },
  });

async function createLandmarker() {
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  const options = (delegate: "GPU" | "CPU") => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: "VIDEO" as const,
    numHands: 2,
  });
  try {
    return await HandLandmarker.createFromOptions(fileset, options("GPU"));
  } catch {
    return await HandLandmarker.createFromOptions(fileset, options("CPU")); // máy không có WebGL2
  }
}

/** Camera + MediaPipe Hand Landmarker → handsRef cập nhật mỗi khung hình (không re-render React). */
export function useHandTracker(deviceId: string) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const handsRef = useRef<Hand[]>([]);
  const [status, setStatus] = useState<TrackerStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [run, setRun] = useState(0); // 0 = người dùng chưa bấm "Bật camera"

  const start = useCallback(() => {
    setStatus("loading");
    setError(null);
    setRun((r) => r + 1);
  }, []);

  useEffect(() => {
    if (run === 0) return;
    let cancelled = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    let landmarker: HandLandmarker | null = null;

    const cleanup = () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      landmarker?.close();
      stream = null;
      landmarker = null;
      handsRef.current = [];
    };
    const fail = (msg: string) => {
      cleanup();
      if (!cancelled) {
        setError(msg);
        setStatus("error");
      }
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return fail(INSECURE_CONTEXT_MESSAGE);
      try {
        stream = await openCamera(deviceId).catch((e) => {
          if (shouldRetryDefault(e, deviceId)) return openCamera("");
          throw e;
        });
      } catch (e) {
        return fail(cameraErrorMessage(e));
      }
      if (cancelled) return cleanup();

      const all = await navigator.mediaDevices.enumerateDevices();
      if (cancelled) return cleanup();
      setDevices(all.filter((d) => d.kind === "videoinput"));

      const video = videoRef.current;
      if (!video) return fail("Không tìm thấy khung video.");
      video.srcObject = stream;
      await video.play().catch(() => {}); // bị ngắt khi đổi camera: bỏ qua

      try {
        landmarker = await createLandmarker();
      } catch {
        return fail(MODEL_LOAD_MESSAGE);
      }
      if (cancelled) return cleanup();
      setStatus("running");

      let lastTs = 0;
      let lastFrame = -1;
      const loop = () => {
        if (landmarker && video.readyState >= 2 && video.currentTime !== lastFrame) {
          lastFrame = video.currentTime;
          lastTs = nextTimestamp(lastTs, performance.now());
          handsRef.current = toHands(landmarker.detectForVideo(video, lastTs));
        }
        raf = requestAnimationFrame(loop);
      };
      loop();
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [run, deviceId]);

  return { videoRef, handsRef, status, error, devices, start };
}
```

- [ ] **Step 2: Viết `web/components/CameraPreview.tsx`**

```tsx
"use client";
import { useEffect, useRef, type RefObject } from "react";
import type { Hand } from "@/lib/controller";
import { CONNECTIONS } from "@/lib/hands";

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>;
  handsRef: RefObject<Hand[]>;
  visible: boolean;
};

/** Ô camera lật gương + khung xương tay. Landmark đã được lật sẵn nên vẽ thẳng lên canvas không lật. */
export function CameraPreview({ videoRef, handsRef, visible }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        const { width: w, height: h } = canvas;
        ctx.clearRect(0, 0, w, h);
        for (const { landmarks: lm } of handsRef.current) {
          ctx.strokeStyle = "rgba(230, 237, 243, 0.85)";
          ctx.lineWidth = 2;
          for (const [a, b] of CONNECTIONS) {
            ctx.beginPath();
            ctx.moveTo(lm[a].x * w, lm[a].y * h);
            ctx.lineTo(lm[b].x * w, lm[b].y * h);
            ctx.stroke();
          }
          ctx.fillStyle = "#3df5c4";
          for (const p of lm) {
            ctx.beginPath();
            ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [handsRef]);

  // object-fill cho cả video và canvas để toạ độ chuẩn hoá khớp nhau dù camera không đúng 4:3
  return (
    <div className={`relative aspect-[4/3] w-64 overflow-hidden border border-line bg-black ${visible ? "" : "hidden"}`}>
      <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full -scale-x-100 object-fill" />
      <canvas ref={canvasRef} width={320} height={240} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
```

- [ ] **Step 3: Kiểm tra lint và build**

```bash
cd web && npm run lint && npm run build
```
Expected: không lỗi (hai file chưa được trang nào dùng; build xác nhận chúng biên dịch được).

- [ ] **Step 4: Commit**

```bash
git add web/lib/useHandTracker.ts web/components/CameraPreview.tsx
git commit -m "Hook camera + MediaPipe và ô xem camera"
```

---

### Task 7: `Scene`, `Player` và trang `/play`

**Files:**
- Create: `web/components/Scene.tsx`, `web/components/Player.tsx`, `web/app/play/page.tsx`, `web/app/play/layout.tsx`

**Interfaces:**
- Consumes: `Controller`, `Transform` (`@/lib/controller`); `useHandTracker` (`@/lib/useHandTracker`); `CameraPreview`; `fitScale`, `FIT_SIZE`, `isModelFile`, `getModel`, `setModel`, `clearModel`, `StoredModel` (`@/lib/model`); `GESTURE_GUIDE`
- Produces: `<Scene modelUrl onFrame onModelError />` (memo); trang `/play`.

- [ ] **Step 1: Viết `web/components/Scene.tsx`**

```tsx
"use client";
import { Edges, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Component, memo, Suspense, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import type { Transform } from "@/lib/controller";
import { FIT_SIZE, fitScale } from "@/lib/model";

function Cube() {
  return (
    <mesh scale={FIT_SIZE}>
      <boxGeometry />
      <meshStandardMaterial color="#e6edf3" roughness={0.55} />
      <Edges color="#3df5c4" />
    </mesh>
  );
}

/** Model tải về có thể to/nhỏ/lệch tâm bất kỳ → đưa về giữa và co giãn cho vừa. */
function GltfModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const { offset, scale } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    return {
      offset: box.getCenter(new THREE.Vector3()).negate(),
      scale: fitScale(box.getSize(new THREE.Vector3())),
    };
  }, [scene]);
  return (
    <group scale={scale}>
      <primitive object={scene} position={offset} />
    </group>
  );
}

type BoundaryProps = { onError: (e: Error) => void; children: ReactNode };
/** glb hỏng → báo lỗi và hiện khối lập phương thay vì làm trắng trang. */
class ModelBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: Error) {
    this.props.onError(e);
  }
  render() {
    return this.state.failed ? <Cube /> : this.props.children;
  }
}

const deg = THREE.MathUtils.degToRad;

function Rig({ onFrame, children }: { onFrame: (dt: number) => Transform; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const t = onFrame(dt);
    const g = ref.current;
    if (!g) return;
    // Ursina và three ngược chiều quay: đổi dấu để giữ đúng cảm giác như bản Python
    g.rotation.set(-deg(t.rotX), -deg(t.rotY), 0);
    g.position.set(t.x, t.y, 0);
    g.scale.setScalar(t.zoom);
  });
  return <group ref={ref}>{children}</group>;
}

type Props = {
  modelUrl: string | null;
  onFrame: (dt: number) => Transform;
  onModelError: (e: Error) => void;
};

export const Scene = memo(function Scene({ modelUrl, onFrame, onModelError }: Props) {
  return (
    <Canvas camera={{ position: [0, 0, 20], fov: 40 }} dpr={[1, 2]}>
      <color attach="background" args={["#07090c"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 10]} intensity={1.6} />
      <directionalLight position={[-6, -4, -8]} intensity={0.4} color="#3df5c4" />
      <Rig onFrame={onFrame}>
        <ModelBoundary key={modelUrl ?? "cube"} onError={onModelError}>
          <Suspense fallback={<Cube />}>{modelUrl ? <GltfModel url={modelUrl} /> : <Cube />}</Suspense>
        </ModelBoundary>
      </Rig>
    </Canvas>
  );
});
```

- [ ] **Step 2: Viết `web/components/Player.tsx`**

```tsx
"use client";
import { useCallback, useRef, useState, type DragEvent } from "react";
import { CameraPreview } from "@/components/CameraPreview";
import { Scene } from "@/components/Scene";
import { Controller } from "@/lib/controller";
import { GESTURE_GUIDE } from "@/lib/gestureGuide";
import { clearModel, getModel, isModelFile, setModel, type StoredModel } from "@/lib/model";
import { useHandTracker } from "@/lib/useHandTracker";

const DEVICE_KEY = "hand3d.camera";
const readDevice = () => {
  try {
    return localStorage.getItem(DEVICE_KEY) ?? "";
  } catch {
    return "";
  }
};
const saveDevice = (id: string) => {
  try {
    localStorage.setItem(DEVICE_KEY, id);
  } catch {}
};

export default function Player() {
  const [deviceId, setDeviceId] = useState(readDevice);
  const { videoRef, handsRef, status, error, devices, start } = useHandTracker(deviceId);
  const [controller] = useState(() => new Controller());
  const [model, setModelState] = useState<StoredModel | null>(getModel);
  const [hud, setHud] = useState("Không thấy tay");
  const [toast, setToast] = useState<string | null>(null);
  const hudRef = useRef(hud);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const onFrame = useCallback(
    (dt: number) => {
      const hands = handsRef.current;
      const gestures = controller.step(hands, dt);
      const text = hands.map((h, i) => `${h.side}: ${gestures[i]}`).join(" | ") || "Không thấy tay";
      if (text !== hudRef.current) {
        hudRef.current = text;
        setHud(text);
      }
      return controller.transform;
    },
    [controller, handsRef],
  );

  const onModelError = useCallback(
    (e: Error) => {
      clearModel();
      setModelState(null);
      showToast(`Không đọc được model: ${e.message}`);
    },
    [showToast],
  );

  const openFile = (file: File | undefined) => {
    if (!file) return;
    if (!isModelFile(file.name)) return showToast("Chỉ hỗ trợ file .glb hoặc .gltf (texture nhúng sẵn).");
    setModelState(setModel(file, file.name));
    controller.reset();
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    openFile(e.dataTransfer.files[0]);
  };

  const running = status === "running";

  return (
    <div
      className="relative h-[calc(100dvh-3.5rem)] overflow-hidden"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <Scene modelUrl={model?.url ?? null} onFrame={onFrame} onModelError={onModelError} />

      {/* HUD trên trái */}
      <div className="pointer-events-none absolute left-4 top-4 font-mono text-sm">
        {running && <p className="text-accent">{hud}</p>}
        <p className="mt-1 text-xs text-muted">Model: {model?.name ?? "khối lập phương"}</p>
      </div>

      {/* Điều khiển trên phải */}
      <div className="absolute right-4 top-4 flex gap-2 font-mono text-xs">
        {devices.length > 1 && (
          <select
            aria-label="Chọn camera"
            value={deviceId}
            onChange={(e) => {
              setDeviceId(e.target.value);
              saveDevice(e.target.value);
            }}
            className="border border-line bg-panel px-2 py-1.5 text-ink"
          >
            <option value="">Camera mặc định</option>
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={() => fileRef.current?.click()}
          className="border border-line bg-panel px-3 py-1.5 text-ink hover:border-accent"
        >
          Mở model
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".glb,.gltf"
          hidden
          onChange={(e) => {
            openFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {/* Ô camera dưới trái — luôn mount để hook gắn được stream vào <video> */}
      <div className="absolute bottom-4 left-4">
        <CameraPreview videoRef={videoRef} handsRef={handsRef} visible={running} />
      </div>

      {/* Màn hình bắt đầu / đang tải / lỗi */}
      {!running && (
        <div className="absolute inset-0 grid place-items-center bg-bg/80 p-5 backdrop-blur-sm">
          <div className="w-full max-w-lg border border-line bg-panel p-7">
            <h1 className="text-2xl font-semibold">Điều khiển bằng tay</h1>
            <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {GESTURE_GUIDE.map((g) => (
                <li key={g.gesture} className="flex gap-2">
                  <span>{g.emoji}</span>
                  <span className="text-muted">{g.action}</span>
                </li>
              ))}
            </ul>
            {error && <p role="alert" className="mt-5 text-sm text-warn">{error}</p>}
            <button
              onClick={start}
              disabled={status === "loading"}
              className="mt-6 w-full bg-accent py-3 font-mono text-sm font-bold uppercase tracking-wider text-bg disabled:opacity-60"
            >
              {status === "loading" ? "Đang khởi động…" : status === "error" ? "Thử lại" : "Bật camera"}
            </button>
            <p className="mt-3 font-mono text-[11px] text-muted">
              Kéo thả file .glb vào trang để thay model. Camera được xử lý ngay trên máy bạn.
            </p>
          </div>
        </div>
      )}

      {toast && (
        <p role="status" className="absolute bottom-4 right-4 border border-warn bg-panel px-4 py-2 font-mono text-xs text-warn">
          {toast}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Viết trang `/play`**

`web/app/play/layout.tsx` (giữ metadata ở server component vì `page.tsx` là client):
```tsx
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Chơi" };

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

`web/app/play/page.tsx`:
```tsx
"use client";
import dynamic from "next/dynamic";

// Camera, MediaPipe và WebGL chỉ chạy trên trình duyệt
const Player = dynamic(() => import("@/components/Player"), {
  ssr: false,
  loading: () => <p className="p-6 font-mono text-sm text-muted">Đang tải…</p>,
});

export default function PlayPage() {
  return <Player />;
}
```

- [ ] **Step 4: Kiểm tra lint, build, test**

```bash
cd web && npm run lint && npm run build && npm test
```
Expected: không lỗi; `# fail 0`.

- [ ] **Step 5: Kiểm tra thủ công trên Chrome**

Chạy `npm run dev`, mở `http://localhost:3000/play`:
1. Thấy khối lập phương + thẻ "Điều khiển bằng tay"; chưa có hộp thoại xin quyền camera.
2. Bấm "Bật camera" → trình duyệt xin quyền → cho phép → thẻ biến mất, ô camera hiện ở góc dưới trái, HUD hiện "Không thấy tay" hoặc tên cử chỉ.
3. Console không có lỗi đỏ.
4. Thả một file `.txt` vào trang → toast "Chỉ hỗ trợ file .glb hoặc .gltf…".
5. Đổi tên một file `.txt` thành `hong.glb` rồi thả vào → toast "Không đọc được model…", vẫn thấy khối lập phương.
Chụp màn hình bước 2 và xem lại. Cử chỉ thật (xoay/kéo/zoom/👍/nắm tay) giao người dùng thử; nếu chiều xoay/kéo bị ngược, đổi dấu trong `Rig` (Scene.tsx), không sửa controller.

- [ ] **Step 6: Commit**

```bash
git add web/components/Scene.tsx web/components/Player.tsx web/app/play
git commit -m "Trang /play: cảnh 3D điều khiển bằng cử chỉ tay"
```

---

### Task 8: Hook kiểm thử, README, CLAUDE.md

**Files:**
- Modify: `.claude/settings.json`, `README.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: script `npm test` trong `web/`

- [ ] **Step 1: Mở rộng hook PostToolUse chạy cả test web**

Trong `.claude/settings.json`, thay `command` của hook PostToolUse bằng:
```json
"command": "cd \"$CLAUDE_PROJECT_DIR\" && .venv/Scripts/python.exe gestures.py >/dev/null && cd web && node --test --test-reporter=dot \"lib/**/*.test.ts\" 1>&2 || exit 2"
```

- [ ] **Step 2: Kiểm tra hook bằng cách chạy lệnh trực tiếp**

```bash
export CLAUDE_PROJECT_DIR="$PWD"; bash -c "$(.venv/Scripts/python.exe -c "import json;print(json.load(open('.claude/settings.json'))['hooks']['PostToolUse'][0]['hooks'][0]['command'])")"; echo "exit=$?"
```
Expected: `exit=0`. Sau đó tạm sửa `THUMB_UP_THRESHOLD` trong `web/lib/gestures.ts` thành `5`, chạy lại → `exit=2` và thấy test THUMBS_UP thất bại; hoàn tác thay đổi.

- [ ] **Step 3: README — thêm mục "Bản web" ngay trên mục "Cấu trúc"**

~~~markdown
## Bản web

Chạy trên trình duyệt, không cần Python: Next.js + MediaPipe Tasks Vision + Three.js, mã nguồn trong `web/`.

- Online: (link Vercel — cập nhật sau Task 9)
- Chạy local (cần Node 22+):

```bash
cd web
npm install
npm run dev        # mở http://localhost:3000
npm test           # kiểm tra logic cử chỉ
```

Kéo thả file `.glb` vào trang `/play` để dùng model của bạn.
~~~

- [ ] **Step 4: CLAUDE.md — thêm các dòng**

```markdown
- Bản web ở `web/` (Next.js 16): `npm run dev`, `npm test` (= `node --test "lib/**/*.test.ts"`, Node 22 chạy TS trực tiếp), `npm run build`.
- `web/lib/*.ts` phải chạy được bằng Node type stripping: không enum/namespace/parameter properties; import tương đối ghi đuôi `.ts`.
- Logic cử chỉ có 2 bản phải giữ đồng bộ: `gestures.py` ↔ `web/lib/gestures.ts`, `main.py update()` ↔ `web/lib/controller.ts`.
```

- [ ] **Step 5: Commit**

```bash
git add .claude/settings.json README.md CLAUDE.md
git commit -m "Hook chạy test web, tài liệu bản web"
```

---

### Task 9: Deploy Vercel

**Files:**
- Modify: `README.md` (link online)

- [ ] **Step 1: Push lên GitHub**

```bash
git push
```

- [ ] **Step 2: Người dùng tạo project Vercel (cần đăng nhập, Claude không tự làm)**

Hướng dẫn người dùng:
1. Vào https://vercel.com/new, đăng nhập bằng GitHub.
2. Cho phép Vercel truy cập repo private `thangws4/hand3d` (Install GitHub App → chọn repo).
3. Import repo → **Root Directory: `web`** → Framework: Next.js (tự nhận) → Deploy.
4. Gửi lại link `*.vercel.app` cho Claude.

- [ ] **Step 3: Kiểm tra bản online**

Mở link trên Chrome: trang `/` hiển thị đúng; `/play` → "Bật camera" hoạt động trên https; console không lỗi đỏ (đặc biệt không lỗi tải WASM từ jsdelivr hay model từ storage.googleapis.com).

- [ ] **Step 4: Cập nhật link trong README và commit**

Thay dòng `- Online: (link Vercel — cập nhật sau Task 9)` bằng `- Online: <link Vercel>`.
```bash
git add README.md
git commit -m "Thêm link bản web online"
git push
```
Expected: Vercel tự deploy lại sau push (kiểm tra tab Deployments).
