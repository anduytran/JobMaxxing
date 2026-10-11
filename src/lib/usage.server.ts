// Token accounting. Every AI call records what it cost into public.devup_token_usage
// so the Settings page can show a running total and a per-action breakdown.
//
// Raia reports real token counts on /external/prompts (`totalTokens`, `usage.totalTokens`).
// The conversation endpoint and ElevenLabs don't, so those fall back to a character
// estimate (~4 chars per token). The UI labels the figure as "up to" when any row is estimated.
import { neonExecute, neonQuery } from "./neon.server";

/** Action labels stored in the `agent` column. Keep in sync with the UI's friendly names. */
export const USAGE_ACTIONS = [
  "job parse", "radar titles", "interview questions", "interview turns", "interview grade",
  "interviewer grade", "resume grade", "resume fixes", "skill ratings", "skill check", "voice",
] as const;
export type UsageAction = (typeof USAGE_ACTIONS)[number];

const ACTION_SET = new Set<string>(USAGE_ACTIONS);

/** Rough token count from raw text — used only when the provider reports nothing. */
export const estimateTokens = (text: string) => Math.max(1, Math.round(text.length / 4));

/**
 * Real tokens when the provider reported them, otherwise an estimate of the
 * prompt + reply that went through the model.
 */
export function tokensFrom(body: unknown, promptAndReply: string): number {
  const b = body as { totalTokens?: unknown; usage?: { totalTokens?: unknown } } | null;
  const reported = Number(b?.totalTokens ?? b?.usage?.totalTokens ?? 0);
  return Number.isFinite(reported) && reported > 0 ? Math.round(reported) : estimateTokens(promptAndReply);
}

/**
 * Record one AI action. Never throws — a failed bookkeeping write must not break
 * the interview, grade or scan that paid for it.
 */
export async function recordTokenUsage(userId: string | undefined, action: UsageAction, tokens: number): Promise<void> {
  const n = Math.round(Number(tokens) || 0);
  // Demo guests have no account id; only real (uuid) accounts are counted.
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId) || !n || !ACTION_SET.has(action)) return;
  try {
    await neonExecute(
      `insert into public.devup_token_usage (user_id, agent, tokens) values ($1::uuid, $2, $3)`,
      [userId, action, n],
    );
  } catch (err) {
    console.error("token usage record failed", err);
  }
}

export type UsageRow = { action: UsageAction; tokens: number; calls: number; estimated: boolean };
export type UsageSummary = {
  total: number;
  calls: number;
  hasEstimates: boolean;
  byAction: UsageRow[];
  recent: { action: UsageAction; tokens: number; at: string }[];
};

/**
 * The signed-in user's totals, grouped by action (biggest first) plus the last few
 * actions. Three reads in one transaction so the panel never shows half a picture.
 */
export async function getTokenUsageSummary(userId: string): Promise<UsageSummary> {
  const { results } = await neonQuery<{ results: { rows: Record<string, unknown>[] }[] }>([
    {
      query: `select agent, sum(tokens)::int as tokens, count(*)::int as calls,
                     bool_or(agent in ('interview turns','voice')) as estimated
                from public.devup_token_usage where user_id = $1::uuid
               group by agent order by sum(tokens) desc limit 20`,
      params: [userId],
    },
    {
      query: `select coalesce(sum(tokens),0)::int as total, count(*)::int as calls
                from public.devup_token_usage where user_id = $1::uuid`,
      params: [userId],
    },
    {
      query: `select agent, tokens, to_json(created_at) as at
                from public.devup_token_usage where user_id = $1::uuid
               order by created_at desc, id desc limit 8`,
      params: [userId],
    },
  ]);

  const byAction: UsageRow[] = (results[0]?.rows ?? []).map((r) => ({
    action: String(r["agent"]) as UsageAction,
    tokens: Number(r["tokens"]) || 0,
    calls: Number(r["calls"]) || 0,
    estimated: r["estimated"] === true,
  }));
  const totals = results[1]?.rows[0] ?? {};
  const recent = (results[2]?.rows ?? []).map((r) => ({
    action: String(r["agent"]) as UsageAction,
    tokens: Number(r["tokens"]) || 0,
    at: String(r["at"] ?? "").replace(/^"|"$/g, ""),
  }));

  return {
    total: Number(totals["total"]) || 0,
    calls: Number(totals["calls"]) || 0,
    hasEstimates: byAction.some((r) => r.estimated),
    byAction,
    recent,
  };
}
