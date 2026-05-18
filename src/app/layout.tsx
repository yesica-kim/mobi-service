import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "모비모비 - 마비노기 숙제 트래커",
  description: "마비노기 일일/주간 숙제를 캐릭터별로 관리하세요",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-slate-950 antialiased">{children}</body>
    </html>
  );
}
