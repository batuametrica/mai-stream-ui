import { proxyMaiStream } from "@/lib/proxy";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return proxyMaiStream(request, "/ask_stream_mai");
}
