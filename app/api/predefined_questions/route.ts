import { proxyMaiJson } from "@/lib/proxy";

export const dynamic = "force-dynamic";

// Mobil uygulamanın maç ekranında gösterdiği hazır sorular: { match_id, match_status } → { questions: string[] }.
export async function POST(request: Request) {
  return proxyMaiJson(request, "/predefined_questions_stream");
}
