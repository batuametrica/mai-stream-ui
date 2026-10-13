import type { Sport } from "@/lib/types";

// lucide-react'te futbol/basketbol topu yok; aynı çizgi stiliyle küçük satır içi SVG'ler.
export default function SportIcon({ sport, size = 16 }: { sport: Sport; size?: number }) {
  const common = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true,
  };
  if (sport === "basketball") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9.5" />
        <path d="M2.5 12h19M12 2.5v19" />
        <path d="M5.4 5.2c2.5 2.4 3.8 4.6 3.8 6.8s-1.3 4.4-3.8 6.8M18.6 5.2c-2.5 2.4-3.8 4.6-3.8 6.8s1.3 4.4 3.8 6.8" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="m12 7.4 4 2.9-1.5 4.7h-5L8 10.3z" />
      <path d="M12 7.4V2.7M16 10.3l4.4-1.4M14.5 15l2.7 3.8M9.5 15l-2.7 3.8M8 10.3 3.6 8.9" />
    </svg>
  );
}
