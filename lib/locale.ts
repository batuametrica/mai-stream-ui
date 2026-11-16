import type { Locale } from "@/lib/types";

// Futbol cevap dili (Fransa uygulaması testi). Arayüz Türkçe kalır; yalnızca istek ve cevap dili değişir.
// "tr" seçiliyken isteğe locale alanı eklenmez (mobil uygulamanın bugünkü isteği); "fr" ve "ar" locale gönderir.
// "ar": Fransa'da yaşayan Arapça konuşan kullanıcılar. Cevaplar Arapça (sağdan sola); soru Arapça, lehçe,
// Latin harfli Arapça (Arabizi) ya da Fransızca yazılabilir.
export const LOCALES: Record<Locale, { label: string; short: string; dir: "ltr" | "rtl"; title: string }> = {
  tr: { label: "Türkçe", short: "TR", dir: "ltr", title: "Türkçe sorular ve cevaplar" },
  fr: { label: "Fransızca", short: "FR", dir: "ltr", title: "Fransızca sorular ve cevaplar" },
  ar: { label: "Arapça", short: "AR", dir: "rtl", title: "Arapça sorular ve cevaplar" },
};

export const LOCALE_KEYS = Object.keys(LOCALES) as Locale[];

export function parseLocale(value: unknown): Locale {
  return value === "fr" || value === "ar" ? value : "tr";
}

// İstek gövdesine eklenecek alan: Türkçe'de hiçbir şey.
export function localeField(locale: Locale): { locale?: Locale } {
  return locale === "tr" ? {} : { locale };
}

// Sağdan sola diller için dir özniteliği; diğerlerinde öznitelik eklenmez (Türkçe/Fransızca DOM'u değişmez).
export function textDir(locale: Locale): "rtl" | undefined {
  return LOCALES[locale].dir === "rtl" ? "rtl" : undefined;
}
