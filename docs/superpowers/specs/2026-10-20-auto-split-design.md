# Spec 4: Tự tách mảnh rời thành linh kiện

Ngày: 2026-10-20 · Trạng thái: chờ duyệt · Phụ thuộc: spec 3 (tách linh kiện, đã merge)

## Mục tiêu

Model .glb mà nhiều mảnh rời bị gộp vào ít mesh (vd. model Sketchfab chuyển từ FBX) vẫn bung/cầm được theo từng cụm mảnh, không cần Blender.

**Người dùng nói:** muốn file 3D kiểu Gundam bung được linh kiện; với file `msz-006_zeta_gundam.glb` chọn phương án "app tự tách mảnh rời".

**Dữ liệu thật (file Zeta, Sketchfab):** 2 mesh (`Object_4`, `Object_5` — chia theo giới hạn 65.535 đỉnh, không theo bộ phận), 1 material có texture, không skin/animation; bên trong 963 mảnh rời (582 + 381); 150 mảnh có đường chéo bbox ≥ 10% model; giữ 80 mảnh lớn nhất ⇒ mảnh nhỏ nhất được giữ ≈ 14% đường chéo model.

**Thành công khi:**
1. Thả file Zeta vào `/play` → HUD báo khoảng 2 < N ≤ 80 linh kiện (không phải 2); bung ra thấy từng cụm giáp tách khỏi thân; model trông như cũ khi chưa bung (texture/màu giữ nguyên).
2. Robot mẫu (9 mesh) và model đã chia object sẵn: không đổi so với hiện tại.
3. Model một mảnh liền (vd. tạo từ ảnh): vẫn "liền một khối".
4. Đổi/gỡ model rồi thả lại cùng file: không lỗi, không nhân đôi mesh.

## Ngoài phạm vi

Tên theo ngữ nghĩa ("Tay trái"), tách bằng AI, nút bật/tắt tự tách, chạy trong Web Worker (chỉ làm nếu đo thấy chậm), model có skin.

## Quy tắc

- **Khi nào tách:** model có ≤ `AUTO_SPLIT_MAX_MESHES = 4` mesh; mỗi mesh có chỉ số tam giác được xét riêng; chỉ thay mesh khi nó ra ≥ 2 nhóm.
- **Mảnh rời:** gộp đỉnh trùng vị trí (lượng tử hoá theo 1e-5 × độ lớn toạ độ lớn nhất) rồi tìm thành phần liên thông theo tam giác.
- **Gộp mảnh nhỏ:** giữ tối đa `MAX_AUTO_PARTS = 80` mảnh có đường chéo bbox lớn nhất; mỗi mảnh còn lại gộp vào mảnh được giữ có **khoảng cách từ tâm mảnh nhỏ tới bbox mảnh lớn** nhỏ nhất. Giới hạn tính trên từng mesh.
- **Tên:** "Mảnh 1…N" theo kích thước giảm dần (đánh số liên tục qua các mesh của model).

## Kiến trúc

```
web/lib/looseParts.ts   Thuần (không three): groupTriangles(positions: Float32Array, index: Uint32Array|Uint16Array, maxParts)
                        → { groupOfTriangle: Int32Array; groupCount: number } — nhóm 0 là lớn nhất
web/lib/splitMesh.ts    three, không React: splitMesh(mesh, maxParts) → Mesh[] (rỗng nếu < 2 nhóm);
                        mỗi mesh mới: BufferGeometry chỉ chứa đỉnh của nhóm (chép mọi attribute), cùng material, cùng transform với mesh gốc
web/components/Scene.tsx  collectParts: nếu số mesh ≤ 4 → với mỗi mesh tách được: ẩn mesh gốc (visible=false), thêm các mesh mới làm anh em (cùng parent);
                          makeParts chỉ lấy mesh đang hiện; cleanup: gỡ mesh mới (dispose geometry), hiện lại mesh gốc
```

`makeParts` (spec 3) bỏ qua mesh `visible === false` để mesh gốc bị ẩn không thành linh kiện.

## Kiểm thử

- `looseParts.test.ts`: 2 tam giác rời → 2 nhóm; 2 tam giác chung cạnh nhưng đỉnh nhân đôi (đường nối UV) → 1 nhóm; mảnh nhỏ cạnh mảnh lớn A gộp vào A chứ không vào B ở xa; > maxParts mảnh → đúng maxParts nhóm, giữ các mảnh lớn nhất; nhóm 0 là lớn nhất.
- `splitMesh.test.ts` (Node + three): tổng số tam giác các mesh mới = mesh gốc; mỗi mesh mới có đủ attribute của gốc; vị trí world của đỉnh không đổi; mesh 1 mảnh → [].
- `placeParts.test.ts` thêm: mesh `visible=false` không thành linh kiện.
- e2e: glTF tự dựng 1 mesh gồm 2 tam giác rời → `data-parts` = 2; glTF 1 tam giác → vẫn "liền một khối".
- Thủ công (máy local, không commit file Zeta): số linh kiện, thời gian tách (log `performance.now()` tạm), ảnh chụp khi ép bung tạm thời.
