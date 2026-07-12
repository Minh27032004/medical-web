import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AssistantWidget from "@/components/AssistantWidget";
import AppShell from "@/components/AppShell";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: "Quản lý phòng khám",
  description: "Hệ thống quản lý phòng khám nội bộ dành cho bác sĩ",
  robots: { index: false, follow: false }, // hệ nội bộ — không cho index
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${inter.variable} h-full antialiased`}>
      <body className="h-full bg-gray-50 text-gray-900">
        <AppShell>{children}</AppShell>
        <AssistantWidget />
      </body>
    </html>
  );
}
