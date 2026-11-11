export type MatchStatus = "Fixture" | "Playing" | "Played";

export type Sport = "football" | "basketball";

export type ChatContext = {
  matchId: string;
  competitionId: string;
  matchStatus: MatchStatus;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: number;
  questionId?: string;
  status?: string;
  error?: boolean;
  stopped?: boolean;
  predefined?: boolean;
  betPrediction?: Record<string, unknown> | null;
};

export type Conversation = {
  id: string;
  sport?: Sport; // eski kayıtlarda yok: futbol
  sessionId: number;
  // Futbol /ask_stream geçmişi session_id'yi değil kullanıcı + maçı anahtar alır (mobil sözleşmesi). Sohbetler
  // birbirine karışmasın diye her sohbet kendi kapsamıyla gönderilir; karttan devam eden sohbet kaynağınınkini alır.
  // Eski kayıtlarda yok: id kullanılır.
  historyScope?: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  context: ChatContext;
  messages: ChatMessage[];
};

// Mobil ekran: Maçkolik competition-service'ten gelen maçın sade hali (/api/matches).
export type MobileMatch = {
  id: string;
  competitionId: string;
  competition: string;
  country: string;
  order: number;            // LEAGUES sırası
  stage: string;            // "5. Hafta · Lig A"
  kickoff: string;          // ISO, UTC
  status: string;           // Maçkolik ham durumu: Fixture | Playing | Played | Postponed | Suspended | Cancelled
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
};

export type MatchesResponse = {
  days: string[];           // İstanbul takvim günleri, YYYY-MM-DD
  matches: MobileMatch[];
  failed: string[];         // alınamayan liglerin adları
  updatedAt: string;
};

export type MaiStreamEvent = {
  type: string;
  data?: {
    seq?: number;
    question_id?: string;
    payload?: { text?: string; bet_prediction?: Record<string, unknown> | null };
  };
};
