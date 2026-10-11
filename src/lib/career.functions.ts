// Career dashboard aggregates for /progress: streaks, goals, Elo history,
// Job Radar tracker with skill gaps, and the P2P interview hub.
// Activity hooks: bumpStreak runs after every graded interview and resume scan.
import { createServerFn } from "@tanstack/react-start";
import { neonExecute, neonQuery } from "./neon.server";
import { requireUser } from "./auth.server";
import { DEFAULT_RATING } from "./mmr.shared";

export const GOAL_LEVELS = ["internship", "new_grad", "experienced"] as const;
export type GoalLevel = (typeof GOAL_LEVELS)[number];
export const LEVEL_BUMPS: Record<GoalLevel, number> = { internship: 50, new_grad: 125, experienced: 150 };

export type StreakInfo = { current: number; longest: number; lastActivity: string | null; freezes: number };
export type EloPoint = { t: string; rating: number };
export type EloSeries = { skill: string; points: EloPoint[] };
export type RadarTrackerRow = {
  jobId: string; title: string; company: string; match: number; status: string;
  missing: string[]; gaps: string[];
};
export type PeerRecent = {
  id: string; role: "candidate" | "interviewer"; job: string | null;
  overall: number | null; at: string; strengths: string[]; improvements: string[];
};
export type PeerActive = { id: string; code: string; status: string; job: string | null };
export type CareerGoal = { targetRole: string | null; targetLevel: GoalLevel; targetElo: number } | null;
export type CareerDashboard = {
  streak: StreakInfo;
  goal: CareerGoal;
  elo: EloSeries[];
  radar: RadarTrackerRow[];
  peerActive: PeerActive[];
  peerRecent: PeerRecent[];
  solo: SoloInterview[];
};
export type SoloInterview = {
  id: string; job: string | null; type: string | null; overall: number | null; at: string;
  strengths: string[]; improvements: string[]; transcript: { speaker: string; text: string }[];
};

const EMPTY_STREAK: StreakInfo = { current: 0, longest: 0, lastActivity: null, freezes: 0 };

/** One row per active day. Yesterday continues the streak; one missed day burns a
 *  streak freeze; anything longer restarts at 1. */
export async function bumpStreak(userId: string): Promise<void> {
  const next = `case
    when public.devup_activity_streak.last_activity_date = current_date then public.devup_activity_streak.current_streak
    when public.devup_activity_streak.last_activity_date = current_date - 1 then public.devup_activity_streak.current_streak + 1
    when public.devup_activity_streak.last_activity_date = current_date - 2 and public.devup_activity_streak.streak_freeze_count > 0 then public.devup_activity_streak.current_streak + 1
    else 1 end`;
  await neonExecute(
    `insert into public.devup_activity_streak (user_id, current_streak, longest_streak, last_activity_date, streak_freeze_count)
     values ($1, 1, 1, current_date, 1)
     on conflict (user_id) do update set
       current_streak = ${next},
       longest_streak = greatest(public.devup_activity_streak.longest_streak, ${next}),
       streak_freeze_count = case
         when public.devup_activity_streak.last_activity_date = current_date - 2 and public.devup_activity_streak.streak_freeze_count > 0
           then public.devup_activity_streak.streak_freeze_count - 1
         else public.devup_activity_streak.streak_freeze_count end,
       last_activity_date = current_date,
       updated_at = now()`,
    [userId],
  );
}

/** A stored streak only counts if activity was today, yesterday, or one missed
 *  day covered by a freeze. Anything older shows as 0, not the stale number. */
export function effectiveStreak(s: { current: number; lastActivity: string | null; freezes: number }): number {
  if (!s.lastActivity || s.current <= 0) return 0;
  const days = Math.floor((Date.now() - new Date(s.lastActivity + "T00:00:00Z").getTime()) / 86400000);
  if (days <= 1) return s.current;
  if (days === 2 && s.freezes > 0) return s.current;
  return 0;
}

/** Lightweight streak read for the top-nav chip. */
export const getStreak = createServerFn({ method: "GET" }).handler(async (): Promise<StreakInfo> => {
  const { currentUser } = await import("./auth.server");
  const user = await currentUser();
  if (!user) return EMPTY_STREAK;
  try {
    const res = await neonQuery<{ rows: { current_streak: number; longest_streak: number; last: string | null; streak_freeze_count: number }[] }>(
      `select current_streak, longest_streak, to_json(last_activity_date) as last, streak_freeze_count
         from public.devup_activity_streak where user_id = $1`,
      [user.id],
    );
    const s = res.rows[0];
    if (!s) return EMPTY_STREAK;
    const info: StreakInfo = {
      current: Number(s.current_streak),
      longest: Number(s.longest_streak),
      lastActivity: s.last ? String(s.last) : null,
      freezes: Number(s.streak_freeze_count),
    };
    return { ...info, current: effectiveStreak(info) };
  } catch {
    return EMPTY_STREAK;
  }
});

