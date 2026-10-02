// Same-origin streaming proxy: the browser never needs direct access to the MAI API.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requiredToken = process.env.MAI_UI_ACCESS_TOKEN;
  if (requiredToken && request.headers.get("x-mai-ui-token") !== requiredToken) {
    return Response.json({ error: "Erişim kodu hatalı." }, { status: 401 });
  }

  const configuredBase = process.env.MAI_API_BASE_URL?.trim();
  const base = configuredBase || (process.env.NODE_ENV === "development" ? "http://127.0.0.1:4000" : "");
  if (!base) {
    return Response.json({ error: "MAI_API_BASE_URL sunucuda tanımlı değil." }, { status: 503 });
  }

  let upstreamUrl: URL;
  try {
    upstreamUrl = new URL("/ask_stream_mai", base);
    if (!(["http:", "https:"].includes(upstreamUrl.protocol))) throw new Error("invalid protocol");
  } catch {
    return Response.json({ error: "MAI_API_BASE_URL geçerli bir HTTP adresi değil." }, { status: 503 });
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: await request.text(),
      cache: "no-store",
      signal: request.signal,
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return Response.json({ error: "MAI API bağlantısı kurulamadı. Sunucu adresini kontrol edin." }, { status: 502 });
  }
}
