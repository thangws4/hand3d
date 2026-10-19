# Tự tách mảnh rời — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Model .glb có nhiều mảnh rời bị gộp trong ≤ 4 mesh (vd. Zeta Gundam từ Sketchfab) tự được tách thành tối đa 80 linh kiện mỗi mesh để bung/cầm trong `/play`.

**Architecture:** `lib/looseParts.ts` (thuần) nhóm tam giác theo mảnh rời và gộp mảnh nhỏ vào mảnh lớn gần nhất. `lib/splitMesh.ts` (three, không React) tạo mesh mới cho từng nhóm. `Scene` gọi `autoSplit` trước khi thu thập linh kiện: ẩn mesh gốc, thêm mesh mới; cleanup làm ngược lại. `makeParts` bỏ qua mesh bị ẩn.

**Tech Stack:** three 0.186, Next.js 16, Node 22 test runner.

**Spec:** `docs/superpowers/specs/2026-10-20-auto-split-design.md`

## Global Constraints

- `web/lib/*.ts`: Node type stripping (không enum/namespace/parameter properties; import tương đối ghi đuôi `.ts`); `npm test` = `node --test "lib/**/*.test.ts"`.
- Hằng số: `MAX_AUTO_PARTS = 80` (trên mỗi mesh), `AUTO_SPLIT_MAX_MESHES = 4`; lượng tử hoá đỉnh theo `1e-5 ×` độ lớn toạ độ lớn nhất.
- Gộp mảnh nhỏ vào mảnh được giữ có khoảng cách **từ tâm bbox mảnh nhỏ tới bbox mảnh lớn** nhỏ nhất. Nhóm 0 = mảnh lớn nhất (đường chéo bbox).
- Chép attribute qua `getComponent` (hỗ trợ `InterleavedBufferAttribute` mà GLTFLoader có thể tạo).
- Mesh không có index, hoặc dùng mảng material / nhiều `geometry.groups` → không tách (trả `[]`).
- Tên linh kiện tách tự động: "Mảnh 1…N" liên tục qua các mesh.
- File model thật (Zeta) không bao giờ được commit (đã có `*.glb` trong `.gitignore`); chỉ dùng kiểm tra thủ công.

## Review Focus

- Đổi model rồi quay lại đúng model cũ (scene cache): không nhân đôi mesh tách, mesh gốc hiện lại khi gỡ (cleanup `autoSplit`) — kiểm tra thủ công ở Task 3 bằng cách thả glTF tự dựng → thả file khác → thả lại.
- Đường nối UV (đỉnh trùng vị trí, khác chỉ số) không được làm một tấm giáp vỡ đôi (test ở Task 1).
- glb dùng attribute xen kẽ (interleaved) → vẫn tách và chép đúng (test ở Task 2).
- Model đã chia sẵn > 4 mesh (robot mẫu 9 mesh) → không bị cắt vụn: e2e `data-parts` vẫn 9 (Task 3).
- Model một mảnh liền → vẫn "liền một khối" (e2e Task 3).

---

### Task 1: `lib/looseParts.ts` — nhóm tam giác theo mảnh rời

**Files:**
- Create: `web/lib/looseParts.ts`, `web/lib/looseParts.test.ts`

**Interfaces:**
- Produces: `MAX_AUTO_PARTS = 80`; `type Grouping = { groupOfTriangle: Int32Array; groupCount: number }`; `groupTriangles(positions: ArrayLike<number>, index: ArrayLike<number>, maxParts?: number): Grouping` — `positions` phẳng (x,y,z liên tiếp), `index` 3 số mỗi tam giác.

- [ ] **Step 1: Viết test thất bại**

