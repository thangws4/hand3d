export type GenErrorCode = "bad_image" | "bad_token" | "quota" | "space_down" | "timeout" | "cancelled" | "unknown";

export class GenError extends Error {
  code: GenErrorCode;
  retryIn?: string;
  constructor(code: GenErrorCode, message: string, retryIn?: string) {
    super(message);
    this.name = "GenError";
    this.code = code;
    this.retryIn = retryIn;
  }
}

type StatusLike = { title?: unknown; message?: unknown };

function textOf(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const { title, message } = err as StatusLike;
    const msg =
      typeof message === "string"
        ? message
        : Array.isArray(message)
          ? message.map((m) => (m && typeof m === "object" && "message" in m ? String(m.message) : String(m))).join("; ")
          : "";
    return [typeof title === "string" ? title : "", msg].filter(Boolean).join(": ");
  }
  return String(err);
}

export function classifyError(err: unknown, fallback: GenErrorCode = "unknown"): GenError {
  if (err instanceof GenError) return err;
  const text = textOf(err);
  if (/exceeded your ZeroGPU quota|ZeroGPU quota exceeded/i.test(text)) {
    const retryIn = text.match(/Try again in ([\d:]+)/)?.[1];
    // HF trả câu này khi request bị coi là ẩn danh → token thiếu hoặc không được chấp nhận
    const code = /Authenticate with a Hugging Face token/i.test(text) ? "bad_token" : "quota";
    return new GenError(code, text, retryIn);
  }
  if (/invalid (user )?token|unauthori[sz]ed|\b401\b|\b403\b/i.test(text)) return new GenError("bad_token", text);
  if (/ZeroGPU worker error|could not resolve app config|failed to fetch|networkerror|connection (error|closed)|space .*(sleeping|paused|building|runtime error)/i.test(text)) {
    return new GenError("space_down", text);
  }
  return new GenError(fallback, text);
}

export function errorMessage(e: GenError): string {
  switch (e.code) {
    case "bad_image":
      return `Ảnh không dùng được (${e.message}). Chọn file jpg, png hoặc webp dưới 10 MB.`;
    case "bad_token":
      return "Hugging Face không chấp nhận token này nên coi bạn là người dùng ẩn danh. Kiểm tra lại hoặc tạo token loại Read mới tại huggingface.co/settings/tokens.";
    case "quota":
      return `Đã hết lượt GPU miễn phí của tài khoản Hugging Face${e.retryIn ? `; thử lại sau ${e.retryIn}` : ""}.`;
    case "space_down":
      return "Space tạo 3D đang bảo trì hoặc quá tải. Thử lại sau ít phút.";
    case "timeout":
      return "Quá 6 phút vẫn chưa xong, hàng đợi đang đông. Thử lại sau.";
    case "cancelled":
      return "Đã huỷ.";
    default:
      return `Có lỗi: ${e.message || "không rõ"}. Thử lại.`;
  }
}
