import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AssistantWidget from "@/components/AssistantWidget";
import Header from "@/components/Header";

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
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">
        <Header />
        <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">{children}</main>
        <AssistantWidget />
      </body>
    </html>
  );
}