`web/lib/looseParts.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupTriangles } from "./looseParts.ts";

/** Tam giác vuông cạnh `s` đặt ở x0. Trả về 3 đỉnh (9 số). */
const tri = (x0: number, s: number) => [x0, 0, 0, x0 + s, 0, 0, x0, s, 0];
/** Ghép nhiều tam giác rời (mỗi tam giác 3 đỉnh riêng). */
function soup(tris: number[][]) {
  const positions = new Float32Array(tris.flat());
  const index = Uint32Array.from({ length: tris.length * 3 }, (_, i) => i);
  return { positions, index };
}

test("hai tam giác rời nhau → 2 nhóm", () => {
  const { positions, index } = soup([tri(0, 1), tri(5, 1)]);
  const g = groupTriangles(positions, index);
  assert.equal(g.groupCount, 2);
  assert.notEqual(g.groupOfTriangle[0], g.groupOfTriangle[1]);
});

test("hai tam giác chung cạnh nhưng đỉnh nhân đôi (đường nối UV) → 1 nhóm", () => {
  // tam giác 2 dùng lại 2 đỉnh của tam giác 1 qua bản sao cùng vị trí, khác chỉ số
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, /* bản sao */ 1, 0, 0, 0, 1, 0, 1, 1, 0]);
  const g = groupTriangles(positions, Uint32Array.from([0, 1, 2, 3, 4, 5]));
  assert.equal(g.groupCount, 1);
});

test("mảnh nhỏ nằm sát mảnh lớn A được gộp vào A, không vào B ở xa", () => {
  const { positions, index } = soup([tri(0, 10), tri(100, 10), tri(10.5, 0.1)]);
  const g = groupTriangles(positions, index, 2);
  assert.equal(g.groupCount, 2);
  assert.equal(g.groupOfTriangle[2], g.groupOfTriangle[0]);
});

test("nhiều mảnh hơn giới hạn → đúng maxParts nhóm, giữ mảnh lớn nhất, nhóm 0 là lớn nhất", () => {
  const { positions, index } = soup([tri(0, 3), tri(20, 5), tri(40, 1), tri(60, 4), tri(80, 2)]);
  const g = groupTriangles(positions, index, 3);
  assert.equal(g.groupCount, 3);
  assert.equal(g.groupOfTriangle[1], 0); // cạnh 5
  assert.equal(g.groupOfTriangle[3], 1); // cạnh 4
  assert.equal(g.groupOfTriangle[0], 2); // cạnh 3
  assert.ok([0, 1, 2].includes(g.groupOfTriangle[2])); // mảnh nhỏ đã gộp
  assert.ok([0, 1, 2].includes(g.groupOfTriangle[4]));
});
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `cd web && npm test`
Expected: FAIL — không tìm thấy `./looseParts.ts`.

- [ ] **Step 3: Viết `web/lib/looseParts.ts`**

```ts
/** Nhóm tam giác theo mảnh rời; giữ tối đa maxParts mảnh lớn nhất, mảnh còn lại gộp vào mảnh lớn gần nhất. Thuần, không three. */
export const MAX_AUTO_PARTS = 80;
export type Grouping = { groupOfTriangle: Int32Array; groupCount: number };

