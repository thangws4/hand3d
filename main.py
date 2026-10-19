"""Điều khiển mô hình 3D bằng tay.

Chạy:  python main.py              -> khối lập phương mẫu
       python main.py ten_model    -> tìm models/ten_model.obj | .glb | .gltf

Cử chỉ (1 tay):
  Chụm + di chuyển              -> xoay
  Chỉ ngón trỏ + di chuyển      -> kéo model đi
  Chữ V + kéo lên/xuống         -> phóng to / thu nhỏ
  Giơ ngón cái                  -> tự quay
  Nắm tay                       -> đặt lại
Cử chỉ (2 tay):
  Chụm 2 tay + kéo xa/gần       -> phóng to / thu nhỏ
ESC                             -> thoát
"""
import sys

import cv2
from ursina import Entity, Text, Ursina, Vec2, application, clamp, load_model, time, window

from gestures import Smooth, classify, dist
from tracker import HandTracker, draw_hand

ROT_SENS = 300            # độ xoay khi tay quét hết chiều ngang khung hình; đổi dấu nếu xoay ngược
PAN_SENS = 20             # đơn vị dịch chuyển khi tay quét hết khung hình
ZOOM_SENS = 3             # chữ V: kéo lên 1/10 khung hình -> to thêm ~30%
SPIN_SPEED = 90           # độ/giây khi giơ ngón cái
ZOOM_MIN, ZOOM_MAX = 0.2, 5
DRAG_GESTURES = ("PINCH", "POINT", "PEACE")  # cử chỉ điều khiển bằng cách di tay
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
state = {"drag": None, "zoom": None}  # (cử chỉ, x, y) khung trước / (khoảng cách, scale) lúc bắt đầu zoom 2 tay
smooth_x, smooth_y = Smooth(), Smooth()


def update():
    # ponytail: nhận diện chạy chung luồng với render nên FPS bị giới hạn bởi MediaPipe; tách thread nếu cần mượt hơn
    frame, hands = tracker.read()
    if frame is None:
        return
    gestures = [classify(lm) for lm, _ in hands]
    pinches = [lm for (lm, _), g in zip(hands, gestures) if g == "PINCH"]

    if "FIST" in gestures:
        obj.rotation, obj.position, obj.scale = (0, 0, 0), (0, 0, 0), base_scale
        state.update(drag=None, zoom=None)
    elif len(pinches) == 2:
        state["drag"] = None
        d = dist(pinches[0][8], pinches[1][8])
        if state["zoom"] is None:
            state["zoom"] = (max(d, 1e-6), obj.scale_x)
        d0, s0 = state["zoom"]
        obj.scale = clamp(s0 * d / d0, ZOOM_MIN * base_scale, ZOOM_MAX * base_scale)
    else:
        state["zoom"] = None
        if "THUMBS_UP" in gestures:
            obj.rotation_y += SPIN_SPEED * time.dt
        g, lm = next(((g, lm) for (lm, _), g in zip(hands, gestures) if g in DRAG_GESTURES), (None, None))
        if g is None:  # thả tay: "nhả ly hợp", model đứng yên
            state["drag"] = None
        else:
            prev = state["drag"]
            if prev is None or prev[0] != g:  # vừa đổi cử chỉ: xoá lịch sử lọc để không bị giật
                smooth_x.value = smooth_y.value = None
                prev = None
            x, y = smooth_x(lm[8].x), smooth_y(lm[8].y)
            if prev:
                dx, dy = x - prev[1], y - prev[2]
                if g == "PINCH":
                    obj.rotation_y -= dx * ROT_SENS
                    obj.rotation_x -= dy * ROT_SENS
                elif g == "POINT":
                    obj.x += dx * PAN_SENS
                    obj.y -= dy * PAN_SENS  # ảnh: y tăng xuống dưới; 3D: y tăng lên trên
                else:  # PEACE: kéo lên = phóng to
                    obj.scale = clamp(obj.scale_x * (1 - dy * ZOOM_SENS), ZOOM_MIN * base_scale, ZOOM_MAX * base_scale)
            state["drag"] = (g, x, y)

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
