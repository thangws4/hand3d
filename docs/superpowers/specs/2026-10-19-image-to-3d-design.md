# Spec 2: Tạo mô hình 3D từ ảnh

Ngày: 2026-10-19 · Trạng thái: chờ duyệt · Phụ thuộc: `2026-10-19-web-platform-design.md` (spec 1 phải xong trước)

## Mục tiêu

Người dùng tải một ảnh vật thể lên trang web, nhận về mô hình 3D `.glb`, rồi điều khiển nó bằng cử chỉ tay trong `/play`.

**Người dùng nói:** thêm chức năng nhập ảnh để tạo mô hình 3D; chọn dùng Hugging Face Space miễn phí (chấp nhận chậm/không ổn định).

**Ràng buộc:** máy dev không có GPU NVIDIA (Intel Iris Xe) → không tự chạy model; không trả phí API.

**Thành công khi:**
1. Trên `/create`, tải một ảnh vật thể rõ nền → trong vài phút nhận được `.glb` có texture, xem trước xoay được.
2. "Tải .glb" lưu được file; "Điều khiển bằng tay →" mở `/play` với model đó.
3. Khi Space lỗi/hết hạn mức, người dùng thấy thông báo rõ ràng, trang không treo.

## Ngoài phạm vi

- API trả phí (fal.ai/Meshy/Tripo), server proxy, HF token, đăng nhập.
- Lưu lịch sử model, gallery, nhiều ảnh/multi-view, chỉnh tham số nâng cao (seed, độ phân giải texture).

## Lựa chọn Space

`microsoft/TRELLIS.2` (Space chính thức, ZeroGPU, trạng thái RUNNING ngày 2026-10-19). API Gradio đã kiểm tra:

```
/start_session()
/preprocess_image(input: image)          -> ảnh đã tách nền
/image_to_3d(image, ...)                 -> (lưu trạng thái trong session)
/extract_glb(decimation_target, texture_size) -> (filepath, filepath)  # .glb
```

Các endpoint dùng chung một session nên phải gọi tuần tự trên cùng một client. Tham số đầy đủ của `image_to_3d` sẽ đọc bằng `client.view_api()` ở bước spike, không đoán.

Dự phòng (chỉ cần đổi hằng số + hàm adapter): `trellis-community/TRELLIS`, `stabilityai/stable-fast-3d` (đều RUNNING ngày 2026-10-19).

## Kiến trúc

Gọi trực tiếp từ trình duyệt bằng `@gradio/client` (không qua server Next.js):
- Một lần tạo có thể mất 1–3 phút, dễ vượt giới hạn thời gian của hàm serverless.
- Mỗi người dùng tiêu hạn mức ZeroGPU của chính mình; không có secret cần giấu.

```
web/app/create/page.tsx        Trang: chọn ảnh → tạo → xem trước → tải / sang /play
web/lib/imageTo3d.ts           Adapter Space: generate(file, onStatus, signal) → Blob(.glb)
                               SPACE_ID là hằng số; ánh xạ sự kiện status của gradio → {phase, queuePos?}
web/lib/imagePrep.ts           Kiểm tra định dạng + thu nhỏ cạnh dài ≤ 1024px (canvas) → Blob
web/lib/errors.ts              Phân loại lỗi gradio/mạng → mã lỗi + thông điệp tiếng Việt
web/components/ModelPreview.tsx  Xem trước glb (R3F + OrbitControls)
web/lib/modelStore.ts          (từ spec 1) setModel(blob) trước khi chuyển sang /play
```

## Luồng

1. Chọn/kéo thả ảnh (jpg/png/webp, ≤ 10 MB) → `imagePrep` thu nhỏ → hiện ảnh xem trước.
2. "Tạo 3D" → `imageTo3d.generate`: connect → start_session → preprocess_image → image_to_3d → extract_glb → tải file glb về thành Blob.
3. Hiển thị tiến trình theo giai đoạn: Đang kết nối / Đang xếp hàng (vị trí N) / Đang tạo hình / Đang xuất file. Nút "Huỷ" (AbortController).
4. Xong → `ModelPreview` + nút "Tải .glb" (tên file theo tên ảnh) + "Điều khiển bằng tay →" (`modelStore.setModel`, chuyển `/play`).

Ghi chú rõ trên trang: "Ảnh sẽ được gửi tới Hugging Face Space công khai để xử lý."

## Xử lý lỗi

| Mã | Khi nào | Thông điệp gợi ý |
|---|---|---|
| `bad_image` | Sai định dạng / quá lớn / không đọc được | Chọn ảnh jpg/png/webp khác |
| `space_down` | Không kết nối được / Space đang ngủ hoặc build lỗi | Space đang bảo trì, thử lại sau ít phút |
| `quota` | Hết hạn mức ZeroGPU | Hết lượt GPU miễn phí, thử lại sau (hoặc đăng nhập Hugging Face trên trình duyệt) |
| `timeout` | Quá 5 phút không xong | Hàng đợi quá đông, thử lại sau |
| `cancelled` | Người dùng huỷ | (không báo lỗi) |
| `unknown` | Còn lại | Thông điệp gốc + "thử lại" |

Không tự động thử lại (tránh tiêu hạn mức).

## Kiểm thử

- `node --test web/lib`: `imagePrep` (tính kích thước thu nhỏ, từ chối định dạng sai), `errors` (ánh xạ thông điệp gradio mẫu → mã lỗi).
- Spike khi bắt đầu triển khai: script Node gọi Space thật với 1 ảnh mẫu → ghi lại tham số `view_api()`, thời gian, kích thước glb, thông điệp lỗi quota thực tế (dùng để viết `errors.ts`).
- Thủ công: chạy `npm run dev`, tạo 1 model thật, mở trong `/play`.

## Rủi ro

- Space đổi API hoặc ngừng chạy → adapter cô lập trong `imageTo3d.ts`, đổi Space bằng một hằng số + hàm ánh xạ.
- Hạn mức ẩn danh rất thấp → thông báo `quota` rõ ràng; nâng cấp lên HF token/API trả phí là spec riêng nếu cần.
