"""Bước 2: phát hiện bàn tay, vẽ 21 điểm mốc kèm số thứ tự. Bấm ESC để thoát."""
import cv2

from tracker import HandTracker, draw_hand

tracker = HandTracker()
while True:
    frame, hands = tracker.read()
    if frame is None:
        break
    for lm, side in hands:
        draw_hand(frame, lm)
        cv2.putText(frame, side, (int(lm[0].x * frame.shape[1]), int(lm[0].y * frame.shape[0]) + 25),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 0, 0), 2)
    cv2.imshow("Step 2 - Hands", frame)
    if cv2.waitKey(1) & 0xFF == 27:
        break
tracker.close()
