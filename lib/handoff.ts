// Mobil maç ekranı → sohbet ekranı geçişi. Sohbet /?match_id=…&competition_id=…&match_status=…&title=…
// adresiyle açılır; karttan devam ediliyorsa &question_id=… eklenir ve kartın metni sessionStorage'dan okunur.
export const USER_KEY = "mai-stream-ui:user:v1";
export const TOKEN_KEY = "mai-stream-ui:token:v1";
export const HANDOFF_KEY = "mai-stream-ui:handoff:v1";

// /ask_stream geçmişi ve kart cevapları kullanıcı + maç anahtarıyla saklanır. Mobil ekran ve oradan açılan sohbet
// aynı kullanıcı kimliğini (`<kullanıcı>:mobil`) kullanır; böylece sohbet, uygulamadaki gibi kart cevabından sürer.
export const MOBILE_HISTORY_SCOPE = "mobil";

export type HandoffCard = {
  questionId: string;
  question: string;
  answer: string;
  betPrediction?: Record<string, unknown> | null;
};
