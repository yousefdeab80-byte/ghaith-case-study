import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "غيث | نظام إدارة قطاع دراسة الحالة",
  description: "إدارة حالات قطاع دراسة الحالة بمؤسسة غيث للتنمية المجتمعية",
  icons: { icon: "/logo.svg" },
};
export const viewport: Viewport = { themeColor: "#1F4738" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
