import { createServerFn } from "@tanstack/react-start";

export type TokenUsage = {
  total: number;
  calls: number;
  byAgent: { agent: string; label: string; tokens: number; calls: number }[];
  recent: { agent: string; label: string; tokens: number; at: string }[];
};

const LABELS: Record<string, string> = {
  job_parser: "Job Parser",
  question_agent: "Interview questions",
  grader: "Interview grader",
  resume_grader: "Resume grader",
  skill_expert: "Skill Expert",
};
const label = (a: string) => LABELS[a] ?? a;

/** The signed-in user's AI token usage (estimated chars/4 per agent call). */
export const getTokenUsage = createServerFn({ method: "GET" }).handler(async (): Promise<TokenUsage> => {
  const { requireUser } = await import("./auth.server");
  const user = await requireUser();
  const { neonQuery } = await import("./neon.server");
  const [tot, byAgent, recent] = await Promise.all([
    neonQuery(`select coalesce(sum(tokens),0)::int as tokens, count(*)::int as calls from public.devup_token_usage where user_id = $1::uuid`, [user.id]),
    neonQuery(`select agent, sum(tokens)::int as tokens, count(*)::int as calls from public.devup_token_usage where user_id = $1::uuid group by agent order by tokens desc`, [user.id]),
    neonQuery(`select agent, tokens, created_at from public.devup_token_usage where user_id = $1::uuid order by created_at desc limit 10`, [user.id]),
  ]);
  return {
    total: Number(tot.rows[0]?.["tokens"] ?? 0),
    calls: Number(tot.rows[0]?.["calls"] ?? 0),
    byAgent: byAgent.rows.map((r) => ({ agent: String(r["agent"]), label: label(String(r["agent"])), tokens: Number(r["tokens"]), calls: Number(r["calls"]) })),
    recent: recent.rows.map((r) => ({ agent: String(r["agent"]), label: label(String(r["agent"])), tokens: Number(r["tokens"]), at: String(r["created_at"]) })),
  };
});
