import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Teaching Automation",
  description: "Monthly resident teaching schedule automation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body className="bg-gray-50 text-gray-900 min-h-screen">{children}</body>
    </html>
  );
}
