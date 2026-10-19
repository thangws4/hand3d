/** Nhóm tam giác theo mảnh rời; giữ tối đa maxParts mảnh lớn nhất, mảnh còn lại gộp vào mảnh lớn gần nhất. Thuần, không three. */
export const MAX_AUTO_PARTS = 80;
/** Mảnh nhỏ hơn tỉ lệ này (đường chéo so với cả mesh) không thành linh kiện riêng — tránh "thân + mảnh vụn" ở model AI/quét. */
export const MIN_PART_RATIO = 0.05;
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
  const all = boxes.reduce(
    (u, b) => [Math.min(u[0], b[0]), Math.min(u[1], b[1]), Math.min(u[2], b[2]), Math.max(u[3], b[3]), Math.max(u[4], b[4]), Math.max(u[5], b[5])],
    [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity],
  );
  const minDiag = MIN_PART_RATIO * Math.hypot(all[3] - all[0], all[4] - all[1], all[5] - all[2]);
  const big = order.filter((c) => diag[c] >= minDiag);
  const keep = (big.length ? big : order).slice(0, Math.max(1, maxParts));
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
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    });
    groupOfComp[c] = best;
  }

  const groupOfTriangle = new Int32Array(triCount);
  for (let t = 0; t < triCount; t++) groupOfTriangle[t] = groupOfComp[compOfTri[t]];
  return { groupOfTriangle, groupCount: keep.length };
}
