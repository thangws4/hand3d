# Spec 2: Tạo mô hình 3D từ ảnh

Ngày: 2026-10-19 (sửa sau spike cùng ngày) · Trạng thái: chờ duyệt · Phụ thuộc: `2026-10-19-web-platform-design.md` (đã xong, đã merge)

## Mục tiêu

Người dùng tải một ảnh vật thể lên trang web, nhận về mô hình 3D `.glb`, rồi điều khiển nó bằng cử chỉ tay trong `/play`.

**Người dùng nói:** thêm chức năng nhập ảnh để tạo mô hình 3D; chọn dùng Hugging Face Space miễn phí (chấp nhận chậm/không ổn định). Sau spike: chọn để **mỗi người dùng tự dán Hugging Face token của họ**.

**Ràng buộc:** máy dev không có GPU NVIDIA (Intel Iris Xe) → không tự chạy model; không trả phí API; không server proxy.

**Thành công khi:**
1. Trên `/create`, dán HF token (một lần), tải một ảnh vật thể rõ nền → trong vài phút nhận được `.glb` có texture, xem trước xoay được.
2. "Tải .glb" lưu được file; "Điều khiển bằng tay" mở `/play` với model đó.
3. Khi thiếu/sai token, Space lỗi hoặc hết hạn mức, người dùng thấy thông báo rõ ràng kèm cách xử lý, trang không treo.

## Ngoài phạm vi

- API trả phí (fal.ai/Meshy/Tripo), server proxy, token dùng chung của chủ trang, đăng nhập OAuth.
- Lưu lịch sử model, gallery, nhiều ảnh/multi-view, chỉnh tham số nâng cao (seed, độ phân giải).

## Kết quả spike (2026-10-19, `@gradio/client` 2.7.1, Node)

- `Client.connect("microsoft/TRELLIS.2")` ~2.6s; Gradio 6.1.0. `/start_session` và `/preprocess_image` chạy được ẩn danh (~4s).
- `/image_to_3d` **bị chặn khi ẩn danh** ngay lập tức:
  `ZeroGPU quota exceeded` — `You have exceeded your ZeroGPU quota (120s requested vs. 178s left). Try again in 23:59:57. Authenticate with a Hugging Face token for more quota - https://huggingface.co/settings/tokens`
- `trellis-community/TRELLIS` (`/generate_and_extract_glb`) cũng xin 120s và bị chặn y hệt. `VAST-AI/TripoSG` lỗi `ZeroGPU worker error RuntimeError`.
- Hạn mức ẩn danh tính theo IP (giảm từ 178s → 88s sau vài lần gọi thử) → mọi người cùng mạng chia chung, không dùng được.
- **Chưa kiểm chứng** hạn mức của tài khoản HF miễn phí (không có token để thử) → người dùng xác nhận ở bước kiểm thử thủ công.

## Lựa chọn Space

`microsoft/TRELLIS.2`. Schema đã đọc từ `/gradio_api/info`:

```
/start_session()
/preprocess_image(input: Image)                      -> Image (đã tách nền)
/image_to_3d(image: Image, seed=0, resolution='1024' ∈ {'512','1024','1536'}, …12 tham số sampling có mặc định)
                                                     -> Html (preview; trạng thái 3D giữ trong session)
/extract_glb(decimation_target=300000, texture_size=2048) -> (Model3d filepath, Download filepath)
```

Gọi tuần tự trên cùng một client (chung session). Dùng `resolution: "1024"` (mặc định); `extract_glb` với `decimation_target: 100000`, `texture_size: 1024` để file nhẹ cho web.

Dự phòng: `trellis-community/TRELLIS` qua `/generate_and_extract_glb` (một bước) — chỉ cần viết thêm một hàm adapter.

## Kiến trúc

Gọi trực tiếp từ trình duyệt bằng `@gradio/client` với `hf_token` của người dùng (không qua server Next.js): tránh giới hạn thời gian hàm serverless; mỗi người tiêu hạn mức ZeroGPU của tài khoản mình; không có secret phía server.

```
web/app/create/page.tsx          Trang (client): token → chọn ảnh → tạo → xem trước → tải / sang /play
web/components/Creator.tsx       Toàn bộ UI + trạng thái của /create
web/components/ModelPreview.tsx  Xem trước glb (R3F + OrbitControls)
web/lib/hfToken.ts               isValidToken (định dạng hf_…), đọc/ghi/xoá token trong localStorage
web/lib/imagePrep.ts             Kiểm tra định dạng/dung lượng + tính kích thước thu nhỏ cạnh dài ≤ 1024px
web/lib/genErrors.ts             Phân loại lỗi gradio/mạng → mã lỗi + thông điệp tiếng Việt
web/lib/imageTo3d.ts             Adapter Space: generate(image, token, onPhase, signal) → Blob(.glb)
web/lib/model.ts                 (đã có từ spec 1) setModel(blob, name) trước khi chuyển sang /play
```

