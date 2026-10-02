"use client";

import {
  ArrowUp, Check, ChevronDown, CircleHelp, Copy, History, Home, Menu,
  MessageSquare, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Pencil,
  Plus, Search, Settings2, ShieldCheck, Sparkles, SquarePen, Trash2, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readMaiStream } from "@/lib/stream";
import type { ChatContext, ChatMessage, Conversation, MaiStreamEvent, MatchStatus } from "@/lib/types";

const STORAGE_KEY = "mai-stream-ui:conversations:v1";
const SELECTED_KEY = "mai-stream-ui:selected:v1";
const USER_KEY = "mai-stream-ui:user:v1";
const CONTEXT_KEY = "mai-stream-ui:context:v1";
const TOKEN_KEY = "mai-stream-ui:token:v1";
const EMPTY_CONTEXT: ChatContext = { matchId: "", competitionId: "", matchStatus: "Fixture" };

function makeConversation(context: ChatContext): Conversation {
  const timestamp = Date.now();
  return {
    id: crypto.randomUUID(), sessionId: timestamp * 100 + Math.floor(Math.random() * 100),
    title: "Yeni sohbet", createdAt: timestamp, updatedAt: timestamp,
    context: { ...context }, messages: [],
  };
}

function groupFor(timestamp: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (timestamp >= today.getTime()) return "Bugün";
  if (timestamp >= today.getTime() - 86_400_000) return "Dün";
  if (timestamp >= today.getTime() - 7 * 86_400_000) return "Önceki 7 gün";
  return "Daha önce";
}

function contextLabel(context: ChatContext) {
  if (!context.matchId && !context.competitionId) return "Genel futbol";
  if (context.matchId) return `Maç · ${context.matchId.slice(0, 10)}…`;
  return `Lig · ${context.competitionId.slice(0, 10)}…`;
}

function buttonTitle(message: string) {
  return message.length > 48 ? `${message.slice(0, 48)}…` : message;
}

function getErrorMessage(text: string): string {
  try {
    const parsed = JSON.parse(text) as { error?: string; detail?: string };
    return parsed.error || parsed.detail || text;
  } catch {
    return text || "İstek tamamlanamadı.";
  }
}

