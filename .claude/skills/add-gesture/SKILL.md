---
name: add-gesture
description: Thêm cử chỉ tay mới vào dự án — luật trong gestures.py, assert self-check, xử lý trong main.py, cập nhật bảng README. Dùng khi người dùng muốn nhận diện hoặc gán hành động cho một cử chỉ mới.
---

# Thêm cử chỉ mới

Sửa đủ 4 chỗ, theo thứ tự:

1. **`gestures.py` → `classify()`**: thêm luật hình học, trả về tên viết HOA (vd. `"POINT"`).
   - Dùng lại `dist`, `hand_size`, `fingers_up`, `FINGERS`; chuẩn hoá khoảng cách theo `hand_size(lm)`.
   - Thứ tự `if` quan trọng: luật cụ thể hơn đặt trước (PINCH đang được kiểm tra đầu tiên).
   - Ngưỡng mới để thành hằng số ở đầu file, kèm comment "chỉnh theo tay và camera".
2. **`gestures.py` → khối `__main__`**: thêm một `assert classify(hand(...)) == "TÊN"` dùng helper `hand()`. Chạy `python gestures.py` phải in `gestures OK`; cũng kiểm tra cử chỉ cũ không bị nhận nhầm.
3. **`main.py` → `update()`**: cử chỉ điều khiển bằng di tay → thêm vào `DRAG_GESTURES` và một nhánh trong khối `if prev:`; cử chỉ giữ yên (như `THUMBS_UP`) → kiểm tra `in gestures` trong nhánh `else`. Reset thao tác đang dở bằng `state.update(drag=None, zoom=None)` nếu cần.
4. **`README.md`**: thêm dòng vào bảng "Cử chỉ trong `main.py`"; nếu có ngưỡng mới, thêm vào "Các thông số cần tự chỉnh".

`step3_gestures.py` tự hiển thị nhãn mới, không cần sửa.
