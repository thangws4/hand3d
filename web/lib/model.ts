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
