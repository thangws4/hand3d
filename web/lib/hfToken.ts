/** Hugging Face token của người dùng: chỉ lưu trong trình duyệt, chỉ gửi tới Hugging Face. */
export const TOKEN_KEY = "hand3d.hfToken";

export const isValidToken = (t: string) => /^hf_[A-Za-z0-9]{30,}$/.test(t.trim());

// Chỉ khi `npm run dev`: token đặt trong web/.env.local (không lên git). Bản build production gấp điều kiện
// thành "" nên giá trị token không bao giờ vào bundle, kể cả khi lỡ đặt biến này trên Vercel.
const DEV_TOKEN = process.env.NODE_ENV === "development" ? (process.env.NEXT_PUBLIC_HF_TOKEN ?? "") : "";

/** Token đã lưu trên trang được ưu tiên; không có thì dùng token từ .env.local nếu hợp lệ. */
export const pickToken = (stored: string, dev: string) => stored || (isValidToken(dev) ? dev.trim() : "");

export function loadToken(): string {
  let stored = "";
  try {
    stored = localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {} // ngoài trình duyệt hoặc bị chặn lưu trữ
  return pickToken(stored, DEV_TOKEN);
}

export function saveToken(t: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, t.trim());
  } catch {}
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export const maskToken = (t: string) => `hf_••••${t.slice(-4)}`;