export function groupTriangles(positions: ArrayLike<number>, index: ArrayLike<number>, maxParts = MAX_AUTO_PARTS): Grouping {
  const vCount = positions.length / 3;
  const triCount = Math.floor(index.length / 3);

  // 1. Gộp đỉnh trùng vị trí (đường nối UV) bằng khoá lượng tử hoá
  let scale = 0;
  for (let i = 0; i < positions.length; i++) scale = Math.max(scale, Math.abs(positions[i]));
  const q = (scale || 1) * 1e-5;
  const uid = new Int32Array(vCount);
  const seen = new Map<string, number>();
  for (let v = 0; v < vCount; v++) {
    const key = `${Math.round(positions[3 * v] / q)},${Math.round(positions[3 * v + 1] / q)},${Math.round(positions[3 * v + 2] / q)}`;
    let id = seen.get(key);
    if (id === undefined) seen.set(key, (id = seen.size));
    uid[v] = id;
  }

  // 2. Union-find theo cạnh tam giác
  const parent = Int32Array.from({ length: seen.size }, (_, i) => i);
  const find = (x: number) => {
    while (parent[x] !== x) x = parent[x] = parent[parent[x]];
    return x;
  };
  const union = (a: number, b: number) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  for (let t = 0; t < triCount; t++) {
    const a = uid[index[3 * t]];
    union(a, uid[index[3 * t + 1]]);
    union(a, uid[index[3 * t + 2]]);
  }

  // 3. Mảnh của từng tam giác + hộp bao từng mảnh
  const compOfRoot = new Map<number, number>();
  const compOfTri = new Int32Array(triCount);
  const boxes: number[][] = []; // [minX, minY, minZ, maxX, maxY, maxZ]
  for (let t = 0; t < triCount; t++) {
    const root = find(uid[index[3 * t]]);
    let c = compOfRoot.get(root);
    if (c === undefined) {
      compOfRoot.set(root, (c = boxes.length));
      boxes.push([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
    }
    compOfTri[t] = c;
    const b = boxes[c];
    for (let k = 0; k < 3; k++) {
      const v = index[3 * t + k];
      for (let d = 0; d < 3; d++) {
        const p = positions[3 * v + d];
        if (p < b[d]) b[d] = p;
        if (p > b[d + 3]) b[d + 3] = p;
      }
    }
  }

  // 4. Giữ maxParts mảnh có đường chéo lớn nhất (nhóm 0 = lớn nhất)
  const diag = boxes.map((b) => Math.hypot(b[3] - b[0], b[4] - b[1], b[5] - b[2]));
  const order = boxes.map((_, i) => i).sort((a, b) => diag[b] - diag[a]);
  const keep = order.slice(0, Math.max(1, maxParts));
  const groupOfComp = new Int32Array(boxes.length).fill(-1);
  keep.forEach((c, g) => (groupOfComp[c] = g));

  // 5. Mảnh còn lại → mảnh được giữ gần nhất (khoảng cách từ tâm mảnh nhỏ tới hộp bao mảnh lớn)
  for (const c of order.slice(keep.length)) {
    const b = boxes[c];
    const cx = (b[0] + b[3]) / 2, cy = (b[1] + b[4]) / 2, cz = (b[2] + b[5]) / 2;
    let best = 0, bestD = Infinity;
    keep.forEach((k, g) => {
      const K = boxes[k];
      const dx = Math.max(K[0] - cx, 0, cx - K[3]);
      const dy = Math.max(K[1] - cy, 0, cy - K[4]);
      const dz = Math.max(K[2] - cz, 0, cz - K[5]);
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bestD) (bestD = d), (best = g);
    });
    groupOfComp[c] = best;
  }

  const groupOfTriangle = new Int32Array(triCount);
  for (let t = 0; t < triCount; t++) groupOfTriangle[t] = groupOfComp[compOfTri[t]];
  return { groupOfTriangle, groupCount: keep.length };
}
```

- [ ] **Step 4: Chạy test, xác nhận qua**

Run: `cd web && npm test`
Expected: `# pass 63`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add web/lib/looseParts.ts web/lib/looseParts.test.ts
git commit -m "Nhóm tam giác theo mảnh rời, gộp mảnh nhỏ vào mảnh lớn gần nhất"
```

---

### Task 2: `lib/splitMesh.ts` và bỏ qua mesh ẩn trong `makeParts`

**Files:**
- Create: `web/lib/splitMesh.ts`, `web/lib/splitMesh.test.ts`
- Modify: `web/lib/placeParts.ts` (traverse chỉ lấy mesh `visible`), `web/lib/placeParts.test.ts`

**Interfaces:**
- Consumes: `groupTriangles`, `MAX_AUTO_PARTS` (`./looseParts.ts`)
- Produces: `AUTO_SPLIT_MAX_MESHES = 4`; `splitMesh(mesh: THREE.Mesh, maxParts?: number): THREE.Mesh[]` — mỗi mesh mới cùng material, cùng position/quaternion/scale với mesh gốc, chưa gắn vào cây; `[]` nếu không tách được.

- [ ] **Step 1: Viết test thất bại**

`web/lib/splitMesh.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { splitMesh } from "./splitMesh.ts";

function twoTriangles(interleaved = false) {
  const pos = [0, 0, 0, 1, 0, 0, 0, 1, 0, 5, 0, 0, 6, 0, 0, 5, 1, 0];
  const uv = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
  const g = new THREE.BufferGeometry();
  if (interleaved) {
    const data: number[] = [];
    for (let i = 0; i < 6; i++) data.push(...pos.slice(3 * i, 3 * i + 3), ...uv.slice(2 * i, 2 * i + 2));
    const ib = new THREE.InterleavedBuffer(new Float32Array(data), 5);
    g.setAttribute("position", new THREE.InterleavedBufferAttribute(ib, 3, 0));
    g.setAttribute("uv", new THREE.InterleavedBufferAttribute(ib, 2, 3));
  } else {
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  }
  g.setIndex([0, 1, 2, 3, 4, 5]);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial());
  m.position.set(1, 2, 3);
  return m;
}

