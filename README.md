# Hand 3D: Điều khiển mô hình 3D bằng cử chỉ tay

Dự án Computer Vision cho người mới: webcam theo dõi bàn tay bằng **MediaPipe**, nhận diện cử chỉ, rồi điều khiển mô hình 3D trong **Ursina**.

```
Webcam → OpenCV → MediaPipe (21 điểm khớp tay) → Nhận diện cử chỉ → Lọc rung → Mô hình 3D
```

## Cài đặt

Cần **Python 3.10–3.12** (khuyên dùng 3.11).

```bash
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

Lần chạy đầu tiên sẽ tự tải file mô hình `hand_landmarker.task` (~8 MB).

> Không cần cài thêm `opencv-python`: `mediapipe` đã kéo theo `opencv-contrib-python`, cài cả hai sẽ bị xung đột.

## Chạy theo từng bước

| Bước | Lệnh | Bạn sẽ thấy |
|---|---|---|
| 1 | `python step1_webcam.py` | Webcam soi gương + FPS |
| 2 | `python step2_hands.py` | 21 điểm khớp tay kèm số thứ tự, nhãn Left/Right |
| 3 | `python step3_gestures.py` | Chữ PINCH / FIST / OPEN + tỉ lệ chụm để tự chỉnh ngưỡng |
| 4 | `python main.py` | Điều khiển khối lập phương 3D bằng tay |
| 5 | `python main.py ten_model` | Điều khiển model của bạn (đặt file vào `models/`) |

Kiểm tra logic cử chỉ (không cần webcam): `python gestures.py` → `gestures OK`

### Cử chỉ trong `main.py`

| Cử chỉ | Hành động |
|---|---|
| Chụm ngón cái + ngón trỏ, di tay | Xoay mô hình |
| Chụm cả 2 tay, kéo xa/gần | Phóng to / thu nhỏ |
| Nắm tay | Đặt lại |
| Xoè tay | Thả, mô hình đứng yên |
| ESC | Thoát |

### Dùng model 3D của bạn

Tải file `.obj` / `.glb` miễn phí (Sketchfab, Kenney.nl, Poly Haven) vào `models/`, ví dụ `models/robot.glb`, rồi chạy `python main.py robot`. Model sẽ tự được đưa về giữa màn hình và co giãn cho vừa.

## Bản web

Chạy trên trình duyệt, không cần Python: Next.js + MediaPipe Tasks Vision + Three.js, mã nguồn trong `web/`.

- Online: (link Vercel — cập nhật sau Task 9)
- Chạy local (cần Node 22+):

```bash
cd web
npm install
npm run dev        # mở http://localhost:3000
npm test           # kiểm tra logic cử chỉ
```

Kéo thả file `.glb` vào trang `/play` để dùng model của bạn.

## Cấu trúc

```
tracker.py          Webcam + MediaPipe Hand Landmarker (dùng chung)
gestures.py         Luật nhận diện cử chỉ + bộ lọc rung Smooth
step1..3_*.py       Bài học theo từng bước
main.py             Bản hoàn chỉnh: tay → 3D
models/             Đặt file model 3D ở đây
web/                Bản web (Next.js): lib/ là logic thuần + test, components/ là giao diện
```

## Các thông số cần tự chỉnh

Mỗi webcam, mỗi bàn tay và mỗi điều kiện ánh sáng một khác, nên hãy chỉnh các giá trị sau:

- `PINCH_THRESHOLD` (`gestures.py`): xem giá trị `pinch=` ở bước 3 để chọn ngưỡng.
- `Smooth(alpha)`: nhỏ thì mượt hơn nhưng trễ hơn.
- `ROT_SENS` (`main.py`): độ nhạy khi xoay; đổi dấu nếu thấy xoay ngược chiều.

## Lỗi thường gặp

| Triệu chứng | Cách xử lý |
|---|---|
| `pip install mediapipe` lỗi | Dùng Python 3.10–3.12 |
| Không đọc được camera / chọn nhầm webcam (vd. camera ảo Snap, OBS) | Đổi `CAMERA` trong `tracker.py` sang 0, 1, 2... |
| Không phát hiện được tay | Thêm ánh sáng, chọn nền đơn giản |
| Model 3D bị giật | Giảm `alpha` của `Smooth` |
| Chạy chậm | `HandTracker(num_hands=1)` hoặc giảm độ phân giải |

## Lộ trình tiếp theo

- [ ] Thay luật cử chỉ bằng mô hình tự huấn luyện: thu landmark vào CSV, huấn luyện bằng `scikit-learn`
- [ ] One Euro Filter thay cho EMA
- [ ] Dùng trục `z` để đẩy/kéo mô hình theo chiều sâu
- [ ] Tách camera ra thread riêng để tăng FPS
- [x] Phiên bản web: MediaPipe JS + Three.js (xem mục "Bản web")
