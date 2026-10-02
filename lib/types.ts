export type MatchStatus = "Fixture" | "Playing" | "Played";

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
  sessionId: number;
  title: string;
  createdAt: number;
  updatedAt: number;
  context: ChatContext;
  messages: ChatMessage[];
};

export type MaiStreamEvent = {
  type: string;
  data?: {
    seq?: number;
    question_id?: string;
    payload?: { text?: string; bet_prediction?: Record<string, unknown> | null };
  };
};
