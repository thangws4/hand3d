# Spec 5: Điều khiển bằng chuột trong `/play`

Ngày: 2026-10-20 · Trạng thái: chờ duyệt · Phụ thuộc: spec 3 (linh kiện), spec 4 (tự tách) — đã merge

## Mục tiêu

Ngoài cử chỉ tay, người dùng điều khiển được model bằng chuột (và chạm một ngón), dùng được ngay không cần bật camera.

**Người dùng nói:** "ngoài dùng cử chỉ có thể dùng chuột"; đồng ý bảng gán chuột, thanh trượt độ bung, nút đặt lại, màn hình bắt đầu không che cảnh.

**Thành công khi:**
1. Mở `/play` không bật camera: kéo chuột xoay được robot, lăn chuột zoom, kéo chuột phải (hoặc Shift + kéo) dịch model.
2. Rê chuột lên linh kiện → sáng lên + HUD hiện tên; kéo chuột trái trên linh kiện → linh kiện đi theo chuột, model không xoay.
3. Thanh trượt "Độ bung" bung/ráp được; khi bung bằng 2 tay, thanh trượt cập nhật theo. Nút "Đặt lại" = nắm tay.
4. Bật camera vẫn dùng tay như cũ; tay và chuột cùng lúc không làm hỏng nhau (cầm bằng chuột không bị bước xử lý tay thả ra).
5. Kéo một ngón trên màn hình cảm ứng hoạt động như kéo chuột trái.

## Ngoài phạm vi

Zoom 2 ngón trên điện thoại, phím tắt bàn phím, double-click, chuột trên `/create`.

## Gán chuột

| Thao tác | Hành động |
|---|---|
| Kéo chuột trái / một ngón, bắt đầu ở chỗ trống | Xoay (`ROT_SENS`, như PINCH) |
| Kéo chuột trái / một ngón, bắt đầu trên linh kiện | Cầm linh kiện, dịch theo mặt phẳng màn hình (`PAN_SENS`) — chỉ khi model có ≥ 2 linh kiện (hitTest) |
| Kéo chuột phải, hoặc Shift + kéo trái | Dịch model (`PAN_SENS`, như POINT) |
| Lăn chuột | Zoom: `zoom × exp(−deltaY × WHEEL_SENS)`, `WHEEL_SENS = 0.0015`, kẹp `[ZOOM_MIN, ZOOM_MAX]` |
| Rê chuột | Linh kiện dưới chuột sáng + tên trên HUD (khi không kéo) |
| Thanh trượt "Độ bung" `0…EXPLODE_MAX` | Đặt độ bung |
| Nút "Đặt lại" | `reset()` như FIST |

Toạ độ chuột chuẩn hoá theo khung `/play` (0..1), cùng hệ với con trỏ tay → dùng chung `hitTest`. Menu chuột phải bị chặn trên khung 3D; `touch-action: none` để kéo không cuộn trang.

## Kiến trúc

- `lib/controller.ts` thêm API chuột, thuần, test bằng Node:
  - `pointerDown(x, y, mode: "rotate" | "pan", hitTest?)` — `rotate` trên linh kiện → `pointerGrab = id`
  - `pointerMove(x, y)`, `pointerUp()`, `pointerHover(x, y, hitTest?)` → `pointerHovered`
  - `wheel(deltaY)`, `setExplode(v)` (kẹp)
  - Trạng thái chuột (`pointerGrab`, `pointerHovered`, điểm kéo trước) tách khỏi trạng thái tay; `step()` của tay không xoá `pointerGrab`; `reset()` xoá cả hai.
  - Khi tay đang bung (2 tay xoè) thì mốc bung lấy theo giá trị hiện tại → kéo thanh trượt rồi xoè tay không nhảy.
- `components/Player.tsx`: pointer events trên khung 3D (pointer capture khi kéo); lưu `hitTest` mới nhất nhận từ `onFrame` vào ref để dùng trong sự kiện chuột; highlight = `grabbed ?? pointerGrab ?? hovered ?? pointerHovered`; thanh trượt + nút "Đặt lại" ở góc; thanh trượt cập nhật theo `transform.explode` mỗi khung qua ref (không re-render).
- Màn hình bắt đầu: thẻ "Bật camera" thu nhỏ thành khung ở góc, không che khung 3D; thêm dòng hướng dẫn chuột.

## Kiểm thử

- `controller.test.ts` thêm: kéo chỗ trống → `rotY` đổi; kéo trên linh kiện → `partOffsets` đổi, `rotY` không đổi; `pan` → `x`/`y` đổi; `wheel` âm → zoom tăng, kẹp; `setExplode` kẹp `[0, EXPLODE_MAX]`; `pointerUp` → hết kéo; `step()` tay không xoá `pointerGrab`; `reset()` xoá `pointerGrab`.
- e2e (playwright, không bật camera):
  - kéo chuột trên chỗ trống → ảnh chụp khung 3D trước/sau khác nhau (model đã xoay);
  - rê chuột lên thân robot → HUD có "Linh kiện:"; kéo trên thân robot → ảnh khác nhau nhưng HUD vẫn báo linh kiện đó;
  - kéo thanh trượt → giá trị thanh trượt đổi và ảnh khác nhau;
  - lăn chuột trên khung → `window.scrollY` không đổi;
  - nút "Đặt lại" → thanh trượt về 0.
- Người dùng thử bằng chuột thật và tay thật.
