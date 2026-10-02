import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "mAI — Sohbet Testi",
  description: "Maçkolik mAI streaming sohbet test arayüzü",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
