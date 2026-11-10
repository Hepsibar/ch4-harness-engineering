import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YT Next Advisor",
  description:
    "내 유튜브 채널을 분석해 다음에 만들 콘텐츠를 추천하는 어드바이저",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
