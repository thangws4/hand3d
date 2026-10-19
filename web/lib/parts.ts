/** Toán cho việc tách linh kiện. Thuần, không phụ thuộc three. */
export type Vec2 = { x: number; y: number };
export type Vec3 = { x: number; y: number; z: number };

/** Exploded view: linh kiện đi ra xa tâm model theo đúng hướng của nó, tỉ lệ với độ bung. */
export const explodeOffset = (part: Vec3, center: Vec3, amount: number): Vec3 => ({
  x: (part.x - center.x) * amount,
  y: (part.y - center.y) * amount,
  z: (part.z - center.z) * amount,
});