export default function ChatApp() {
  const [ready, setReady] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [defaultContext, setDefaultContext] = useState<ChatContext>(EMPTY_CONTEXT);
  const [settingsDraft, setSettingsDraft] = useState<ChatContext>(EMPTY_CONTEXT);
  const [accessToken, setAccessToken] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [predefinedMode, setPredefinedMode] = useState(false);
  const [pendingContinuationId, setPendingContinuationId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const userIdRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as Conversation[];
      if (Array.isArray(stored)) setConversations(stored.filter((chat) => chat?.id && Array.isArray(chat.messages)));
      setSelectedId(localStorage.getItem(SELECTED_KEY));
      const savedContext = JSON.parse(localStorage.getItem(CONTEXT_KEY) || "null") as ChatContext | null;
      if (savedContext && typeof savedContext.matchId === "string") setDefaultContext(savedContext);
      const userId = localStorage.getItem(USER_KEY) || `mai-ui-${crypto.randomUUID()}`;
      localStorage.setItem(USER_KEY, userId);
      userIdRef.current = userId;
      setAccessToken(sessionStorage.getItem(TOKEN_KEY) || "");
    } catch {
      userIdRef.current = `mai-ui-${crypto.randomUUID()}`;
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.slice(0, 80)));
      if (selectedId) localStorage.setItem(SELECTED_KEY, selectedId);
      else localStorage.removeItem(SELECTED_KEY);
      localStorage.setItem(CONTEXT_KEY, JSON.stringify(defaultContext));
      sessionStorage.setItem(TOKEN_KEY, accessToken);
    } catch {
      setNotice("Sohbet geçmişi bu tarayıcıda kaydedilemedi.");
    }
  }, [ready, conversations, selectedId, defaultContext, accessToken]);

  const selected = conversations.find((chat) => chat.id === selectedId) || null;
  const activeContext = selected?.context || defaultContext;
  const sortedChats = useMemo(() => [...conversations]
    .filter((chat) => chat.title.toLocaleLowerCase("tr").includes(search.toLocaleLowerCase("tr")))
    .sort((a, b) => b.updatedAt - a.updatedAt), [conversations, search]);
  const groupedChats = useMemo(() => {
    const groups = new Map<string, Conversation[]>();
    for (const chat of sortedChats) {
      const group = groupFor(chat.updatedAt);
      groups.set(group, [...(groups.get(group) || []), chat]);
    }
    return groups;
  }, [sortedChats]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport && stickToBottomRef.current) viewport.scrollTop = viewport.scrollHeight;
  }, [selectedId, selected?.messages]);

  const updateMessage = useCallback((chatId: string, messageId: string, update: (message: ChatMessage) => ChatMessage) => {
    setConversations((previous) => previous.map((chat) => chat.id === chatId
      ? { ...chat, updatedAt: Date.now(), messages: chat.messages.map((message) => message.id === messageId ? update(message) : message) }
      : chat));
  }, []);

  function newChat(context = defaultContext) {
    if (sending) abortRef.current?.abort();
    const chat = makeConversation(context);
    setConversations((previous) => [chat, ...previous]);
    setSelectedId(chat.id);
    setDraft("");
    setPendingContinuationId(null);
    setMobileSidebarOpen(false);
    stickToBottomRef.current = true;
    window.setTimeout(() => textareaRef.current?.focus(), 30);
  }

  function deleteChat(id: string) {
    if (selectedId === id && sending) abortRef.current?.abort();
    setConversations((previous) => previous.filter((chat) => chat.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function renameChat(chat: Conversation) {
    const title = window.prompt("Sohbet adı", chat.title)?.trim();
    if (!title) return;
    setConversations((previous) => previous.map((item) => item.id === chat.id ? { ...item, title } : item));
  }

  function openSettings() {
    setSettingsDraft({ ...activeContext });
    setSettingsOpen(true);
  }

  function saveSettings() {
    const next = { ...settingsDraft, matchId: settingsDraft.matchId.trim(), competitionId: settingsDraft.competitionId.trim() };
    setDefaultContext(next);
    if (selected) {
      const changed = JSON.stringify(next) !== JSON.stringify(selected.context);
      if (changed && selected.messages.length) {
        newChat(next);
        setNotice("Bağlam değiştiği için yeni bir sohbet açıldı.");
      } else if (changed) {
        setConversations((previous) => previous.map((chat) => chat.id === selected.id ? { ...chat, context: next } : chat));
      }
    }
    setSettingsOpen(false);
  }

  function continueFromCard(chat: Conversation, message: ChatMessage) {
    if (!message.questionId) return;
    const index = chat.messages.findIndex((item) => item.id === message.id);
    const priorUser = [...chat.messages.slice(0, index)].reverse().find((item) => item.role === "user");
    const next = makeConversation(chat.context);
    next.title = `Devam · ${chat.title}`;
    next.messages = [...(priorUser ? [{ ...priorUser, id: crypto.randomUUID() }] : []),
      { ...message, id: crypto.randomUUID() }];
    setConversations((previous) => [next, ...previous]);
    setSelectedId(next.id);
    setPendingContinuationId(message.questionId);
    setMobileSidebarOpen(false);
    setNotice("Kart yanıtı yeni sohbetin başlangıcına eklendi.");
    window.setTimeout(() => textareaRef.current?.focus(), 30);
  }

  async function copyText(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch { setNotice("Metin kopyalanamadı."); }
  }

  async function shareChat() {
    if (!selected) return;
    const transcript = selected.messages.map((message) => `${message.role === "user" ? "Sen" : "mAI"}: ${message.text}`).join("\n\n");
    await copyText("share", transcript);
  }

  async function sendMessage() {
    const question = draft.trim();
    if (!question || sending || !ready) return;
    const chat = selected || makeConversation(defaultContext);
    const chatId = chat.id;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", text: question, createdAt: Date.now() };
    const assistantId = crypto.randomUUID();
    const pending: ChatMessage = { id: assistantId, role: "assistant", text: "", status: "Düşünüyor…", createdAt: Date.now(), predefined: predefinedMode };
    setConversations((previous) => {
      const current = selected ? previous : [chat, ...previous];
      return current.map((item) => item.id === chatId ? {
        ...item, title: item.messages.length ? item.title : buttonTitle(question),
        updatedAt: Date.now(), messages: [...item.messages, userMessage, pending],
      } : item);
    });
    setSelectedId(chatId);
    setDraft("");
    setSending(true);
    setNotice("");
    stickToBottomRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    let receivedFinal = false;

    const request: Record<string, unknown> = {
      question, user_id: userIdRef.current, session_id: chat.sessionId,
      match_status: chat.context.matchStatus, use_predefined: predefinedMode,
    };
    if (chat.context.matchId) request.match_id = chat.context.matchId;
    if (chat.context.competitionId) request.competitions = [chat.context.competitionId];
    if (pendingContinuationId) request.question_id = pendingContinuationId;
    setPredefinedMode(false);
    setPendingContinuationId(null);

    try {
      const response = await fetch("/api/ask_stream_mai", {
        method: "POST", headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { "x-mai-ui-token": accessToken } : {}),
        },
        body: JSON.stringify(request), signal: controller.signal,
      });
      if (!response.ok) throw new Error(getErrorMessage(await response.text()));
      await readMaiStream(response, (event: MaiStreamEvent) => {
        const text = event.data?.payload?.text || "";
        if (event.type === "assistant_delta") {
          updateMessage(chatId, assistantId, (message) => ({ ...message, text: message.text + text, status: "Yanıt yazılıyor…" }));
        } else if (event.type === "message") {
          receivedFinal = true;
          updateMessage(chatId, assistantId, (message) => ({ ...message, text, status: undefined,
            questionId: event.data?.question_id,
            betPrediction: event.data?.payload?.bet_prediction || null }));
        } else if (event.type === "error") {
          receivedFinal = true;
          updateMessage(chatId, assistantId, (message) => ({ ...message, text: text || "İstek tamamlanamadı.", status: undefined, error: true }));
        } else if (["thinking", "phase", "tool_call", "tool_result"].includes(event.type) && text) {
          updateMessage(chatId, assistantId, (message) => ({ ...message, status: text }));
        }
      });
      if (!receivedFinal) throw new Error("Akış, son yanıt gelmeden kapandı.");
    } catch (error) {
      if (controller.signal.aborted) {
        updateMessage(chatId, assistantId, (message) => ({ ...message, status: undefined, stopped: true,
          text: message.text || "Yanıt durduruldu." }));
      } else {
        const message = error instanceof Error ? error.message : "İstek tamamlanamadı.";
        updateMessage(chatId, assistantId, (item) => ({ ...item, status: undefined, error: true,
          text: item.text ? `${item.text}\n\nBağlantı hatası: ${message}` : message }));
      }
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void sendMessage();
    }
  }

  const oldHistory = selected && selected.messages.length > 0 && Date.now() - selected.updatedAt > 10 * 60_000;

  return (
    <div className="app-shell">
      <nav className="icon-rail" aria-label="Ana gezinme">
        <div className="rail-top">
          <button className="rail-button selected" title="Sohbetler" aria-label="Sohbetler" onClick={() => setSidebarOpen(true)}><Home size={19} /></button>
          <button className="rail-button" title="Yeni sohbet" aria-label="Yeni sohbet" onClick={() => newChat()}><SquarePen size={19} /></button>
          <button className="rail-button" title="Geçmiş" aria-label="Geçmiş" onClick={() => { setSidebarOpen(true); setSearchOpen(true); }}><History size={19} /></button>
        </div>
        <div className="rail-bottom"><button className="rail-button" title="Ayarlar" aria-label="Ayarlar" onClick={openSettings}><Settings2 size={19} /></button></div>
      </nav>

      {mobileSidebarOpen && <button className="mobile-scrim" aria-label="Menüyü kapat" onClick={() => setMobileSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? "" : "collapsed"} ${mobileSidebarOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-header">
          <div className="brand-name">mAI <ChevronDown size={14} strokeWidth={2} /></div>
          <div className="sidebar-header-actions">
            <button className="icon-button" title="Sohbet ara" aria-label="Sohbet ara" onClick={() => setSearchOpen((value) => !value)}><Search size={17} /></button>
            <button className="icon-button desktop-only" title="Yan paneli kapat" aria-label="Yan paneli kapat" onClick={() => setSidebarOpen(false)}><PanelLeftClose size={17} /></button>
            <button className="icon-button mobile-only" aria-label="Yan paneli kapat" onClick={() => setMobileSidebarOpen(false)}><X size={18} /></button>
          </div>
        </div>
        <button className="new-chat-button" onClick={() => newChat()}><SquarePen size={16} /> Yeni sohbet</button>
        {searchOpen && <div className="sidebar-search"><Search size={15} /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Sohbetlerde ara" aria-label="Sohbetlerde ara" /></div>}
        <div className="history-scroll">
          {groupedChats.size === 0 && <p className="history-empty">{search ? "Eşleşen sohbet yok." : "Sohbetlerin burada görünecek."}</p>}
          {Array.from(groupedChats).map(([group, chats]) => <section className="history-group" key={group}>
            <h2>{group}</h2>
            {chats.map((chat) => <div className={`history-item ${chat.id === selectedId ? "active" : ""}`} key={chat.id}>
              <button className="history-select" title={chat.title} onClick={() => { if (sending) abortRef.current?.abort(); setSelectedId(chat.id); setMobileSidebarOpen(false); stickToBottomRef.current = true; }}>
                <MessageSquare size={15} /><span>{chat.title}</span>
              </button>
              <div className="history-actions">
                <button title="Yeniden adlandır" aria-label="Yeniden adlandır" onClick={() => renameChat(chat)}><Pencil size={13} /></button>
                <button title="Sil" aria-label="Sohbeti sil" onClick={() => deleteChat(chat.id)}><Trash2 size={13} /></button>
              </div>
            </div>)}
          </section>)}
        </div>
        <div className="sidebar-footer"><div className="mini-avatar">m</div><div><strong>mAI test alanı</strong><span>Ekip değerlendirmesi</span></div><MoreHorizontal size={17} /></div>
      </aside>

      <main className="main-pane">
        <header className="topbar">
          <div className="topbar-left">
            {!sidebarOpen && <button className="icon-button" title="Yan paneli aç" aria-label="Yan paneli aç" onClick={() => setSidebarOpen(true)}><PanelLeftOpen size={18} /></button>}
            <button className="icon-button mobile-menu" aria-label="Menüyü aç" onClick={() => setMobileSidebarOpen(true)}><Menu size={21} /></button>
            <div className="conversation-title">{selected?.title || "mAI"}</div>
          </div>
          <div className="topbar-right">
            <span className="topbar-context">{contextLabel(activeContext)}</span>
            <button className="icon-button share-button" onClick={() => void shareChat()} title="Sohbeti kopyala" aria-label="Sohbeti kopyala" disabled={!selected?.messages.length}>{copiedId === "share" ? <Check size={17} /> : <Copy size={17} />}</button>
            <button className="icon-button" onClick={openSettings} title="Test ayarları" aria-label="Test ayarları"><Settings2 size={18} /></button>
          </div>
        </header>

        <div className="conversation-scroller" ref={viewportRef} onScroll={(event) => { const target = event.currentTarget; stickToBottomRef.current = target.scrollHeight - target.scrollTop - target.clientHeight < 100; }}>
          {selected?.messages.length ? <div className="message-list">
            {selected.messages.map((message) => <div className={`message-row ${message.role}`} key={message.id}>
              {message.role === "assistant" && <div className="assistant-avatar" aria-hidden="true"><span>m</span><i /></div>}
              <div className="message-content">
                {message.role === "assistant" && <div className="assistant-label">mAI {message.predefined && <span className="card-badge">Hazır kart</span>}</div>}
                <div className={`message-text ${message.error ? "message-error" : ""}`}>
                  {message.text || (message.role === "assistant" ? <span className="typing-dots"><i /><i /><i /></span> : "")}
                  {message.status === "Yanıt yazılıyor…" && <span className="stream-cursor" />}
                </div>
                {message.role === "assistant" && message.status && <div className="message-status"><span className="status-pulse" />{message.status}</div>}
                {message.role === "assistant" && message.stopped && <div className="message-status muted">Yanıt durduruldu</div>}
                {message.role === "assistant" && message.betPrediction && <details className="prediction-details"><summary>Tahmin verisi</summary><pre>{JSON.stringify(message.betPrediction, null, 2)}</pre></details>}
                {message.role === "assistant" && !!message.text && <div className="message-actions">
                  <button title="Yanıtı kopyala" aria-label="Yanıtı kopyala" onClick={() => void copyText(message.id, message.text)}>{copiedId === message.id ? <Check size={14} /> : <Copy size={14} />}</button>
                  {message.predefined && message.questionId && selected && <button className="continue-card" onClick={() => continueFromCard(selected, message)}>Bu karttan sohbete devam et</button>}
                </div>}
              </div>
            </div>)}
            {oldHistory && <p className="history-expiry">Bu cihazdaki mesajlar saklanır; agent’ın sohbet bağlamı bir süre sonra sıfırlanabilir.</p>}
          </div> : <div className="empty-state">
            <div className="welcome-mark"><span>m</span><i /></div>
            <h1>Bugün futbol hakkında ne konuşalım?</h1>
            <p>Maç analizi, oyuncu performansı ve lig istatistiklerini mAI’ye sor.</p>
            <div className="suggestions">
              {activeContext.matchId && <button onClick={() => { setDraft("Bu maçta en çok xG üreten oyuncu kim?"); textareaRef.current?.focus(); }}>Bu maçta en çok xG üreten kim?</button>}
              <button onClick={() => { setDraft("Bu sezon en çok pas yapan oyuncu kim?"); textareaRef.current?.focus(); }}>En çok pas yapan oyuncu kim?</button>
              {activeContext.matchId ? <button onClick={() => { setDraft("Bu maçın gidişatını analiz et."); textareaRef.current?.focus(); }}>Maçın gidişatını analiz et</button>
                : <button onClick={() => { setDraft("Bu sezon gol krallığında kim önde?"); textareaRef.current?.focus(); }}>Gol krallığında kim önde?</button>}
            </div>
          </div>}
        </div>

        <div className="composer-area">
          {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Bildirimi kapat"><X size={13} /></button></div>}
          {pendingContinuationId && <div className="continuation-banner"><Sparkles size={14} /> Seçilen karttan devam edilecek <button onClick={() => setPendingContinuationId(null)} aria-label="Kart devamını iptal et"><X size={14} /></button></div>}
          <div className="composer">
            <textarea ref={textareaRef} rows={1} value={draft} onChange={(event) => { setDraft(event.target.value); event.target.style.height = "auto"; event.target.style.height = `${Math.min(event.target.scrollHeight, 180)}px`; }} onKeyDown={handleComposerKeyDown} placeholder="mAI’ye sor" aria-label="mAI’ye sor" disabled={!ready} />
            <div className="composer-toolbar">
              <div className="composer-left">
                <button className="composer-icon" title="Maç ve lig bağlamı" aria-label="Maç ve lig bağlamı" onClick={openSettings}><Plus size={19} /></button>
                <button className="context-chip" onClick={openSettings}><span className="chip-dot" />{contextLabel(activeContext)}<ChevronDown size={13} /></button>
                <button className={`mode-chip ${predefinedMode ? "on" : ""}`} title="Hazır kart isteği olarak gönder" onClick={() => setPredefinedMode((value) => !value)}><Sparkles size={14} /> Kart modu</button>
              </div>
              {sending ? <button className="send-button stop" title="Yanıtı durdur" aria-label="Yanıtı durdur" onClick={() => abortRef.current?.abort()}><span className="stop-square" /></button>
                : <button className="send-button" title="Gönder" aria-label="Gönder" disabled={!draft.trim() || !ready} onClick={() => void sendMessage()}><ArrowUp size={19} strokeWidth={2.8} /></button>}
            </div>
          </div>
          <p className="footer-note">mAI hata yapabilir. Önemli bilgileri doğrulayın. <button onClick={openSettings}>Test ayarları</button></p>
        </div>
      </main>

      {settingsOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
        <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <div className="modal-heading"><div><span className="modal-eyebrow">TEST ORTAMI</span><h2 id="settings-title">Sohbet bağlamı</h2></div><button className="icon-button" aria-label="Kapat" onClick={() => setSettingsOpen(false)}><X size={18} /></button></div>
          <p className="modal-description">Mobil uygulamadaki maç girişini burada belirleyin. Yeni sohbetler bu bağlamla açılır.</p>
          <label className="field-label">Maç UUID <span>İsteğe bağlı</span><input value={settingsDraft.matchId} onChange={(event) => setSettingsDraft((draft) => ({ ...draft, matchId: event.target.value }))} placeholder="Örn. cjmgsnh2mcm3fvksvmlyxu3h0" spellCheck={false} /></label>
          <label className="field-label">Lig UUID <span>İsteğe bağlı</span><input value={settingsDraft.competitionId} onChange={(event) => setSettingsDraft((draft) => ({ ...draft, competitionId: event.target.value }))} placeholder="Örn. 482ofyysbdbeoxauk19yg7tdt" spellCheck={false} /></label>
          <label className="field-label">Maç durumu<select value={settingsDraft.matchStatus} onChange={(event) => setSettingsDraft((draft) => ({ ...draft, matchStatus: event.target.value as MatchStatus }))}><option value="Fixture">Maç öncesi</option><option value="Playing">Canlı</option><option value="Played">Maç sonrası</option></select></label>
          <button className="example-context" onClick={() => setSettingsDraft({ matchId: "cjmgsnh2mcm3fvksvmlyxu3h0", competitionId: "482ofyysbdbeoxauk19yg7tdt", matchStatus: "Played" })}><Sparkles size={15} /> Örnek maç: Fenerbahçe – Eyüpspor</button>
          <div className="modal-divider" />
          <label className="field-label">Ekip erişim kodu <span>Sunucuda açıksa</span><input type="password" value={accessToken} onChange={(event) => setAccessToken(event.target.value)} placeholder="Erişim kodu" autoComplete="off" /></label>
          <div className="modal-info"><ShieldCheck size={16} /><span>Erişim kodu yalnızca bu tarayıcı oturumunda saklanır. Sohbet listesi bu cihazda tutulur.</span></div>
          <div className="modal-actions"><button className="cancel-button" onClick={() => setSettingsOpen(false)}>Vazgeç</button><button className="save-button" onClick={saveSettings}>Kaydet</button></div>
        </section>
      </div>}
      <button className="help-button" title="Yardım" aria-label="Yardım" onClick={() => setNotice("Enter gönderir, Shift+Enter yeni satır ekler. Maç bağlamını ayarlardan değiştirebilirsiniz.")}><CircleHelp size={18} /></button>
    </div>
  );
}