const worldVerts = (meshes: THREE.Mesh[]) =>
  meshes
    .flatMap((m) => {
      m.updateMatrixWorld(true);
      const p = m.geometry.getAttribute("position");
      return Array.from({ length: p.count }, (_, i) =>
        new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(m.matrixWorld).toArray().map((v) => +v.toFixed(5)).join(","),
      );
    })
    .sort();

test("mesh 2 mảnh rời → 2 mesh: đủ tam giác, đủ attribute, cùng material, vị trí world không đổi", () => {
  const src = twoTriangles();
  const parts = splitMesh(src);
  assert.equal(parts.length, 2);
  assert.equal(parts.reduce((n, m) => n + (m.geometry.index?.count ?? 0) / 3, 0), 2);
  for (const m of parts) {
    assert.ok(m.geometry.getAttribute("position") && m.geometry.getAttribute("uv"));
    assert.equal(m.material, src.material);
  }
  assert.deepEqual(worldVerts(parts), worldVerts([src]));
});

test("attribute xen kẽ (interleaved, GLTFLoader có thể tạo) vẫn tách và chép đúng", () => {
  const src = twoTriangles(true);
  const parts = splitMesh(src);
  assert.equal(parts.length, 2);
  assert.deepEqual(worldVerts(parts), worldVerts([src]));
  const uv = parts[0].geometry.getAttribute("uv");
  assert.equal(uv.itemSize, 2);
});

test("một mảnh liền hoặc không có index → không tách", () => {
  const one = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  assert.deepEqual(splitMesh(one), []);
  const noIndex = new THREE.Mesh(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3)));
  assert.deepEqual(splitMesh(noIndex), []);
});
```

Thêm vào cuối `web/lib/placeParts.test.ts`:
```ts
test("mesh bị ẩn (mesh gốc đã được tách) không thành linh kiện", () => {
  const { rig, root } = scene();
  const hidden = box(0), shown = box(3);
  hidden.visible = false;
  root.add(hidden, shown);
  rig.updateMatrixWorld(true);
  const parts = makeParts(root);
  assert.deepEqual(parts.map((p) => p.mesh), [shown]);
});
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `cd web && npm test`
Expected: FAIL — không tìm thấy `./splitMesh.ts`; test mesh ẩn thất bại (2 linh kiện thay vì 1).

- [ ] **Step 3: Viết `web/lib/splitMesh.ts`**

```ts
/** Tách một mesh thành nhiều mesh theo mảnh rời (three, không React → test bằng Node). */
import * as THREE from "three";
import { groupTriangles, MAX_AUTO_PARTS } from "./looseParts.ts";

export const AUTO_SPLIT_MAX_MESHES = 4; // model có nhiều mesh hơn coi như đã chia linh kiện sẵn

export function splitMesh(mesh: THREE.Mesh, maxParts = MAX_AUTO_PARTS): THREE.Mesh[] {
  const geo = mesh.geometry;
  const index = geo.index;
  const pos = geo.getAttribute("position");
  if (!index || !pos || Array.isArray(mesh.material) || geo.groups.length > 1) return [];

  const flat = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    flat[3 * i] = pos.getX(i);
    flat[3 * i + 1] = pos.getY(i);
    flat[3 * i + 2] = pos.getZ(i);
  }
  const { groupOfTriangle, groupCount } = groupTriangles(flat, index.array, maxParts);
  if (groupCount < 2) return [];

  const tris: number[][] = Array.from({ length: groupCount }, () => []);
  for (let t = 0; t < groupOfTriangle.length; t++) tris[groupOfTriangle[t]].push(t);

  return tris.map((list) => {
    const remap = new Map<number, number>();
    const newIndex: number[] = [];
    for (const t of list) {
      for (let k = 0; k < 3; k++) {
        const v = index.getX(3 * t + k);
        let n = remap.get(v);
        if (n === undefined) remap.set(v, (n = remap.size));
        newIndex.push(n);
      }
    }
    const out = new THREE.BufferGeometry();
    const olds = [...remap.keys()];
    for (const [name, attr] of Object.entries(geo.attributes)) {
      const size = attr.itemSize;
      const Ctor = attr.array.constructor as new (n: number) => THREE.TypedArray;
      const arr = new Ctor(olds.length * size);
      // getComponent đọc đúng cả attribute xen kẽ (InterleavedBufferAttribute)
      olds.forEach((old, i) => {
        for (let c = 0; c < size; c++) arr[i * size + c] = attr.getComponent(old, c);
      });
      out.setAttribute(name, new THREE.BufferAttribute(arr, size, attr.normalized));
    }
    out.setIndex(newIndex);
    const m = new THREE.Mesh(out, mesh.material);
    m.position.copy(mesh.position);
    m.quaternion.copy(mesh.quaternion);
    m.scale.copy(mesh.scale);
    return m;
  });
}
```

