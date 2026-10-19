# hand3d

- Python 3.11, chạy bằng `.venv\Scripts\python`.
- Không thêm `opencv-python`: `mediapipe` đã kéo theo `opencv-contrib-python`, cài cả hai sẽ xung đột.
- MediaPipe dùng Tasks API (`mediapipe.tasks.python.vision.HandLandmarker`), không dùng `mp.solutions.hands` cũ.
- `CAMERA = 1` trong `tracker.py`: trên máy này 0 là Snap Camera ảo.
- Kiểm tra logic: `python gestures.py` → `gestures OK` (hook tự chạy sau mỗi lần sửa file).
- Thêm cử chỉ mới: dùng skill `add-gesture`.
