import type { Metadata, Viewport } from "next";
import { Noto_Kufi_Arabic, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const warkaFont = Noto_Kufi_Arabic({
  subsets: ["arabic"],
  weight: ["400", "700", "900"],
  variable: "--font-warka",
  display: "swap",
  preload: true,
  fallback: ["Tahoma", "Arial", "sans-serif"],
  adjustFontFallback: true
});

const bookingSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-booking-number",
  display: "swap"
});

export const metadata: Metadata = {
  title: {
    default: "WARKA | نظام إدارة الحجوزات",
    template: "%s | WARKA"
  },
  description:
    "نظام WARKA لإدارة حجوزات ملابس التخرج والدفعات والطلبات والرموز الخاصة بالطلاب.",
  icons: {
    icon: [{ url: "/brand/warka-logo-icon-transparent.png", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", type: "image/png" }]
  }
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
    <html lang="ar" dir="rtl" className={`${warkaFont.variable} ${bookingSerif.variable} ${warkaFont.className}`}>
      <body>{children}</body>
    </html>
  );
}
