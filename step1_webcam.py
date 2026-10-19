"""Bước 1: mở webcam, lật gương, hiển thị FPS. Bấm ESC để thoát."""
import time

import cv2

from tracker import CAMERA

cap = cv2.VideoCapture(CAMERA)
prev = time.time()
while True:
    ok, frame = cap.read()
    if not ok:
        print(f"Không đọc được camera {CAMERA}. Đổi CAMERA trong tracker.py sang 0, 1, 2...")
        break
    frame = cv2.flip(frame, 1)
    now = time.time()
    fps, prev = 1 / max(now - prev, 1e-6), now
    cv2.putText(frame, f"FPS: {fps:.0f}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
    cv2.imshow("Step 1 - Webcam", frame)
    if cv2.waitKey(1) & 0xFF == 27:
        break
cap.release()
cv2.destroyAllWindows()