- [ ] **Step 4: `makeParts` chỉ lấy mesh đang hiện — sửa trong `web/lib/placeParts.ts`**

Thay
```ts
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
```
bằng
```ts
    if ((o as THREE.Mesh).isMesh && o.visible) meshes.push(o as THREE.Mesh); // mesh gốc đã tách bị ẩn → bỏ qua
```

- [ ] **Step 5: Chạy test, xác nhận qua**

Run: `cd web && npm test`
Expected: `# pass 67`, `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add web/lib/splitMesh.ts web/lib/splitMesh.test.ts web/lib/placeParts.ts web/lib/placeParts.test.ts
git commit -m "Tách mesh theo mảnh rời; bỏ qua mesh ẩn khi thu thập linh kiện"
```

---

### Task 3: Gắn tự tách vào `Scene`

**Files:**
- Modify: `web/components/Scene.tsx`

**Interfaces:**
- Consumes: `splitMesh`, `AUTO_SPLIT_MAX_MESHES` (`@/lib/splitMesh`)

- [ ] **Step 1: Thêm import vào `web/components/Scene.tsx`**

```tsx
import { AUTO_SPLIT_MAX_MESHES, splitMesh } from "@/lib/splitMesh";
```

- [ ] **Step 2: Thêm hàm `autoSplit` ngay trên `collectParts`**

```tsx
/**
 * Model ít mesh (≤ 4) thường là nhiều mảnh rời bị gộp lại (vd. Sketchfab chuyển từ FBX) → tách theo mảnh rời.
 * Ẩn mesh gốc, thêm mesh mới cạnh nó; trả về hàm hoàn tác (scene glb được cache và dùng lại).
 */
function autoSplit(root: THREE.Object3D): () => void {
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o.visible) meshes.push(o as THREE.Mesh);
  });
  if (meshes.length > AUTO_SPLIT_MAX_MESHES) return () => {};
  const added: THREE.Mesh[] = [];
  const hidden: THREE.Mesh[] = [];
  let n = 0;
  for (const mesh of meshes) {
    const parent = mesh.parent;
    const pieces = parent ? splitMesh(mesh) : [];
    if (!parent || pieces.length === 0) continue;
    for (const p of pieces) {
      p.name = `Mảnh ${++n}`;
      parent.add(p);
      added.push(p);
    }
    mesh.visible = false;
    hidden.push(mesh);
  }
  return () => {
    for (const p of added) {
      p.removeFromParent();
      p.geometry.dispose();
    }
    for (const m of hidden) m.visible = true;
  };
}
```

- [ ] **Step 3: Gọi `autoSplit` trong `PartsCollector`**

Trong effect của `PartsCollector`, thay
```tsx
    const parts = collectParts(root);
```
bằng
```tsx
    const undoSplit = autoSplit(root);
    const parts = collectParts(root);
```
và trong hàm cleanup, sau vòng `for (const p of parts) {...}`, thêm:
```tsx
      undoSplit();
```

- [ ] **Step 4: Lint, typecheck, build, test**

```bash
cd web && npm run lint && npx tsc --noEmit && npm run build && npm test
```
Expected: không lỗi; `# pass 67`.

- [ ] **Step 5: e2e (playwright-cli, camera giả)**