export const getCareerDashboard = createServerFn({ method: "GET" }).handler(async (): Promise<CareerDashboard> => {
  const { currentUser } = await import("./auth.server");
  const user = await currentUser();
  if (!user) return { streak: EMPTY_STREAK, goal: null, elo: [], radar: [], peerActive: [], peerRecent: [], solo: [] };
  try {
    const [streak, goal, log, ratings, profile, radar, peers, solos] = await Promise.all([
      neonQuery(
        `select current_streak, longest_streak, to_json(last_activity_date) as last, streak_freeze_count
           from public.devup_activity_streak where user_id = $1`,
        [user.id],
      ),
      neonQuery(
        `select target_role, target_level, target_elo from public.devup_career_goal where user_id = $1`,
        [user.id],
      ),
      neonQuery(
        `select skill_name, rating, to_json(created_at) as at from public.devup_skill_rating_log
          where user_id = $1 and created_at >= now() - interval '90 days' order by created_at`,
        [user.id],
      ),
      neonQuery(
        `select skill_name, rating, to_json(last_updated) as at from public.devup_skill_rating where user_id = $1::uuid`,
        [user.id],
      ),
      neonQuery(`select skills from public.devup_profile where id = $1`, [user.id]),
      neonQuery(
        `select job_id, status, data from public.devup_job_radar
          where user_id = $1 and status in ('saved','applied','interviewing') order by updated_at desc limit 20`,
        [user.id],
      ),
      neonQuery(
        `select id::text as id, code, status, job->>'title' as job, host_role, host_id::text = $1 as me_host,
                grade, interviewer_grade, to_json(created_at) as at
           from public.devup_peer_session where (host_id::text = $1 or guest_id::text = $1)
           order by created_at desc limit 12`,
        [user.id],
      ),
      neonQuery(
        `select id::text as id, job, type, overall, grade, transcript, to_json(created_at) as at
           from public.devup_interview where user_id = $1 and deleted_at is null order by created_at desc limit 20`,
        [user.id],
      ),
    ]);

    // First visit: seed the Elo log with the current ratings so the chart has an origin.
    if (log.rows.length === 0 && ratings.rows.length) {
      await neonExecute(
        `insert into public.devup_skill_rating_log (user_id, skill_name, rating, created_at)
         select $1::text, skill_name, rating, last_updated from public.devup_skill_rating where user_id = $1::uuid
         and not exists (select 1 from public.devup_skill_rating_log l where l.user_id = $1::text)`,
        [user.id],
      );
      log.rows.push(...ratings.rows.map((r) => ({ skill_name: r["skill_name"], rating: r["rating"], at: r["at"] })));
    }

    const bySkill = new Map<string, EloPoint[]>();
    for (const r of log.rows) {
      const skill = String(r["skill_name"]);
      const list = bySkill.get(skill) ?? [];
      list.push({ t: String(r["at"]), rating: Number(r["rating"]) });
      bySkill.set(skill, list);
    }
    const elo: EloSeries[] = [...bySkill.entries()]
      .map(([skill, points]) => ({ skill, points: points.sort((a, b) => a.t.localeCompare(b.t)) }))
      .sort((a, b) => a.skill.localeCompare(b.skill));

    const profileSkills = new Set(((profile.rows[0]?.["skills"] as string[] | null) ?? []).map((s) => s.toLowerCase()));
    const ratingBySkill = new Map(
      ratings.rows.map((r) => [String(r["skill_name"]).toLowerCase(), Number(r["rating"]) as number]),
    );
    const goalRow = goal.rows[0];
    const level = (GOAL_LEVELS.includes(goalRow?.["target_level"] as GoalLevel) ? goalRow?.["target_level"] : "new_grad") as GoalLevel;
    const bump = LEVEL_BUMPS[level];
    const radarRows: RadarTrackerRow[] = radar.rows.map((r) => {
      const data = (r["data"] ?? {}) as { title?: string; company?: string; match?: number; skills?: string[] };
      const skills = Array.isArray(data.skills) ? data.skills : [];
      const missing = skills.filter((s) => !profileSkills.has(s.toLowerCase()) && !ratingBySkill.has(s.toLowerCase())).slice(0, 4);
      const gaps = skills
        .filter((s) => ratingBySkill.has(s.toLowerCase()))
        .map((s) => {
          const target = (ratingBySkill.get(s.toLowerCase()) as number) + bump;
          return target > ratingBySkill.get(s.toLowerCase())! ? { s, need: target - ratingBySkill.get(s.toLowerCase())! } : null;
        })
        .filter((g): g is { s: string; need: number } => !!g && g.need > 0)
        .slice(0, 4)
        .map((g) => `${g.s} needs +${g.need} Elo`);
      return {
        jobId: String(r["job_id"]), title: String(data.title ?? "Role"), company: String(data.company ?? ""),
        match: Number(data.match ?? 0), status: String(r["status"]),
        missing, gaps,
      };
    });

    const peerActive: PeerActive[] = [];
    const peerRecent: PeerRecent[] = [];
    for (const r of peers.rows) {
      const role: "candidate" | "interviewer" =
        ((r["me_host"] === true) === (r["host_role"] === "interviewer")) ? "interviewer" : "candidate";
      if (r["status"] === "waiting" || r["status"] === "live") {
        peerActive.push({ id: String(r["id"]), code: String(r["code"]), status: String(r["status"]), job: (r["job"] as string | null) ?? null });
        continue;
      }
      if (r["status"] !== "done") continue;
      const g = (role === "interviewer" ? r["interviewer_grade"] : r["grade"]) as
        | { overall?: number; strengths?: string[]; improvements?: string[] }
        | null;
      peerRecent.push({
        id: String(r["id"]), role, job: (r["job"] as string | null) ?? null,
        overall: g && typeof g.overall === "number" ? Math.round(g.overall) : null,
        at: String(r["at"] ?? ""),
        strengths: (g?.strengths ?? []).slice(0, 3),
        improvements: (g?.improvements ?? []).slice(0, 3),
      });
    }

    const s = streak.rows[0];
    const streakInfo: StreakInfo = s
      ? { current: Number(s["current_streak"]), longest: Number(s["longest_streak"]), lastActivity: (s["last"] as string | null) ?? null, freezes: Number(s["streak_freeze_count"]) }
      : EMPTY_STREAK;
    return {
      streak: { ...streakInfo, current: effectiveStreak(streakInfo) },
      goal: goalRow
        ? { targetRole: (goalRow["target_role"] as string | null) ?? null, targetLevel: level, targetElo: Number(goalRow["target_elo"]) }
        : null,
      elo, radar: radarRows, peerActive, peerRecent: peerRecent.slice(0, 6),
      solo: solos.rows.map((r) => {
        const g = (r["grade"] ?? {}) as { strengths?: string[]; improvements?: string[] };
        const t = Array.isArray(r["transcript"]) ? (r["transcript"] as { speaker: string; text: string }[]) : [];
        return {
          id: String(r["id"]), job: (r["job"] as string | null) ?? null, type: (r["type"] as string | null) ?? null,
          overall: r["overall"] == null ? null : Number(r["overall"]), at: String(r["at"] ?? ""),
          strengths: (g.strengths ?? []).slice(0, 3), improvements: (g.improvements ?? []).slice(0, 3),
          transcript: t.map((x) => ({ speaker: String(x.speaker), text: String(x.text) })),
        };
      }),
    };
  } catch (e) {
    console.error("career dashboard failed", e);
    return { streak: EMPTY_STREAK, goal: null, elo: [], radar: [], peerActive: [], peerRecent: [], solo: [] };
  }
});

