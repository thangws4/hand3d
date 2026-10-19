# Spec 3: Tách mô hình 3D thành linh kiện

Ngày: 2026-10-20 · Trạng thái: chờ duyệt · Phụ thuộc: spec 1 (`/play`), spec 2 (đã merge)

## Mục tiêu

Trong `/play`, người dùng bung một mô hình thành các linh kiện (exploded view) và cầm từng linh kiện ra bằng cử chỉ tay, rồi ráp lại.

**Người dùng nói:** muốn mô hình 3D tách được thành linh kiện; chọn **cả hai** — bung toàn bộ và cầm từng linh kiện; linh kiện lấy từ **mesh có sẵn trong file .glb + một model mẫu dựng sẵn**; đồng ý robot mẫu làm model mặc định.

**Thành công khi:**
1. Mở `/play`: thấy robot mẫu (~8 linh kiện có tên tiếng Việt) thay cho khối lập phương.
2. Xoè 2 tay kéo xa → các linh kiện bung ra khỏi tâm; kéo lại gần → ráp lại.
3. Đưa đầu ngón trỏ lên một linh kiện → linh kiện sáng lên, HUD hiện tên; chụm → linh kiện đi theo tay; thả → nằm yên tại chỗ.
4. Chụm ở chỗ trống vẫn xoay cả model như cũ; nắm tay → mọi thứ về ban đầu (kể cả ráp linh kiện).
5. Thả file .glb nhiều mesh → mỗi mesh là một linh kiện; .glb một mesh → ghi "liền một khối, không tách được linh kiện", mọi chức năng cũ vẫn chạy.

## Ngoài phạm vi

- Bản Python (Ursina).
- AI tách bộ phận, tách theo hình học (mảnh rời) cho model liền khối.
- Phân cấp linh kiện (nhóm trong nhóm): chỉ lấy từng mesh lá; `SkinnedMesh` (model có xương/animation) coi như một linh kiện bình thường, không xử lý riêng.
- Va chạm/vật lý giữa linh kiện, lưu vị trí linh kiện sau khi tải lại trang.

## Cử chỉ

Không thêm chế độ; 6 cử chỉ cũ giữ nguyên ý nghĩa, chỉ thêm hành vi ở chỗ trước đây không làm gì hoặc theo ngữ cảnh con trỏ.

| Ưu tiên | Điều kiện | Hành động |
|---|---|---|
| 1 | Có tay FIST | Đặt lại tất cả: góc, vị trí, zoom, **độ bung = 0, linh kiện về chỗ cũ**, thả linh kiện đang cầm |
| 2 | 2 tay PINCH | Zoom 2 tay (như cũ) |
| 3 | **2 tay OPEN** | **Độ bung** = kẹp(độ bung lúc bắt đầu + (khoảng cách 2 lòng bàn tay — landmark 9 — − khoảng cách lúc bắt đầu) × `EXPLODE_SENS`, 0, `EXPLODE_MAX`) |
| 4 | THUMBS_UP | Tự quay (như cũ) |
| 5 | Tay kéo đầu tiên là PINCH và **lúc bắt đầu chụm** con trỏ nằm trên linh kiện | **Cầm linh kiện**: linh kiện dịch theo đầu ngón trỏ trên mặt phẳng màn hình (`PAN_SENS`), model không xoay |
| 6 | Tay kéo đầu tiên là PINCH/POINT/PEACE (còn lại) | Như cũ: xoay / kéo model / zoom 1 tay |
| — | Đổi cử chỉ, mất tay | Thả linh kiện đang cầm, nó nằm yên ở vị trí mới |

- **Con trỏ** = vị trí đầu ngón trỏ (landmark 8) của tay đầu tiên, đã lật gương, quy về toạ độ màn hình của khung 3D. Hiển thị một vòng tròn nhỏ; linh kiện dưới con trỏ (raycast) sáng lên (emissive) và HUD ghi `Linh kiện: <tên>`.
- Hằng số mới: `EXPLODE_SENS = 3`, `EXPLODE_MAX = 1.5` (chỉnh khi thử tay thật).

