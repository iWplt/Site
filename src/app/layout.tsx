import type { Metadata, Viewport } from "next";
import { Noto_Kufi_Arabic } from "next/font/google";
import "./globals.css";

const warkaFont = Noto_Kufi_Arabic({
  subsets: ["arabic"],
  variable: "--font-warka",
  display: "swap"
});

export const metadata: Metadata = {
  title: {
    default: "WARKA | نظام إدارة الحجوزات",
    template: "%s | WARKA"
  },
  description:
    "نظام WARKA لإدارة حجوزات ملابس التخرج والدفعات والطلبات والرموز الخاصة بالطلاب."
};

export const viewport: Viewport = {
  themeColor: "#3f472d",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={warkaFont.variable}>
      <body>{children}</body>
    </html>
  );
}
