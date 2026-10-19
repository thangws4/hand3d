import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin", "vietnamese"], variable: "--font-space-grotesk" });
const mono = JetBrains_Mono({ subsets: ["latin", "vietnamese"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: { default: "Hand 3D", template: "%s · Hand 3D" },
  description: "Điều khiển mô hình 3D bằng cử chỉ tay ngay trên trình duyệt.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${display.variable} ${mono.variable}`}>
      <body className="min-h-dvh font-display antialiased">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
