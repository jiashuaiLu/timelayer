import type { Metadata, Viewport } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "时间街道 TimeLayer",
  description:
    "输入一个地址，看见这条街过去一百年留下的痕迹：旧地图、街景、新闻碎片，以及一条只属于它的判词。",
  metadataBase: new URL("http://localhost:4310"),
  openGraph: {
    title: "时间街道 TimeLayer",
    description: "一条街的传记，一百年，一拖就看完。",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#E6DFD3",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=IBM+Plex+Mono:wght@400;500&family=Noto+Serif+SC:wght@400;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
