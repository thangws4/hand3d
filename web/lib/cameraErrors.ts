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
