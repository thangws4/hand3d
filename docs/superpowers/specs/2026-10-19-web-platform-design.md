# Spec 1: Nền tảng web hand3d (Next.js)

Ngày: 2026-10-19 · Trạng thái: chờ duyệt · Spec tiếp theo: `2026-10-19-image-to-3d-design.md`

## Mục tiêu

Đưa ứng dụng "điều khiển mô hình 3D bằng cử chỉ tay" (hiện là Python: MediaPipe + Ursina) lên trình duyệt, để người khác chỉ cần mở link và cho phép camera là chơi được, không cài gì.

**Người dùng nói:** chạy trên trình duyệt; chia sẻ link cho người khác chơi; dùng Next.js vì sẽ mở rộng nhiều trang; deploy Vercel, giữ repo private.

**Giả định (đã trình bày, chưa bị phản đối):** bản web giữ đúng hành vi bản Python (cùng cử chỉ, ngưỡng, độ nhạy); giao diện tối kiểu HUD công nghệ.

**Thành công khi:**
1. Mở link Vercel trên Chrome desktop có webcam → bấm "Bật camera" → thấy tay được nhận diện và điều khiển được khối 3D bằng cả 6 cử chỉ + zoom 2 tay.
2. Kéo thả một file `.glb` → model thay khối lập phương, tự căn giữa và vừa khung.
3. `npm test` (= `node --test "lib/**/*.test.ts"` trong `web/`) qua; `npm run build` qua.
4. Chạy local được bằng `npm run dev`.

## Ngoài phạm vi

- Tạo 3D từ ảnh (spec 2), trang hướng dẫn từng bước, gallery model.
- Hỗ trợ mobile (có thể chạy, nhưng không tối ưu/kiểm thử).
- Đổi bản Python: giữ nguyên, hai bản sống song song.

## Kiến trúc

Next.js (App Router, TypeScript, Tailwind) trong `web/`; phần Python ở gốc repo không đổi.

```
web/
  app/layout.tsx            Khung chung: header điều hướng (/, /play), font, theme tối
  app/page.tsx              Trang giới thiệu: mô tả, bảng cử chỉ, nút "Chơi ngay" → /play
  app/play/page.tsx         Trang ứng dụng; nạp <Player> bằng next/dynamic với ssr:false
  components/Player.tsx     Ghép useHandTracker + controller + Scene + CameraPreview + HUD
  components/Scene.tsx      React Three Fiber: Canvas, đèn, model (cube | glb); nhận transform từ controller
  components/CameraPreview.tsx  <video> lật gương + <canvas> vẽ khung xương 21 điểm
  lib/gestures.ts           Port 1:1 gestures.py: dist, handSize, isPinch, fingersUp, thumbLift, classify, Smooth
  lib/gestures.test.ts      node:test — cùng các ca như khối __main__ của gestures.py
  lib/controller.ts         Port logic update() của main.py: (hands, state, dt) → transform mới; thuần, không phụ thuộc React/three
  lib/controller.test.ts    node:test cho controller
  lib/useHandTracker.ts     Hook: getUserMedia + HandLandmarker (VIDEO mode) → hands mỗi khung (requestAnimationFrame)
  lib/modelStore.ts         Biến module giữ model hiện tại (Blob/URL) dùng chung giữa các trang (spec 2 dùng)
```

Thư viện: `next`, `react`, `three`, `@react-three/fiber`, `@react-three/drei`, `@mediapipe/tasks-vision`. File WASM MediaPipe lấy từ CDN jsdelivr theo đúng phiên bản đã cài; file `hand_landmarker.task` lấy từ URL Google như `tracker.py`.

### Ranh giới đơn vị

- `gestures.ts`, `controller.ts`: hàm thuần, nhận landmark `{x,y,z}[]`, test được bằng Node không cần trình duyệt.
- `useHandTracker`: chỉ lo camera + MediaPipe, trả `{hands: {landmarks, side}[], status, error}`. Không biết gì về 3D.
- `Scene`: chỉ vẽ; nhận `{rotation, position, scale, modelUrl}`.
- `Player`: nối các phần trên trong vòng `useFrame`.

