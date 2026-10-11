// Real-time moderation for peer interviews (browser-safe, also used on the server).
// "severe" = slurs, threats or sexual harassment → the interview stops at once.
// "profanity" = strong swearing → a strike; three strikes stop the interview.
const SEVERE = [
  /\bn[i1]gg(?:er|a)s?\b/i, /\bf[a@]gg?(?:ot)?s?\b/i, /\bretard(?:ed)?s?\b/i, /\bch[i1]nks?\b/i, /\bsp[i1]cs?\b/i, /\bk[i1]kes?\b/i, /\btr[a@]nn(?:y|ies)\b/i,
  /\bi(?:'ll| will| am going to|'m gonna| gonna) (?:kill|hurt|beat|rape|shoot|stab) you\b/i, /\bkill yourself\b/i, /\bkys\b/i,
  /\bsend (?:me )?nudes\b/i, /\b(?:suck|blow) my\b/i,
];
const PROFANITY = [/\bf+u+c+k+\w*/i, /\bsh[i1]t\w*/i, /\bbitch\w*/i, /\bcunt\w*/i, /\bass(?:hole|hat)s?\b/i, /\bdick(?:head)?s?\b/i, /\bmotherf\w*/i, /\bwh[o0]re\w*/i];

export const MAX_STRIKES = 3;

export function moderate(text: string): { level: "ok" | "profanity" | "severe"; reason?: string } {
  if (SEVERE.some((r) => r.test(text))) return { level: "severe", reason: "Slurs, threats or harassment" };
  if (PROFANITY.some((r) => r.test(text))) return { level: "profanity", reason: "Strong profanity" };
  return { level: "ok" };
}
