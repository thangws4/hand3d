"""Điều khiển mô hình 3D bằng tay.

Chạy:  python main.py              -> khối lập phương mẫu
       python main.py ten_model    -> tìm models/ten_model.obj | .glb | .gltf

Cử chỉ:
  Chụm 1 tay + di chuyển        -> xoay
  Chụm 2 tay + kéo xa/gần       -> phóng to / thu nhỏ
  Nắm tay                       -> đặt lại
  ESC                           -> thoát
"""
import sys

import cv2
from ursina import Entity, Text, Ursina, Vec2, application, clamp, load_model, window

from gestures import Smooth, classify, dist
from tracker import HandTracker, draw_hand

ROT_SENS = 300            # độ xoay khi tay quét hết chiều ngang khung hình; đổi dấu nếu xoay ngược
ZOOM_MIN, ZOOM_MAX = 0.2, 5
FIT_SIZE = 4              # kích thước model sau khi tự co giãn cho vừa màn hình

app = Ursina(title="Hand 3D")
tracker = HandTracker()

name = sys.argv[1] if len(sys.argv) > 1 else None
mesh = load_model(name) if name else None
if name and mesh is None:
    print(f"Không tìm thấy model '{name}' trong thư mục dự án, dùng khối lập phương.")
obj = Entity(model=mesh or "cube", texture=None if mesh else "white_cube")
# Model tải về có thể to/nhỏ/lệch tâm bất kỳ -> đưa về giữa và co giãn cho vừa
obj.origin = obj.model_bounds.center
base_scale = FIT_SIZE / max(max(obj.model_bounds.size), 1e-6)
obj.scale = base_scale

hud = Text("", position=window.top_left + Vec2(0.02, -0.02))
state = {"rot": None, "zoom": None}   # điểm chụm trước đó / (khoảng cách, scale) lúc bắt đầu zoom
smooth_x, smooth_y = Smooth(), Smooth()


def update():
    # ponytail: nhận diện chạy chung luồng với render nên FPS bị giới hạn bởi MediaPipe; tách thread nếu cần mượt hơn
    frame, hands = tracker.read()
    if frame is None:
        return
    gestures = [classify(lm) for lm, _ in hands]
    pinches = [lm for (lm, _), g in zip(hands, gestures) if g == "PINCH"]

    if "FIST" in gestures:
        obj.rotation, obj.scale = (0, 0, 0), base_scale
        state.update(rot=None, zoom=None)
    elif len(pinches) == 2:
        state["rot"] = None
        d = dist(pinches[0][8], pinches[1][8])
        if state["zoom"] is None:
            state["zoom"] = (max(d, 1e-6), obj.scale_x)
        d0, s0 = state["zoom"]
        obj.scale = clamp(s0 * d / d0, ZOOM_MIN * base_scale, ZOOM_MAX * base_scale)
    elif len(pinches) == 1:
        state["zoom"] = None
        if state["rot"] is None:  # vừa bắt đầu chụm: xoá lịch sử lọc để không bị giật
            smooth_x.value = smooth_y.value = None
        x, y = smooth_x(pinches[0][8].x), smooth_y(pinches[0][8].y)
        if state["rot"] is not None:
            px, py = state["rot"]
            obj.rotation_y -= (x - px) * ROT_SENS
            obj.rotation_x -= (y - py) * ROT_SENS
        state["rot"] = (x, y)
    else:  # thả tay: "nhả ly hợp", model đứng yên
        state.update(rot=None, zoom=None)

    hud.text = " | ".join(f"{side}: {g}" for (_, side), g in zip(hands, gestures)) or "Không thấy tay"
    for lm, _ in hands:
        draw_hand(frame, lm, label=False)
    cv2.imshow("Camera", frame)
    cv2.waitKey(1)


def input(key):
    if key == "escape":
        tracker.close()
        application.quit()


app.run()
