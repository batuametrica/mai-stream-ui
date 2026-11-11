import type { Metadata, Viewport } from "next";
import MobileApp from "@/components/MobileApp";
import "./mobile.css";

export const metadata: Metadata = {
  title: "mAI — Mobil deneyim",
  description: "Maçkolik mAI mobil maç ekranı testi: maç listesi, hazır sorular ve kart cevapları",
};

export const viewport: Viewport = { themeColor: "#171717", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function MobilePage() {
  return <MobileApp />;
}
