import type { Metadata } from "next";
import "./globals.css";

// ▼ サイトのタイトル・説明。Claude Code に「タイトルを◯◯に変えて」と頼めば書き換わる。
export const metadata: Metadata = {
  title: "受講カリキュラム管理",
  description: "中小企業診断士の受講カリキュラムの進捗を管理するツール",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