/** Soft-delete a saved interview; the row stays in the table but leaves Career. */
export const trashInterview = createServerFn({ method: "POST" })
  .inputValidator((i: { id: unknown }) => ({ id: String(i.id ?? "") }))
  .handler(async ({ data }) => {
    const { requireUser } = await import("./auth.server");
    const user = await requireUser();
    const { neonExecute } = await import("./neon.server");
    await neonExecute(
      "update public.devup_interview set deleted_at = now() where id = $1::uuid and user_id = $2",
      [data.id, user.id],
    );
    return { ok: true };
  });

export const saveCareerGoal = createServerFn({ method: "POST" })
  .inputValidator((i: { targetRole?: unknown; targetLevel?: unknown }) => ({
    targetRole: typeof i.targetRole === "string" ? i.targetRole.trim().slice(0, 100) || null : null,
    targetLevel: (GOAL_LEVELS.includes(i.targetLevel as GoalLevel) ? i.targetLevel : "new_grad") as GoalLevel,
  }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const targetElo = DEFAULT_RATING + (LEVEL_BUMPS[data.targetLevel] ?? 125);
    await neonExecute(
      `insert into public.devup_career_goal (user_id, target_role, target_level, target_elo, updated_at)
       values ($1, $2, $3, $4, now())
       on conflict (user_id) do update set
         target_role = excluded.target_role, target_level = excluded.target_level,
         target_elo = excluded.target_elo, updated_at = now()`,
      [user.id, data.targetRole, data.targetLevel, targetElo],
    );
    return { ok: true as const, targetElo };
  });