Header thêm liên kết "Tạo 3D" → `/create`.

## Hugging Face token

- Trang hiển thị hướng dẫn ngắn khi chưa có token: tạo tài khoản miễn phí → https://huggingface.co/settings/tokens → tạo token loại **Read** → dán vào ô.
- Kiểm tra định dạng `hf_` + ≥ 30 ký tự chữ/số trước khi lưu; lưu trong `localStorage` (khoá `hand3d.hfToken`); có nút "Xoá token".
- Token chỉ được gửi tới Hugging Face (qua `@gradio/client`), không gửi tới server Next.js hay nơi nào khác; trang ghi rõ điều này và khuyên dùng token chỉ có quyền Read.
- Ô nhập là `type="password"`, `autocomplete="off"`.

## Luồng

1. Có token hợp lệ → chọn/kéo thả ảnh (jpg/png/webp, ≤ 10 MB) → thu nhỏ cạnh dài ≤ 1024px → hiện ảnh xem trước.
2. "Tạo 3D" → `generate`: connect (với token) → start_session → preprocess_image → image_to_3d → extract_glb → tải glb về thành Blob.
3. Tiến trình theo giai đoạn: Đang kết nối / Đang xếp hàng (vị trí N) / Đang tách nền / Đang tạo hình / Đang xuất file. Nút "Huỷ" (AbortController; huỷ job gradio đang chạy).
4. Xong → `ModelPreview` + "Tải .glb" (tên file theo tên ảnh) + "Điều khiển bằng tay" (`setModel`, chuyển `/play`).

Ghi chú trên trang: "Ảnh sẽ được gửi tới Hugging Face Space công khai `microsoft/TRELLIS.2` để xử lý."

## Xử lý lỗi

| Mã | Khi nào | Thông điệp gợi ý |
|---|---|---|
| `bad_image` | Sai định dạng / > 10 MB / không đọc được | Chọn ảnh jpg/png/webp khác (≤ 10 MB) |
| `bad_token` | Token sai định dạng, bị từ chối (401/403, "Invalid token") | Kiểm tra lại token hoặc tạo token mới |
| `quota` | `ZeroGPU quota exceeded` | Hết lượt GPU miễn phí của tài khoản; thử lại sau `<thời gian trong thông báo gốc>` |
| `space_down` | Không kết nối được / Space ngủ, build lỗi / `ZeroGPU worker error` | Space đang bảo trì hoặc quá tải, thử lại sau ít phút |
| `timeout` | Quá 6 phút chưa xong | Hàng đợi quá đông, thử lại sau |
| `cancelled` | Người dùng huỷ | (không báo lỗi) |
| `unknown` | Còn lại | Thông điệp gốc + "thử lại" |

Không tự động thử lại (tránh tiêu hạn mức).

## Kiểm thử

- `npm test`: `hfToken` (định dạng), `imagePrep` (kích thước thu nhỏ, từ chối sai định dạng/quá lớn), `genErrors` (các thông điệp thật ở mục spike → đúng mã lỗi, trích được "23:59:57"), `imageTo3d` (thứ tự gọi endpoint, ánh xạ status → giai đoạn, huỷ, timeout — với client giả).
- Thủ công (Claude): `/create` không token → hướng dẫn; token sai định dạng → báo lỗi; ảnh hợp lệ + token giả định dạng đúng → nhận `bad_token`/`quota` hiển thị đúng, trang không treo.
- Thủ công (người dùng, vì cần token thật): tạo 1 model thật, tải về, mở trong `/play`.

## Rủi ro

- Hạn mức tài khoản HF miễn phí có thể vẫn quá ít cho 120s/lần → thông báo `quota` rõ ràng kèm thời gian chờ; nâng cấp (HF PRO, API trả phí) là quyết định riêng.
- Space đổi API hoặc ngừng chạy → adapter cô lập trong `imageTo3d.ts`.
- Token trong localStorage đọc được bởi script cùng origin → trang `/create` không tải script bên thứ ba ngoài bundle; khuyên token chỉ quyền Read.
