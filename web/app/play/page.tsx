"use client";
import dynamic from "next/dynamic";

// Camera, MediaPipe và WebGL chỉ chạy trên trình duyệt
const Player = dynamic(() => import("@/components/Player"), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-muted">Đang tải…</p>,
});

export default function PlayPage() {
  return <Player />;
}
