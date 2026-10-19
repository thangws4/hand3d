# hand3d

- Python 3.11, chạy bằng `.venv\Scripts\python`.
- Không thêm `opencv-python`: `mediapipe` đã kéo theo `opencv-contrib-python`, cài cả hai sẽ xung đột.
- MediaPipe dùng Tasks API (`mediapipe.tasks.python.vision.HandLandmarker`), không dùng `mp.solutions.hands` cũ.
- `CAMERA = 1` trong `tracker.py`: trên máy này 0 là Snap Camera ảo.
- Kiểm tra logic: `python gestures.py` → `gestures OK` (hook tự chạy sau mỗi lần sửa file).
- Thêm cử chỉ mới: dùng skill `add-gesture`.
- Bản web ở `web/` (Next.js 16): `npm run dev`, `npm test` (= `node --test "lib/**/*.test.ts"`, Node 22 chạy TS trực tiếp), `npm run build`.
- `web/lib/*.ts` phải chạy được bằng Node type stripping: không enum/namespace/parameter properties; import tương đối ghi đuôi `.ts`.
- Logic cử chỉ có 2 bản phải giữ đồng bộ: `gestures.py` ↔ `web/lib/gestures.ts`, `main.py update()` ↔ `web/lib/controller.ts`.
- `/create` gọi Space `microsoft/TRELLIS.2` từ trình duyệt (`web/lib/imageTo3d.ts`, client tiêm được để test). Ẩn danh bị chặn quota; lỗi quota có câu "Authenticate with a Hugging Face token" = token không được chấp nhận (`bad_token`). Không dùng token HF thật khi test — dùng `"hf_" + "x".repeat(34)`.
- `web/.env.local` (`NEXT_PUBLIC_HF_TOKEN`, gitignored) chỉ được đọc khi `NODE_ENV === "development"` (`web/lib/hfToken.ts`); giữ nguyên điều kiện này — bỏ nó đi thì token bị nhúng vào bundle production. Không đọc/in nội dung `.env.local`.