## Luồng dữ liệu

```
camera → <video> → HandLandmarker.detectForVideo (mỗi rAF)
  → lật gương: x' = 1 − x, đổi nhãn Left↔Right   (bản Python lật frame trước khi nhận diện; kết quả tương đương)
  → classify từng tay → controller.step(hands, gestures, state, dt) → transform
  → Scene (three) + HUD ("Left: PINCH | Right: OPEN")
```

### Hành vi controller (giống `main.py`)

| Điều kiện (ưu tiên trên xuống) | Hành động |
|---|---|
| Có tay FIST | Đặt lại rotation, position, scale |
| 2 tay PINCH | Zoom theo tỉ lệ khoảng cách 2 đầu ngón trỏ so với lúc bắt đầu |
| Còn lại: có THUMBS_UP | rotation_y += SPIN_SPEED·dt |
| Còn lại: tay đầu tiên có PINCH/POINT/PEACE | Kéo theo đầu ngón trỏ (lọc EMA, xoá lịch sử khi đổi cử chỉ): PINCH xoay, POINT dịch, PEACE zoom theo dy |
| Không có tay kéo | Thả, model đứng yên |

Hằng số giữ nguyên giá trị Python: `PINCH_THRESHOLD=0.3`, `THUMB_UP_THRESHOLD=0.5`, `ROT_SENS=300`, `PAN_SENS=20`, `ZOOM_SENS=3`, `SPIN_SPEED=90`, `ZOOM_MIN/MAX=0.2/5`, `FIT_SIZE=4`, `Smooth alpha=0.3`. Hệ đơn vị three.js khác Ursina nên `PAN_SENS` và hướng trục có thể cần chỉnh khi thử thật; ghi rõ trong code.

## Trang `/play`

- Trạng thái ban đầu: nút **"Bật camera"** + bảng cử chỉ thu gọn. Chưa xin quyền camera trước khi người dùng bấm.
- Sau khi cấp quyền: menu chọn camera (`enumerateDevices`; nhớ lựa chọn bằng localStorage), ô camera góc dưới, HUD góc trên.
- Kéo thả `.glb`/`.gltf` lên trang (hoặc nút "Mở model") → thay model; nếu `modelStore` có model (từ spec 2) thì dùng nó khi vào trang.

## Xử lý lỗi

| Tình huống | Hiển thị |
|---|---|
| Từ chối quyền camera (`NotAllowedError`) | Hướng dẫn bật lại quyền trong thanh địa chỉ |
| Không có camera / camera bận (`NotFoundError`, `NotReadableError`) | Thông báo + gợi ý chọn camera khác / đóng app khác đang dùng |
| Tải MediaPipe WASM/model lỗi | Thông báo + nút "Thử lại" |
| File kéo thả không phải glb/gltf | Toast lỗi, giữ model đang hiển thị |
| File glb/gltf hỏng | Toast lỗi, quay về khối lập phương |
| Không phải secure context (http không phải localhost) | Thông báo cần https |

## Kiểm thử

- `npm test` trong `web/` (= `node --test "lib/**/*.test.ts"`; Node 22 không nhận dạng đường dẫn thư mục): `gestures.test.ts` (6 cử chỉ, Smooth) và `controller.test.ts` (FIST reset, zoom 2 tay, PINCH xoay, POINT dịch, PEACE zoom, đổi cử chỉ không giật).
- Hook PostToolUse trong `.claude/settings.json` chạy thêm lệnh test trên (không cần `node_modules`).
- `npm run build` + `npm run lint`.
- Kiểm tra thủ công: chạy `npm run dev`, mở Chrome, xem console không lỗi, ảnh chụp màn hình; cử chỉ thật do người dùng thử.

## Triển khai

- Vercel project, Root Directory = `web`, nối GitHub repo private `thangws4/hand3d` → mỗi push `main` tự deploy. Người dùng đăng nhập Vercel một lần.
- `.gitignore` thêm `web/node_modules`, `web/.next`.
- README: thêm mục "Bản web" (link Vercel + chạy local). `CLAUDE.md`: thêm lệnh web.
