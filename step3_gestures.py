"""Bước 3: nhận diện cử chỉ PINCH / POINT / PEACE / THUMBS_UP / FIST / OPEN. Bấm ESC để thoát."""
import cv2

from gestures import classify, dist, hand_size, thumb_lift
from tracker import HandTracker, draw_hand

tracker = HandTracker()
while True:
    frame, hands = tracker.read()
    if frame is None:
        break
    for i, (lm, side) in enumerate(hands):
        draw_hand(frame, lm, label=False)
        ratio = dist(lm[4], lm[8]) / hand_size(lm)  # in ra để tự chỉnh PINCH_THRESHOLD
        cv2.putText(frame, f"{side}: {classify(lm)}  pinch={ratio:.2f} thumb={thumb_lift(lm):.2f}", (10, 30 + 30 * i),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
    cv2.imshow("Step 3 - Gestures", frame)
    if cv2.waitKey(1) & 0xFF == 27:
        break
tracker.close()
