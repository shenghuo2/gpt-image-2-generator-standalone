import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "生蚝的GPT-image-2图片生成站",
  icons: { icon: "./favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full">
      <head>
        <link rel="stylesheet" href="./tailwind.css" />
      </head>
      <body className="h-full">{children}</body>
    </html>
  );
}
