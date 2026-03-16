import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Minesweeper: Strait of Hormuz",
  description: "Navigate the mines in the Strait of Hormuz",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
