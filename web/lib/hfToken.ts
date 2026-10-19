/** Hugging Face token của người dùng: chỉ lưu trong trình duyệt, chỉ gửi tới Hugging Face. */
export const TOKEN_KEY = "hand3d.hfToken";

export const isValidToken = (t: string) => /^hf_[A-Za-z0-9]{30,}$/.test(t.trim());

export function loadToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return ""; // ngoài trình duyệt hoặc bị chặn lưu trữ
  }
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
