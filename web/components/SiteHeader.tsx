import Image from "next/image";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-line px-5">
      <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
        {/* ảnh trang trí: chữ "Hand 3D" ngay sau đã là tên liên kết */}
        <Image src="/logo-mark.png" alt="" width={65} height={64} priority className="h-8 w-auto" />
        Hand 3D
      </Link>
      <nav className="flex gap-6 text-sm text-muted">
        <Link href="/" className="hover:text-ink">Giới thiệu</Link>
        <Link href="/create" className="hover:text-ink">Tạo 3D</Link>
        <Link href="/play" className="hover:text-ink">Chơi</Link>
      </nav>
    </header>
  );
}
