"""Nhận diện cử chỉ từ 21 landmark của MediaPipe bằng luật hình học."""
import math

WRIST, THUMB_TIP, INDEX_MCP, INDEX_TIP, MIDDLE_MCP = 0, 4, 5, 8, 9
# (đầu ngón, khớp giữa PIP) của ngón trỏ, giữa, áp út, út
FINGERS = [(8, 6), (12, 10), (16, 14), (20, 18)]

PINCH_THRESHOLD = 0.3     # chỉnh theo tay và camera của bạn
THUMB_UP_THRESHOLD = 0.5  # chỉnh theo tay và camera; xem giá trị thumb= ở bước 3


def dist(a, b):
    return math.hypot(a.x - b.x, a.y - b.y)


def hand_size(lm):
    """Cổ tay -> gốc ngón giữa; dùng để chuẩn hoá, không phụ thuộc tay xa/gần camera."""
    return dist(lm[WRIST], lm[MIDDLE_MCP]) or 1e-6


def is_pinch(lm):
    return dist(lm[THUMB_TIP], lm[INDEX_TIP]) / hand_size(lm) < PINCH_THRESHOLD


def fingers_up(lm):
    """Ngón nào đang duỗi: [trỏ, giữa, áp út, út] (không tính ngón cái). Ảnh có y tăng dần xuống dưới."""
    return [lm[tip].y < lm[pip].y for tip, pip in FINGERS]


def thumb_lift(lm):
    """Đầu ngón cái cao hơn gốc ngón trỏ bao nhiêu (chuẩn hoá theo cỡ tay)."""
    return (lm[INDEX_MCP].y - lm[THUMB_TIP].y) / hand_size(lm)


def classify(lm):
    if is_pinch(lm):
        return "PINCH"
    up = fingers_up(lm)
    if up == [True, False, False, False]:
        return "POINT"
    if up == [True, True, False, False]:
        return "PEACE"
    if not any(up):
        return "THUMBS_UP" if thumb_lift(lm) > THUMB_UP_THRESHOLD else "FIST"
    return "OPEN"


class Smooth:
    """Lọc rung bằng trung bình mũ (EMA). alpha nhỏ = mượt hơn nhưng trễ hơn."""

    def __init__(self, alpha=0.3):
        self.alpha, self.value = alpha, None

    def __call__(self, x):
        self.value = x if self.value is None else self.alpha * x + (1 - self.alpha) * self.value
        return self.value


if __name__ == "__main__":
    from types import SimpleNamespace as P

    def hand(tips_y, thumb=(0.5, 0.5), index=(0.5, 0.2)):
        lm = [P(x=0.5, y=0.5) for _ in range(21)]
        lm[WRIST], lm[MIDDLE_MCP] = P(x=0.5, y=0.9), P(x=0.5, y=0.6)
        for (tip, pip), y in zip(FINGERS, tips_y):
            lm[pip], lm[tip] = P(x=0.5, y=0.5), P(x=0.5, y=y)
        lm[THUMB_TIP], lm[INDEX_TIP] = P(x=thumb[0], y=thumb[1]), P(x=index[0], y=index[1])
        return lm

    assert classify(hand([0.2] * 4, thumb=(0.2, 0.5))) == "OPEN"
    assert classify(hand([0.7] * 4, thumb=(0.2, 0.5), index=(0.5, 0.7))) == "FIST"
    assert classify(hand([0.2] * 4, thumb=(0.5, 0.22))) == "PINCH"
    assert classify(hand([0.2, 0.7, 0.7, 0.7], thumb=(0.2, 0.5))) == "POINT"
    assert classify(hand([0.2, 0.2, 0.7, 0.7], thumb=(0.2, 0.5))) == "PEACE"
    assert classify(hand([0.7] * 4, thumb=(0.5, 0.1), index=(0.5, 0.7))) == "THUMBS_UP"
    s = Smooth(0.5)
    assert s(0) == 0 and s(10) == 5
    print("gestures OK")
