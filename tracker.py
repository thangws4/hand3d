"""Bọc webcam + MediaPipe Hand Landmarker để các bước sau dùng lại."""
import time
import urllib.request
from pathlib import Path

import cv2
import mediapipe as mp
from mediapipe.tasks.python import BaseOptions, vision

CAMERA = 1  # index webcam; máy này: 0 = Snap Camera (ảo), 1 = Integrated Webcam

MODEL_PATH = Path(__file__).with_name("hand_landmarker.task")
MODEL_URL = ("https://storage.googleapis.com/mediapipe-models/hand_landmarker/"
             "hand_landmarker/float16/latest/hand_landmarker.task")

# Các cặp điểm nối thành khung xương bàn tay
CONNECTIONS = [(0, 1), (1, 2), (2, 3), (3, 4), (0, 5), (5, 6), (6, 7), (7, 8),
               (5, 9), (9, 10), (10, 11), (11, 12), (9, 13), (13, 14), (14, 15),
               (15, 16), (13, 17), (17, 18), (18, 19), (19, 20), (0, 17)]


class HandTracker:
    def __init__(self, camera=CAMERA, num_hands=2, width=640, height=480):
        if not MODEL_PATH.exists():
            print("Đang tải mô hình hand_landmarker.task ...")
            urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
        self.detector = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(MODEL_PATH)),
            running_mode=vision.RunningMode.VIDEO,
            num_hands=num_hands))
        self.cap = cv2.VideoCapture(camera)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        self.last_ts = 0

    def read(self):
        """Trả về (frame đã lật gương, danh sách (landmarks, "Left"/"Right")). frame=None nếu mất camera."""
        ok, frame = self.cap.read()
        if not ok:
            return None, []
        frame = cv2.flip(frame, 1)
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)  # OpenCV dùng BGR, MediaPipe cần RGB
        # Chế độ VIDEO yêu cầu timestamp (ms) tăng dần
        self.last_ts = max(self.last_ts + 1, int(time.time() * 1000))
        res = self.detector.detect_for_video(
            mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), self.last_ts)
        hands = [(lm, h[0].category_name) for lm, h in zip(res.hand_landmarks, res.handedness)]
        return frame, hands

    def close(self):
        self.cap.release()
        self.detector.close()
        cv2.destroyAllWindows()


def draw_hand(frame, lm, label=True):
    h, w = frame.shape[:2]
    pts = [(int(p.x * w), int(p.y * h)) for p in lm]
    for a, b in CONNECTIONS:
        cv2.line(frame, pts[a], pts[b], (255, 255, 255), 2)
    for i, p in enumerate(pts):
        cv2.circle(frame, p, 4, (0, 255, 0), -1)
        if label:
            cv2.putText(frame, str(i), (p[0] + 5, p[1] - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 255), 1)