## Model

- **Robot mẫu** (`lib/demoModel.ts`): ~8 khối cơ bản (đầu, mắt trái, mắt phải, ăng-ten, thân, tay trái, tay phải, chân trái, chân phải), mỗi khối có tên tiếng Việt, hình (hộp/trụ/cầu), kích thước, vị trí, màu. Là model mặc định của `/play` (thay khối lập phương). Khối lập phương bị bỏ.
- **File .glb**: duyệt cây scene, mỗi `Mesh` là một linh kiện; tên = `mesh.name` hoặc `Linh kiện N`. Một mesh → `parts.length ≤ 1` → bung/cầm không có tác dụng, HUD thêm "(liền một khối, không tách được linh kiện)".
- Model do `/create` tạo (thường một mesh) rơi vào trường hợp trên.

## Kiến trúc

```
web/lib/parts.ts        Thuần: explodeOffset(partCenter, modelCenter, amount) → vector; tổng hợp offset bung + offset cầm
web/lib/demoModel.ts    Dữ liệu robot mẫu (mảng linh kiện)
web/lib/controller.ts   Mở rộng: Transform thêm explode, partOffsets (id → {x,y}), grabbed (id|null), cursor ({x,y}|null);
                        step(hands, dt, hitTest?) — hitTest(x,y) → id|null do Scene cung cấp (raycast), mặc định luôn null
web/components/Scene.tsx  Tách model thành linh kiện (demo hoặc glb), áp vị trí bung + cầm cho từng linh kiện,
                          cung cấp hitTest, làm sáng linh kiện dưới con trỏ
web/components/Player.tsx HUD tên linh kiện / ghi chú liền khối, vòng tròn con trỏ
```

- Controller vẫn thuần (không phụ thuộc three/React): việc "con trỏ trúng linh kiện nào" được tiêm vào qua `hitTest`, nên test bằng Node với hàm giả.
- Offset cầm lưu theo **mặt phẳng màn hình** (đơn vị world, như `PAN_SENS`); Scene quy đổi sang hệ toạ độ của model (nghịch đảo phép xoay + chia zoom) trước khi cộng vào vị trí linh kiện, để kéo sang phải luôn là sang phải dù model đang xoay.
- Offset bung tính trong hệ toạ độ model: `(tâm linh kiện − tâm model) × độ bung`.

## Xử lý lỗi / trường hợp biên

- Model một mesh: như mục Model; không lỗi.
- Linh kiện nằm đúng tâm model: offset bung = 0 (đứng yên khi bung) — chấp nhận.
- Đang cầm thì tay ra khỏi khung: thả linh kiện (giống "tay biến mất" hiện có), không nhảy.
- Đổi model (thả glb mới / model từ `/create`): reset toàn bộ trạng thái linh kiện.

## Kiểm thử

- `npm test`:
  - `parts.test.ts`: offset bung tỉ lệ với khoảng cách tới tâm và độ bung; linh kiện ở tâm → 0; cộng offset cầm.
  - `controller.test.ts` (thêm): 2 tay OPEN kéo xa/gần → độ bung tăng/giảm, bị kẹp [0, EXPLODE_MAX]; PINCH bắt đầu trên linh kiện → cầm, partOffsets đổi, rotY không đổi; PINCH ở chỗ trống → xoay như cũ; FIST → explode 0, partOffsets rỗng, grabbed null; đang cầm mất tay → grabbed null, offset giữ nguyên; cursor = vị trí ngón trỏ tay đầu tiên.
  - `demoModel`: ≥ 6 linh kiện, tên không trùng.
- e2e (playwright, camera giả): `/play` hiển thị robot; HUD có tên model mẫu; thả .glb một mesh → ghi chú "liền một khối".
- Người dùng thử cử chỉ thật: bung/ráp, cầm linh kiện, nắm tay đặt lại.
