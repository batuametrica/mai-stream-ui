"use client";

import { Check, ChevronLeft, ChevronRight, Copy, MessageSquare, RefreshCw, RotateCcw, Sparkles, Timer, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MessageMarkdown from "@/components/MessageMarkdown";
import { HANDOFF_KEY, MOBILE_HISTORY_SCOPE, TOKEN_KEY, USER_KEY, type HandoffCard } from "@/lib/handoff";
import { getErrorMessage, readMaiStream } from "@/lib/stream";
import type { MaiStreamEvent, MatchesResponse, MatchStatus, MobileMatch } from "@/lib/types";

const TIME_ZONE = "Europe/Istanbul";

const timeFormat = new Intl.DateTimeFormat("tr-TR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const shortDayFormat = new Intl.DateTimeFormat("tr-TR", { timeZone: TIME_ZONE, day: "numeric", month: "short" });
const weekdayFormat = new Intl.DateTimeFormat("tr-TR", { timeZone: TIME_ZONE, weekday: "long" });
const longDayFormat = new Intl.DateTimeFormat("tr-TR", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" });
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });

const STATUS_TEXT: Record<string, string> = {
  Fixture: "Maç öncesi", Playing: "Canlı", Played: "Maç sonu",
  Postponed: "Ertelendi", Suspended: "Askıya alındı", Cancelled: "İptal edildi",
};
const STATUS_SHORT: Record<string, string> = { Playing: "Canlı", Played: "MS", Postponed: "Ert.", Suspended: "Ask.", Cancelled: "İpt." };
const QUESTION_TITLE: Record<MatchStatus, string> = { Fixture: "Maç önü sorular", Playing: "Canlı maç soruları", Played: "Maç sonu soruları" };

type Answer = {
  text: string;
  status?: string;
  loading: boolean;
  error?: boolean;
  startedAt: number;
  finishedAt?: number;
  elapsedMs?: number;
  questionId?: string;      // /ask_stream'in verdiği kimlik: sohbete bu karttan devam etmek için
  betPrediction?: Record<string, unknown> | null;
};

// API'nin bildiği üç durum; ertelenen/iptal maçlar maç öncesi gibi sorulur.
function apiStatus(status: string): MatchStatus {
  return status === "Playing" || status === "Played" ? status : "Fixture";
}

function dayKey(iso: string) {
  return dayKeyFormat.format(new Date(iso));
}

function dayDate(key: string) {
  return new Date(`${key}T12:00:00+03:00`);
}

function dayLabel(key: string, index: number) {
  if (index === 0) return "Bugün";
  if (index === 1) return "Yarın";
  const weekday = weekdayFormat.format(dayDate(key));
  return weekday.charAt(0).toLocaleUpperCase("tr") + weekday.slice(1);
}

function seconds(ms: number) {
  return `${(ms / 1000).toFixed(1).replace(".", ",")} sn`;
}

function initials(name: string) {
  const words = name.split(/[\s.-]+/).filter(Boolean);
  const value = words.length > 1 ? `${words[0][0]}${words[1][0]}` : name.slice(0, 2);
  return value.toLocaleUpperCase("tr");
}

function crestStyle(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + (char.codePointAt(0) || 0)) >>> 0;
  return { "--crest-hue": String(hash % 360) } as React.CSSProperties;
}

function hasScore(match: MobileMatch) {
  return (match.status === "Playing" || match.status === "Played") && match.homeScore !== null && match.awayScore !== null;
}

