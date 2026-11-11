type MaiPath = "/ask_stream" | "/ask_stream_mai" | "/ask_stream_mai_basketball" | "/predefined_questions_stream";

// Erişim kodunu kontrol eder ve MAI API adresini çözer; hata varsa doğrudan döndürülecek yanıtı verir.
function resolveUpstream(request: Request, path: MaiPath): URL | Response {
  const requiredToken = process.env.MAI_UI_ACCESS_TOKEN;
  if (requiredToken && request.headers.get("x-mai-ui-token") !== requiredToken) {
    return Response.json({ error: "Erişim kodu hatalı." }, { status: 401 });
  }

  const configuredBase = process.env.MAI_API_BASE_URL?.trim();
  const base = configuredBase || (process.env.NODE_ENV === "development" ? "http://127.0.0.1:4000" : "");
  if (!base) {
    return Response.json({ error: "MAI_API_BASE_URL sunucuda tanımlı değil." }, { status: 503 });
  }

  try {
    const upstreamUrl = new URL(path, base);
    if (!(["http:", "https:"].includes(upstreamUrl.protocol))) throw new Error("invalid protocol");
    return upstreamUrl;
  } catch {
    return Response.json({ error: "MAI_API_BASE_URL geçerli bir HTTP adresi değil." }, { status: 503 });
  }
}

// Same-origin streaming proxy: the browser never needs direct access to the MAI API.
export async function proxyMaiStream(request: Request, path: Exclude<MaiPath, "/predefined_questions_stream">) {
  const upstreamUrl = resolveUpstream(request, path);
  if (upstreamUrl instanceof Response) return upstreamUrl;

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

// Akışsız JSON uçları için aynı vekil (ör. /predefined_questions_stream).
export async function proxyMaiJson(request: Request, path: "/predefined_questions_stream") {
  const upstreamUrl = resolveUpstream(request, path);
  if (upstreamUrl instanceof Response) return upstreamUrl;

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: await request.text(),
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(20_000)]),
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("Content-Type") || "application/json; charset=utf-8" },
    });
  } catch {
    return Response.json({ error: "MAI API bağlantısı kurulamadı. Sunucu adresini kontrol edin." }, { status: 502 });
  }
}
