"use client";
import dynamic from "next/dynamic";

// localStorage, canvas và WebGL chỉ có trên trình duyệt
const Creator = dynamic(() => import("@/components/Creator"), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-muted">Đang tải…</p>,
});

export default function CreatePage() {
  return <Creator />;
}
