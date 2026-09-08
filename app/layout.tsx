import type { Metadata } from "next";
import './globals.css';

export const metadata: Metadata = {
  title: "LanTrainer — 每日外语口语练习",
  description: "每天一篇，限时朗读，AI 打分，提升外语口语能力",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}


//TODO FIX LINT PROBLEM