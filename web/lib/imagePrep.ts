import { GenError } from "./genErrors.ts";

export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_SIDE = 1024;
export const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export function checkImage(f: { type: string; size: number }): GenError | null {
  if (!ACCEPTED.includes(f.type)) return new GenError("bad_image", `Định dạng ${f.type || "không rõ"} không được hỗ trợ`);
  if (f.size > MAX_BYTES) return new GenError("bad_image", "Ảnh lớn hơn 10 MB");
  return null;
}

export function fitWithin(width: number, height: number, max = MAX_SIDE) {
  const k = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * k), height: Math.round(height * k) };
}

/** Trình duyệt: kiểm tra rồi thu nhỏ ảnh về cạnh dài ≤ MAX_SIDE, xuất PNG. */
export async function prepImage(file: File): Promise<Blob> {
  const err = checkImage(file);
  if (err) throw err;
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new GenError("bad_image", "Không đọc được ảnh");
  }
  const { width, height } = fitWithin(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(bmp, 0, 0, width, height);
  bmp.close();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new GenError("bad_image", "Không xử lý được ảnh"))), "image/png"),
  );
}
