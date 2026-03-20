import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShiftFlow — ระบบจัดตารางงานพนักงาน",
  description: "ระบบจัดตารางงานพนักงานพาร์ทไทม์ร้านอาหาร ครบครันทั้งจัดการกะ สุ่มตาราง และแชร์ให้พนักงานดู",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
