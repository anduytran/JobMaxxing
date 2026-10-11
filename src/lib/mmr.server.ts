// Elo/MMR adaptive skill rating. Server-only: called after an interview is graded.
import { neonExecute, neonQuery } from "./neon.server";
import type { InterviewQuestion } from "./interview/types";

import { RATING_MIN, RATING_MAX, DEFAULT_RATING } from "./mmr.shared";
export { RATING_MIN, RATING_MAX, DEFAULT_RATING };
const PLACEMENT_QUESTIONS = 10;
const K_PLACEMENT = 40;
const K_STANDARD = 16;
const SESSION_CAP = 75;
const STALE_DAYS = 60;

export type RatingChange = { skill: string; before: number; after: number; answered: number };

export const expected = (rating: number, difficulty: number) => 1 / (1 + 10 ** ((difficulty - rating) / 400));
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
export const tierFor = (difficulty: number) => clamp(Math.floor((difficulty - RATING_MIN) / 160) + 1, 1, 5);
export const skillOf = (q: Pick<InterviewQuestion, "skill" | "kind">) =>
  (q.skill?.trim() || (q.kind === "behavioral" ? "Behavioral" : "Technical")).slice(0, 100);

async function sha(text: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text.trim().toLowerCase()));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/**
 * Applies one session's results. `items` pairs each answered question with a 0–1 score.
 * K = 40 for a skill's first 10 questions, else 16; ×1.5 after 60+ idle days; each skill moves at most ±75 per session.
 * Question difficulty is calibrated in the opposite direction with K = 16.
 */
export async function applySessionRatings(userId: string, items: { q: InterviewQuestion; score: number }[]): Promise<RatingChange[]> {
  if (!items.length) return [];
  const skills = [...new Set(items.map((i) => skillOf(i.q)))];
  const { rows } = await neonQuery(
    `select skill_name, rating, questions_answered, extract(epoch from now() - last_updated)/86400 as idle
       from public.devup_skill_rating where user_id = $1::uuid and skill_name = any($2)`,
    [userId, skills],
  );
  const state = new Map<string, { start: number; rating: number; answered: number; stale: boolean }>();
  for (const s of skills) {
    const r = rows.find((x) => x["skill_name"] === s);
    const rating = r ? Number(r["rating"]) : DEFAULT_RATING;
    state.set(s, { start: rating, rating, answered: r ? Number(r["questions_answered"]) : 0, stale: r ? Number(r["idle"]) > STALE_DAYS : false });
  }

  const results: { query: string; params: unknown[] }[] = [];
  for (const { q, score } of items) {
    const skill = skillOf(q);
    const st = state.get(skill)!;
    const hash = await sha(q.text);
    const { rows: qr } = await neonExecute(
      `insert into public.devup_question (skill_name, prompt_text, prompt_hash) values ($1, $2, $3)
       on conflict (prompt_hash) do update set skill_name = excluded.skill_name returning id::text as id, difficulty_rating`,
      [skill, q.text.slice(0, 2000), hash],
    );
    const qid = String(qr[0]?.["id"]);
    const difficulty = Number(qr[0]?.["difficulty_rating"] ?? DEFAULT_RATING);
    const s = clamp(score, 0, 1);
    const e = expected(st.rating, difficulty);
    let k = st.answered < PLACEMENT_QUESTIONS ? K_PLACEMENT : K_STANDARD;
    if (st.stale) k *= 1.5;
    const before = st.rating;
    const raw = before + k * (s - e);
    const after = Math.round(clamp(clamp(raw, st.start - SESSION_CAP, st.start + SESSION_CAP), RATING_MIN, RATING_MAX));
    st.rating = after;
    st.answered += 1;
    const newDiff = Math.round(clamp(difficulty - K_STANDARD * (s - e), RATING_MIN, RATING_MAX));
    results.push(
      { query: "update public.devup_question set difficulty_rating = $2, tier_level = $3 where id = $1::uuid", params: [qid, newDiff, tierFor(newDiff)] },
      {
        query: `insert into public.devup_question_result (user_id, question_id, score, rating_before, rating_after) values ($1::uuid, $2::uuid, $3, $4, $5)`,
        params: [userId, qid, s.toFixed(2), before, after],
      },
    );
  }
  for (const [skill, st] of state) {
    results.push({
      query: `insert into public.devup_skill_rating (user_id, skill_name, rating, questions_answered, last_updated) values ($1::uuid, $2, $3, $4, now())
              on conflict (user_id, skill_name) do update set rating = excluded.rating, questions_answered = excluded.questions_answered, last_updated = now()`,
      params: [userId, skill, st.rating, st.answered],
    });
  }
  await neonExecute(results);
  return [...state].map(([skill, st]) => ({ skill, before: st.start, after: st.rating, answered: st.answered }));
}

/** Questions actually asked in the interview phase, scored from the grade's answer-quality metric. */
export function scoredItems(plan: InterviewQuestion[], asked: number, qualityPct: number) {
  return plan.slice(0, Math.max(0, asked)).map((q) => ({ q, score: clamp(qualityPct / 100, 0, 1) }));
}

export async function listRatings(userId: string) {
  const { rows } = await neonQuery(
    `select skill_name, rating, questions_answered from public.devup_skill_rating where user_id = $1::uuid order by rating desc limit 50`,
    [userId],
  );
  return rows.map((r) => ({ skill: String(r["skill_name"]), rating: Number(r["rating"]), answered: Number(r["questions_answered"]) }));
}
