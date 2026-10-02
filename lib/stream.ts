import type { MaiStreamEvent } from "./types";

function parseFrame(frame: string): MaiStreamEvent | null {
  const lines = frame.split(/\r?\n/).filter(Boolean);
  const dataLines = lines.filter((line) => line.startsWith("data:"));
  const raw = dataLines.length ? dataLines.map((line) => line.slice(5).trimStart()).join("\n") : frame.trim();
  if (!raw || raw === "[DONE]") return null;
  const event = JSON.parse(raw) as MaiStreamEvent;
  return event && typeof event.type === "string" ? event : null;
}

export async function readMaiStream(response: Response, onEvent: (event: MaiStreamEvent) => void) {
  if (!response.body) throw new Error("Sunucudan akış alınamadı.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const frames = pending.split(/\r?\n\r?\n/);
      pending = frames.pop() || "";
      for (const frame of frames) {
        const event = parseFrame(frame);
        if (event) onEvent(event);
      }
    }
    pending += decoder.decode();
    if (pending.trim()) {
      const event = parseFrame(pending);
      if (event) onEvent(event);
    }
  } finally {
    reader.releaseLock();
  }
}
