import { proxyMaiStream } from "@/lib/proxy";

export const dynamic = "force-dynamic";

// Mobil uygulamaların kullandığı uç: yeni agent, eski mobil sözleşmesiyle (assistant_delta yok, tek satır metin).
export async function POST(request: Request) {
  return proxyMaiStream(request, "/ask_stream");
}