Chạy `npm run dev -- -p 3010`. Script `split-e2e.js`:
```js
async page => {
  const r = {};
  const drop = (gltf, name) => page.evaluate(([g, n]) => {
    const dt = new DataTransfer();
    dt.items.add(new File([JSON.stringify(g)], n, { type: "model/gltf+json" }));
    document.querySelector("canvas").dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, [gltf, name]);
  const b64 = (bytes) => Buffer.from(bytes).toString("base64");
  // 1 mesh gồm 2 tam giác rời: 6 đỉnh float32 (72 byte) + 6 chỉ số uint16 (12 byte)
  const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 5, 0, 0, 6, 0, 0, 5, 1, 0]);
  const idx = new Uint16Array([0, 1, 2, 3, 4, 5]);
  const buf = new Uint8Array(84);
  buf.set(new Uint8Array(pos.buffer), 0);
  buf.set(new Uint8Array(idx.buffer), 72);
  const twoPieces = {
    asset: { version: "2.0" }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: "Gộp" }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    buffers: [{ byteLength: 84, uri: "data:application/octet-stream;base64," + b64(buf) }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 72 }, { buffer: 0, byteOffset: 72, byteLength: 12 }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 6, type: "VEC3", min: [0, 0, 0], max: [6, 1, 0] },
      { bufferView: 1, componentType: 5123, count: 6, type: "SCALAR" },
    ],
  };
  const parts = () => page.locator("[data-parts]").getAttribute("data-parts");
  const waitParts = (n) => page.waitForFunction((n) => document.querySelector("[data-parts]")?.getAttribute("data-parts") === String(n), n, { timeout: 15000 });
  await page.goto("http://localhost:3010/play");
  await waitParts(9);
  r.demo = await parts();
  await drop(twoPieces, "hai-manh.gltf");
  await waitParts(2);
  r.twoPieces = await parts();
  // gỡ rồi thả lại đúng file: không nhân đôi
  await drop(twoPieces, "hai-manh-lan-2.gltf");
  await waitParts(2);
  r.again = await parts();
  return JSON.stringify(r);
}
```
Ghi chú: `Buffer` không có trong trình duyệt nhưng script này chạy phía Node của playwright (`run-code`), chỉ phần `page.evaluate` chạy trong trang.
Chạy: `playwright-cli open --config=pw-fakecam.json http://localhost:3010/play` rồi `playwright-cli --raw run-code --filename=split-e2e.js`, `playwright-cli console error`.
Expected: `demo: "9"`, `twoPieces: "2"`, `again: "2"`; console không lỗi đỏ. Chạy lại `parts-e2e.js` (Task 3 spec 3): glTF 1 tam giác vẫn "liền một khối".

- [ ] **Step 6: Kiểm tra thủ công với file Zeta (không commit file)**

Copy `msz-006_zeta_gundam.glb` (thư mục gốc repo chính) vào scratchpad, thả vào `/play` bằng `setInputFiles` trên `input[type=file]`. Ghi lại: `data-parts` (kỳ vọng 2 < N ≤ 160), thời gian từ lúc thả đến lúc `data-parts` đổi. Tạm (không commit) ép `explode = 1.2` như spec 3, chụp ảnh, xem lại rồi hoàn tác.

- [ ] **Step 7: Commit**

```bash
git add web/components/Scene.tsx
git commit -m "Tự tách mảnh rời khi model có ít mesh"
```

---

### Task 4: Tài liệu

**Files:**
- Modify: `README.md`, `CLAUDE.md`

- [ ] **Step 1: README — sau đoạn tách linh kiện trong mục "Bản web", thêm**

```markdown
Model có ít mesh (≤ 4) nhưng gồm nhiều mảnh rời (thường gặp với model Sketchfab) được tự tách theo mảnh rời: tối đa 80 linh kiện mỗi mesh, mảnh li ti (ốc, gờ) gộp vào mảnh lớn gần nhất; tên hiển thị "Mảnh 1…N".
```

- [ ] **Step 2: CLAUDE.md — thêm dòng**

```markdown
- Tự tách mảnh rời: `web/lib/looseParts.ts` (thuần) + `web/lib/splitMesh.ts` (three); `Scene.autoSplit` ẩn mesh gốc, thêm mesh mới, hoàn tác khi gỡ model. Không commit file model thật (`*.glb` đã gitignore).
```

- [ ] **Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "Tài liệu tự tách mảnh rời"
```
