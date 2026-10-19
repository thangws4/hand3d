import Link from "next/link";
import { HandFigure } from "@/components/HandFigure";
import { GESTURE_GUIDE } from "@/lib/gestureGuide";

const PIPELINE = [
  ["Webcam", "Ảnh từ camera của bạn, xử lý ngay trên máy"],
  ["MediaPipe", "Tìm 21 điểm khớp trên mỗi bàn tay"],
  ["Cử chỉ", "Khoảng cách giữa các điểm cho biết bạn đang chụm, chỉ hay nắm tay"],
  ["Mô hình 3D", "Cử chỉ được đổi thành xoay, kéo và phóng to"],
];

export default function Home() {
  return (
    <main>
      <section className="hud-grid border-b border-line">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-[1.1fr_1fr] md:py-24">
          <div>
            <h1 className="max-w-xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Điều khiển mô hình 3D bằng chính bàn tay bạn
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
              Không chuột, không cài đặt. Bật camera, chụm hai ngón tay để xoay, chỉ tay để kéo, giơ chữ V để phóng to.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href="/play" className="bg-accent px-7 py-3 font-semibold text-bg transition hover:brightness-110">
                Chơi ngay
              </Link>
              <span className="text-sm text-muted">Cần webcam và Chrome, Edge hoặc Firefox bản mới.</span>
            </div>
          </div>
          <HandFigure className="mx-auto w-full max-w-sm text-ink md:max-w-md" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-2xl font-semibold tracking-tight">Cách hoạt động</h2>
        <ol className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {PIPELINE.map(([title, desc], i) => (
            <li key={title} className="border-t border-line pt-4">
              <span className="font-mono text-sm text-accent">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-2 text-lg font-medium">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{desc}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-line bg-panel/60">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">Sáu cử chỉ</h2>
          <dl className="mt-8 grid gap-x-12 sm:grid-cols-2">
            {GESTURE_GUIDE.map((g) => (
              <div key={g.gesture} className="flex items-baseline gap-4 border-b border-line py-4">
                <dt className="flex w-52 shrink-0 items-baseline gap-4 font-medium">
                  <span aria-hidden className="w-16 shrink-0 whitespace-nowrap text-2xl">{g.emoji}</span>
                  {g.action}
                </dt>
                <dd className="text-sm text-muted">{g.how}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </main>
  );
}