function Crest({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return <span className={`m-crest ${size}`} style={crestStyle(name)} aria-hidden="true">{initials(name)}</span>;
}

export default function MobileApp() {
  const [data, setData] = useState<MatchesResponse | null>(null);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [matchesError, setMatchesError] = useState("");
  const [day, setDay] = useState<string | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Partial<Record<MatchStatus, string[]>>>({});
  const [questionsError, setQuestionsError] = useState("");
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [sheet, setSheet] = useState<{ matchId: string; question: string } | null>(null);
  const [sheetClosing, setSheetClosing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const userIdRef = useRef("");
  const tokenRef = useRef("");
  const sessionIdsRef = useRef<Record<string, number>>({});
  const controllersRef = useRef(new Map<string, AbortController>());
  const sheetRef = useRef<HTMLElement | null>(null);
  const sheetOpenRef = useRef(false);
  const currentSheetRef = useRef<{ matchId: string; question: string } | null>(null);
  const dragRef = useRef<{ startY: number; delta: number } | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  sheetOpenRef.current = !!sheet && !sheetClosing;
  currentSheetRef.current = sheet;

  const loadMatches = useCallback(async () => {
    setLoadingMatches(true);
    setMatchesError("");
    try {
      const response = await fetch("/api/matches", { cache: "no-store" });
      const text = await response.text();
      if (!response.ok) throw new Error(getErrorMessage(text));
      const body = JSON.parse(text) as MatchesResponse;
      setData(body);
      setDay((current) => current && body.days.includes(current) ? current
        : body.days.find((key) => body.matches.some((match) => dayKey(match.kickoff) === key)) || body.days[0] || null);
    } catch (error) {
      setMatchesError(error instanceof Error ? error.message : "Maç listesi alınamadı.");
    } finally {
      setLoadingMatches(false);
    }
  }, []);

  // Kart aşağı kayarak kapanır; yarım kalan istek iptal edilir, tamamlanmış cevaplar saklı kalır.
  const dismissSheet = useCallback(() => {
    if (!sheetOpenRef.current) return;
    setSheetClosing(true);
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      const current = currentSheetRef.current;
      if (current) controllersRef.current.get(`${current.matchId}|${current.question}`)?.abort();
      setSheet(null);
      setSheetClosing(false);
      setCopied(false);
    }, 190);
  }, []);

  useEffect(() => {
    try {
      const userId = localStorage.getItem(USER_KEY) || `mai-ui-${crypto.randomUUID()}`;
      localStorage.setItem(USER_KEY, userId);
      userIdRef.current = userId;
      tokenRef.current = sessionStorage.getItem(TOKEN_KEY) || "";
    } catch {
      userIdRef.current = `mai-ui-${crypto.randomUUID()}`;
    }
    // Geri tuşu: önce açık kartı kapatır, sonra maçtan listeye döner (adres ?mac= ile tutulur).
    const syncFromUrl = () => {
      setMatchId(new URLSearchParams(window.location.search).get("mac"));
      dismissSheet();
    };
    syncFromUrl();
    void loadMatches();
    window.addEventListener("popstate", syncFromUrl);
    const controllers = controllersRef.current;
    return () => {
      window.removeEventListener("popstate", syncFromUrl);
      controllers.forEach((controller) => controller.abort());
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, [dismissSheet, loadMatches]);

  const match = useMemo(() => data?.matches.find((item) => item.id === matchId) || null, [data, matchId]);
  const matchStatus = match ? apiStatus(match.status) : null;
  const matchQuestions = matchStatus ? questions[matchStatus] : undefined;

  useEffect(() => {
    if (!match || !matchStatus || questions[matchStatus]) return;
    let cancelled = false;
    setQuestionsError("");
    (async () => {
      try {
        const response = await fetch("/api/predefined_questions", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(tokenRef.current ? { "x-mai-ui-token": tokenRef.current } : {}) },
          body: JSON.stringify({ match_id: match.id, match_status: matchStatus }),
        });
        const text = await response.text();
        if (!response.ok) throw new Error(getErrorMessage(text));
        const body = JSON.parse(text) as { questions?: string[] };
        if (!cancelled) setQuestions((previous) => ({ ...previous, [matchStatus]: body.questions || [] }));
      } catch (error) {
        if (!cancelled) setQuestionsError(error instanceof Error ? error.message : "Sorular alınamadı.");
      }
    })();
    return () => { cancelled = true; };
  }, [match, matchStatus, questions]);

  const sheetKey = sheet ? `${sheet.matchId}|${sheet.question}` : "";
  const sheetAnswer = sheet ? answers[sheetKey] : undefined;
  const sheetMatch = sheet ? data?.matches.find((item) => item.id === sheet.matchId) || null : null;

  // Bu maçta en son cevaplanan kart: uygulamada sohbet, kullanıcı + maç geçmişindeki bu karttan sürer.
  const lastCard = useMemo(() => {
    if (!match) return null;
    let latest: { question: string; answer: Answer } | null = null;
    for (const [key, answer] of Object.entries(answers)) {
      if (!key.startsWith(`${match.id}|`) || !answer.questionId || answer.error || !answer.finishedAt) continue;
      if (!latest || answer.finishedAt > (latest.answer.finishedAt || 0)) latest = { question: key.slice(match.id.length + 1), answer };
    }
    return latest;
  }, [answers, match]);

  useEffect(() => {
    if (!sheetAnswer?.loading) return;
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [sheetAnswer?.loading]);

  useEffect(() => {
    if (!sheet) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") closeSheet(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sheet]);

  const dayMatches = useMemo(() => {
    const groups = new Map<string, MobileMatch[]>();
    for (const item of data?.matches || []) {
      if (dayKey(item.kickoff) !== day) continue;
      groups.set(item.competitionId, [...(groups.get(item.competitionId) || []), item]);
    }
    return Array.from(groups.values());
  }, [data, day]);

  const countByDay = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of data?.matches || []) counts[dayKey(item.kickoff)] = (counts[dayKey(item.kickoff)] || 0) + 1;
    return counts;
  }, [data]);

  function openMatch(id: string) {
    window.history.pushState({ maiMatch: id }, "", `?mac=${encodeURIComponent(id)}`);
    setMatchId(id);
  }

  function backToList() {
    if (window.history.state?.maiMatch) window.history.back();
    else {
      window.history.replaceState(null, "", window.location.pathname);
      setMatchId(null);
    }
  }

  function closeSheet() {
    if (window.history.state?.maiSheet) window.history.back();   // popstate → dismissSheet
    else dismissSheet();
  }

  async function ask(target: MobileMatch, question: string, force = false) {
    const key = `${target.id}|${question}`;
    if (!sheet) window.history.pushState({ maiSheet: true, maiMatch: target.id }, "", window.location.href);
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    setSheetClosing(false);
    setSheet({ matchId: target.id, question });
    setCopied(false);
    const existing = answers[key];
    if (existing && !force && (existing.loading || !existing.error)) return;

    controllersRef.current.get(key)?.abort();
    const controller = new AbortController();
    controllersRef.current.set(key, controller);
    const startedAt = Date.now();
    setNow(startedAt);
    setAnswers((previous) => ({ ...previous, [key]: { text: "", status: "Düşünüyor…", loading: true, startedAt } }));
    const update = (patch: (answer: Answer) => Partial<Answer>) => setAnswers((previous) => previous[key]
      ? { ...previous, [key]: { ...previous[key], ...patch(previous[key]) } } : previous);

    // Mobil uygulamanın karta dokununca gönderdiği istek: hazır kart, maç bağlamı ve maçın ligi.
    sessionIdsRef.current[target.id] ||= Date.now() * 100 + Math.floor(Math.random() * 100);
    const request = {
      question,
      user_id: `${userIdRef.current}:${MOBILE_HISTORY_SCOPE}`,
      session_id: sessionIdsRef.current[target.id],
      match_id: target.id,
      match_status: apiStatus(target.status),
      competitions: [target.competitionId],
      use_predefined: true,
    };
    let receivedFinal = false;
    try {
      const response = await fetch("/api/ask_stream", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(tokenRef.current ? { "x-mai-ui-token": tokenRef.current } : {}) },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(getErrorMessage(await response.text()));
      await readMaiStream(response, (event: MaiStreamEvent) => {
        const text = event.data?.payload?.text || "";
        if (event.type === "message") {
          receivedFinal = true;
          update(() => ({ text, status: undefined, loading: false, finishedAt: Date.now(), elapsedMs: Date.now() - startedAt,
            questionId: event.data?.question_id, betPrediction: event.data?.payload?.bet_prediction || null }));
        } else if (event.type === "error") {
          receivedFinal = true;
          update(() => ({ text: text || "İstek tamamlanamadı.", status: undefined, loading: false, error: true, elapsedMs: Date.now() - startedAt }));
        } else if (event.type === "assistant_delta") {
          update((answer) => ({ text: answer.text + text, status: "Yanıt yazılıyor…" }));
        } else if (["thinking", "agent_update", "phase", "tool_call", "tool_result"].includes(event.type) && text) {
          update(() => ({ status: text }));
        }
      });
      if (!receivedFinal) throw new Error("Akış, son yanıt gelmeden kapandı.");
    } catch (error) {
      if (controller.signal.aborted) {
        setAnswers((previous) => {
          if (previous[key]?.startedAt !== startedAt) return previous;
          const next = { ...previous };
          delete next[key];
          return next;
        });
      } else {
        const message = error instanceof Error ? error.message : "İstek tamamlanamadı.";
        update((answer) => ({ text: answer.text ? `${answer.text}\n\nBağlantı hatası: ${message}` : message,
          status: undefined, loading: false, error: true, elapsedMs: Date.now() - startedAt }));
      }
    } finally {
      if (controllersRef.current.get(key) === controller) controllersRef.current.delete(key);
    }
  }

  // Uygulamadaki "Sohbete devam et": sohbet ekranı maç bağlamıyla açılır. Kart verilirse sohbet o kartın cevabından
  // (question_id) sürer; sohbet aynı kullanıcı kimliğini kullandığı için API kartı Redis'ten bulur.
  function continueToChat(target: MobileMatch, card?: { question: string; answer: Answer }) {
    const params = new URLSearchParams({
      match_id: target.id,
      competition_id: target.competitionId,
      match_status: apiStatus(target.status),
      title: `${target.home} – ${target.away}`,
    });
    try {
      sessionStorage.removeItem(HANDOFF_KEY);
      if (card?.answer.questionId) {
        params.set("question_id", card.answer.questionId);
        const handoff: HandoffCard = { questionId: card.answer.questionId, question: card.question,
          answer: card.answer.text, betPrediction: card.answer.betPrediction || null };
        sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(handoff));
      }
    } catch { /* depolama kapalıysa kart metni olmadan, question_id ile devam edilir */ }
    window.location.assign(`/?${params.toString()}`);
  }

  async function copyAnswer() {
    if (!sheetAnswer?.text) return;
    try {
      await navigator.clipboard.writeText(sheetAnswer.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch { /* pano izni yoksa sessizce geç */ }
  }

  // Kartı başlığından aşağı çekerek kapatma.
  function onDragStart(event: React.PointerEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    dragRef.current = { startY: event.clientY, delta: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (sheetRef.current) sheetRef.current.style.transition = "none";
  }
  function onDragMove(event: React.PointerEvent<HTMLElement>) {
    if (!dragRef.current || !sheetRef.current) return;
    dragRef.current.delta = Math.max(0, event.clientY - dragRef.current.startY);
    sheetRef.current.style.transform = `translateY(${dragRef.current.delta}px)`;
  }
  function onDragEnd() {
    if (!dragRef.current || !sheetRef.current) return;
    const { delta } = dragRef.current;
    dragRef.current = null;
    if (delta > 90) {
      // Çekilen konumdan aşağı kayarak kapanır (CSS kapanış animasyonu baştan başlamasın diye kapatılır).
      sheetRef.current.dataset.dragged = "true";
      sheetRef.current.style.transition = "transform .19s ease-in";
      sheetRef.current.style.transform = "translateY(100%)";
      closeSheet();
      return;
    }
    sheetRef.current.style.transition = "transform .18s ease";
    sheetRef.current.style.transform = "";
  }

  const elapsed = sheetAnswer ? (sheetAnswer.loading ? now - sheetAnswer.startedAt : sheetAnswer.elapsedMs) : undefined;
  const detailOpen = matchId !== null;

  return (
    <div className="m-shell">
      <div className="m-phone">
        <section className="m-view" inert={detailOpen}>
          <header className="m-top">
            <div className="m-brand"><span className="m-brand-mark" aria-hidden="true">m<i /></span>mAI<span className="m-pill">Mobil</span></div>
            <div className="m-top-actions">
              <button className="m-icon-button" onClick={() => void loadMatches()} disabled={loadingMatches} title="Listeyi yenile" aria-label="Listeyi yenile">
                <RefreshCw size={18} className={loadingMatches ? "m-spin" : ""} />
              </button>
              <Link className="m-icon-button" href="/" title="Sohbet ekranı" aria-label="Sohbet ekranı"><MessageSquare size={18} /></Link>
            </div>
          </header>
          <nav className="m-days" aria-label="Günler">
            {(data?.days || []).map((key, index) => <button key={key} className={`m-day ${key === day ? "active" : ""}`} aria-pressed={key === day} onClick={() => setDay(key)}>
              <strong>{dayLabel(key, index)}</strong>
              <small>{shortDayFormat.format(dayDate(key))} · {countByDay[key] || 0} maç</small>
            </button>)}
          </nav>
          <div className="m-scroll">
            {matchesError && <div className="m-alert" role="alert">{matchesError}<button onClick={() => void loadMatches()}>Tekrar dene</button></div>}
            {data && data.failed.length > 0 && <p className="m-note">Alınamayan ligler: {data.failed.join(", ")}</p>}
            {!data && loadingMatches && <div className="m-skeleton" aria-label="Maçlar yükleniyor">{Array.from({ length: 6 }, (_, index) => <i key={index} />)}</div>}
            {data && !dayMatches.length && <div className="m-empty"><Sparkles size={20} /><p>Bu gün mAI kapsamındaki liglerde maç yok.</p></div>}
            {dayMatches.map((matches) => <section className="m-league" key={matches[0].competitionId}>
              <h2 className="m-league-head"><span>{matches[0].competition}</span><small>{matches[0].country}</small></h2>
              {matches.map((item) => {
                const scored = hasScore(item);
                return <button key={item.id} className="m-match" onClick={() => openMatch(item.id)}>
                  <span className={`m-match-time ${item.status === "Playing" ? "live" : ""}`}>
                    {STATUS_SHORT[item.status] || timeFormat.format(new Date(item.kickoff))}
                  </span>
                  <span className="m-match-teams">
                    <span><Crest name={item.home} />{item.home}</span>
                    <span><Crest name={item.away} />{item.away}</span>
                  </span>
                  <span className="m-match-score" aria-label={scored ? `Skor ${item.homeScore}-${item.awayScore}` : undefined}>
                    {scored && <><b>{item.homeScore}</b><b>{item.awayScore}</b></>}
                  </span>
                  <ChevronRight size={16} className="m-chevron" />
                </button>;
              })}
            </section>)}
            {data && <p className="m-foot">Maç listesi Maçkolik’ten, bugün dahil {data.days.length} gün. Saatler Türkiye saatidir.</p>}
          </div>
        </section>

        {detailOpen && <section className="m-view detail" inert={!!sheet} aria-label="Maç">
          <header className="m-top detail">
            <button className="m-icon-button" onClick={backToList} aria-label="Maç listesine dön"><ChevronLeft size={22} /></button>
            <div className="m-detail-title">
              <strong>{match?.competition || "Maç"}</strong>
              {match?.stage && <small>{match.stage}</small>}
            </div>
          </header>
          <div className="m-scroll">
            {!match ? <div className="m-empty">
              {loadingMatches ? <div className="m-skeleton">{Array.from({ length: 3 }, (_, index) => <i key={index} />)}</div>
                : <><p>Bu maç son {data?.days.length || 3} günün listesinde yok.</p><button className="m-ghost" onClick={backToList}>Maç listesine dön</button></>}
            </div> : <>
              <div className="m-hero">
                <div className="m-team"><Crest name={match.home} size="lg" /><span>{match.home}</span></div>
                <div className="m-hero-center">
                  {hasScore(match) ? <span className="m-hero-score">{match.homeScore} – {match.awayScore}</span>
                    : <span className="m-hero-time">{timeFormat.format(new Date(match.kickoff))}</span>}
                  <span className={`m-status ${match.status === "Playing" ? "live" : ""}`}>{STATUS_TEXT[match.status] || match.status}</span>
                  <span className="m-hero-date">{longDayFormat.format(new Date(match.kickoff))}</span>
                </div>
                <div className="m-team"><Crest name={match.away} size="lg" /><span>{match.away}</span></div>
              </div>

              <div className="m-section-head">
                <h2><Sparkles size={16} /> mAI’ye sor</h2>
                <small>{QUESTION_TITLE[matchStatus || "Fixture"]}</small>
              </div>
              {questionsError && <div className="m-alert" role="alert">{questionsError}<button onClick={() => { setQuestionsError(""); setQuestions((previous) => ({ ...previous })); }}>Tekrar dene</button></div>}
              {!matchQuestions && !questionsError && <div className="m-skeleton questions">{Array.from({ length: 5 }, (_, index) => <i key={index} />)}</div>}
              {matchQuestions && <div className="m-questions">
                {matchQuestions.length === 0 && <p className="m-note">Bu maç durumu için hazır soru yok.</p>}
                {matchQuestions.map((question) => {
                  const answer = answers[`${match.id}|${question}`];
                  const state = answer?.loading ? "loading" : answer?.error ? "error" : answer ? "answered" : "";
                  return <button key={question} className={`m-question ${state}`} onClick={() => void ask(match, question)}>
                    <span className="m-question-icon" aria-hidden="true"><Sparkles size={14} /></span>
                    <span className="m-question-text">{question}</span>
                    <span className="m-question-state" aria-label={state === "answered" ? "Cevaplandı" : undefined}>
                      {state === "loading" ? <span className="m-dot-pulse" /> : state === "answered" ? <Check size={16} /> : <ChevronRight size={16} />}
                    </span>
                  </button>;
                })}
              </div>}
              <p className="m-foot">Sorular <code>/predefined_questions_stream</code>, cevaplar mobil uygulamadaki gibi <code>/ask_stream</code> hazır kart isteğiyle alınır.</p>
            </>}
          </div>
          {match && <div className="m-detail-cta">
            <button className="m-primary" onClick={() => continueToChat(match, lastCard || undefined)}><MessageSquare size={18} />Sohbete devam et</button>
            <span className="m-cta-hint">{lastCard ? `Son kart yanıtından devam eder: ${lastCard.question}` : "Sohbet bu maçın bağlamıyla açılır"}</span>
          </div>}
        </section>}

        {sheet && <>
          <button className={`m-sheet-backdrop ${sheetClosing ? "closing" : ""}`} aria-label="Cevabı kapat" tabIndex={-1} onClick={closeSheet} />
          <section ref={sheetRef} className={`m-sheet ${sheetClosing ? "closing" : ""}`} role="dialog" aria-modal="true" aria-labelledby="m-sheet-title">
            <div className="m-sheet-grip" onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd}>
              <span className="m-sheet-handle" aria-hidden="true" />
              <div className="m-sheet-head">
                <span className="m-brand-mark small" aria-hidden="true">m<i /></span>
                <div className="m-sheet-heading">
                  {sheetMatch && <span className="m-sheet-eyebrow">{sheetMatch.home} – {sheetMatch.away}</span>}
                  <h2 id="m-sheet-title">{sheet.question}</h2>
                </div>
                <button className="m-icon-button" onClick={closeSheet} aria-label="Kapat" autoFocus><X size={19} /></button>
              </div>
            </div>
            <div className="m-sheet-body" aria-live="polite">
              {sheetAnswer?.text ? <div className={sheetAnswer.error ? "m-error" : ""}><MessageMarkdown text={sheetAnswer.text} /></div>
                : <div className="m-sheet-loading"><span className="typing-dots"><i /><i /><i /></span>{sheetAnswer?.status || "Düşünüyor…"}</div>}
              {sheetAnswer?.text && sheetAnswer.loading && sheetAnswer.status && <div className="m-sheet-loading after"><span className="m-dot-pulse" />{sheetAnswer.status}</div>}
              {sheetAnswer?.betPrediction && <details className="prediction-details"><summary>Tahmin verisi</summary><pre>{JSON.stringify(sheetAnswer.betPrediction, null, 2)}</pre></details>}
            </div>
            <footer className="m-sheet-foot">
              {sheetMatch && sheetAnswer?.questionId && !sheetAnswer.loading && !sheetAnswer.error
                && <button className="m-primary" onClick={() => continueToChat(sheetMatch, { question: sheet.question, answer: sheetAnswer })}>
                  <MessageSquare size={18} />Sohbete devam et
                </button>}
              <div className="m-sheet-meta">
                {elapsed !== undefined && <span className="m-sheet-time" title="İstekten son cevaba kadar geçen süre"><Timer size={14} />{seconds(elapsed)}</span>}
                <div className="m-sheet-actions">
                  <button className="m-ghost" onClick={() => void copyAnswer()} disabled={!sheetAnswer?.text || sheetAnswer.loading}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Kopyalandı" : "Kopyala"}</button>
                  <button className="m-ghost" disabled={!sheetMatch || sheetAnswer?.loading} onClick={() => sheetMatch && void ask(sheetMatch, sheet.question, true)}><RotateCcw size={14} />Tekrar sor</button>
                </div>
              </div>
            </footer>
          </section>
        </>}
      </div>
    </div>
  );
}
