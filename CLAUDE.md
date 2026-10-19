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
