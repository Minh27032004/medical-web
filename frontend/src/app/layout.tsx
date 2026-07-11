import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const inter = Inter({
  variable: "--font-geist-sans", // giữ tên biến để khớp globals.css của scaffold
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: "Phòng khám gia đình",
  description: "Đặt lịch khám, mua thuốc và tư vấn sức khỏe",
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
        <Footer />
      </body>
    </html>
  );
}
