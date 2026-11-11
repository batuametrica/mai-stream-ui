import { LEAGUES, MATCH_TIME_ZONE, MATCH_WINDOW_DAYS, type League } from "@/lib/leagues";
import type { MatchesResponse, MobileMatch } from "@/lib/types";

export const dynamic = "force-dynamic";

const COMPETITION_URL = "https://claros.mackolik.com/competition-service/soccer/competition";
const CACHE_TTL_MS = 2 * 60_000;
const DAY_MS = 86_400_000;

type RawMatch = {
  uuid?: string;
  date_time_utc?: string;
  status?: string;
  fts_A?: number | string | null;
  fts_B?: number | string | null;
  round?: { name?: string };
  team_A?: { display_name?: string; name?: string };
  team_B?: { display_name?: string; name?: string };
};
type RawGameset = { name?: string; gameweek?: boolean; matches?: RawMatch[] };

// Ligin tüm sezon verisi ~600 KB; liste için yalnızca pencere içindeki maçlar tutulur.
let cache: { at: number; matches: MobileMatch[]; failed: string[] } | null = null;
let inflight: Promise<{ matches: MobileMatch[]; failed: string[] }> | null = null;

function score(value: RawMatch["fts_A"]) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : null;
}

function stageLabel(gameset: RawGameset, match: RawMatch) {
  const name = gameset.name?.trim() || "";
  const base = gameset.gameweek && /^\d+$/.test(name) ? `${name}. Hafta` : name;
  const round = match.round?.name?.trim() || "";
  // Lig içi sezon adları ("Normal Sezon", "Adnan Süvari Sezonu") bilgi taşımaz; Lig A, Lig Aşaması gibi turlar kalır.
  if (!round || round === name || /sezon/i.test(round)) return base;
  return base ? `${base} · ${round}` : round;
}

async function fetchLeague(league: League, order: number): Promise<MobileMatch[]> {
  const url = new URL(COMPETITION_URL);
  url.search = new URLSearchParams({
    language: "tr", country: "tr", competition_uuid: league.competitionId, season_uuid: league.seasonId,
  }).toString();
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json() as { data?: { gamesets?: RawGameset[] } };
  const matches: MobileMatch[] = [];
  for (const gameset of body.data?.gamesets || []) {
    for (const match of gameset.matches || []) {
      if (!match.uuid || !match.date_time_utc) continue;
      const kickoff = new Date(`${match.date_time_utc.replace(" ", "T")}Z`);
      if (Number.isNaN(kickoff.getTime())) continue;
      matches.push({
        id: match.uuid,
        competitionId: league.competitionId,
        competition: league.label,
        country: league.country,
        order,
        stage: stageLabel(gameset, match),
        kickoff: kickoff.toISOString(),
        status: match.status || "Fixture",
        home: match.team_A?.display_name || match.team_A?.name || "Ev sahibi",
        away: match.team_B?.display_name || match.team_B?.name || "Deplasman",
        homeScore: score(match.fts_A),
        awayScore: score(match.fts_B),
      });
    }
  }
  return matches;
}

async function loadAll() {
  const results = await Promise.allSettled(LEAGUES.map((league, index) => fetchLeague(league, index)));
  const matches: MobileMatch[] = [];
  const failed: string[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") matches.push(...result.value);
    else failed.push(LEAGUES[index].label);
  });
  return { matches, failed };
}

// İstanbul'da bugünün 00:00'ından başlayan MATCH_WINDOW_DAYS günlük pencere.
function matchWindow(now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: MATCH_TIME_ZONE }).format(now);
  const start = Date.parse(`${today}T00:00:00+03:00`);
  const days = Array.from({ length: MATCH_WINDOW_DAYS }, (_, index) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: MATCH_TIME_ZONE }).format(new Date(start + index * DAY_MS + DAY_MS / 2)));
  return { start, end: start + MATCH_WINDOW_DAYS * DAY_MS, days };
}

export async function GET() {
  const { start, end, days } = matchWindow();
  if (!cache || Date.now() - cache.at > CACHE_TTL_MS) {
    inflight ||= loadAll().finally(() => { inflight = null; });
    const loaded = await inflight;
    // Maçkolik tamamen erişilemiyorsa son başarılı liste kullanılmaya devam eder.
    if (loaded.failed.length < LEAGUES.length) {
      // Pencerenin bir gün dışına kadar tutulur; TTL kısa olduğu için gece yarısı geçişinde liste kendini yeniler.
      cache = {
        at: Date.now(),
        failed: loaded.failed,
        matches: loaded.matches.filter((match) => {
          const time = Date.parse(match.kickoff);
          return time >= start - DAY_MS && time < end + DAY_MS;
        }),
      };
    }
  }
  if (!cache) {
    return Response.json({ error: "Maç listesi Maçkolik'ten alınamadı." }, { status: 502 });
  }

  const matches = cache.matches
    .filter((match) => { const time = Date.parse(match.kickoff); return time >= start && time < end; })
    .sort((a, b) => a.order - b.order || a.kickoff.localeCompare(b.kickoff) || a.home.localeCompare(b.home, "tr"));
  const body: MatchesResponse = { days, matches, failed: cache.failed, updatedAt: new Date(cache.at).toISOString() };
  return Response.json(body, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" },
  });
}
