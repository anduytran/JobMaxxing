import { createServerFn } from "@tanstack/react-start";
import { neonExecute, neonQuery, neonUserError } from "./neon.server";
import { currentUser, requireUser } from "./auth.server";

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

export type QuestPeriod = "once" | "daily" | "weekly";
export type Quest = {
  id: string;
  title: string;
  xp: number;
  category: string;
  done: boolean;
  period: QuestPeriod;
};

export type StudentInfo = { school?: string; degree?: string; major?: string; gradYear?: string };
export type JobPrefs = { roles?: string; locations?: string; workMode?: string; salary?: string };
export type ResumeInfo = { fileName: string; text: string; uploadedAt: string } | null;

export type GameState = {
  ok: true;
  email: string;
  skills: string[];
  student: StudentInfo;
  jobPrefs: JobPrefs;
  resume: ResumeInfo;
  name: string;
  title: string;
  xp: number;
  roast: boolean;
  reducedMotion: boolean;
  quests: Quest[];
};

export type SaveResult = { ok: true; xp?: number } | { ok: false; error: string };


/** Active 1.5x store booster, if any — multiplies XP (and therefore points). */
async function xpBoost(userId: string): Promise<number> {
  const { rows } = await neonExecute(
    "select multiplier from public.devup_booster where user_id = $1 and expires_at > now() order by expires_at desc limit 1",
    [userId],
  );
  return Number(rows[0]?.multiplier ?? 1) || 1;
}

function fail(err: unknown): SaveResult {
  if (err instanceof Error && err.message === "Please sign in.") return { ok: false, error: err.message };
  const { message } = neonUserError(err);
  console.error(err);
  return { ok: false, error: message };
}

// ---------------------------------------------------------------------------
// Input validation — bound every value, allowlist identifiers.
// ---------------------------------------------------------------------------

const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (s.length === 0 || s.length > max) return null;
  return s;
};

const questId = (v: unknown): string | null => {
  const s = clean(v, 40);
  return s && /^[a-z0-9_-]+$/i.test(s) ? s : null;
};

const int = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const loadGame = createServerFn({ method: "GET" }).handler(
  async (): Promise<GameState | { ok: false; error: string; signedOut?: boolean }> => {
    try {
      const user = await currentUser();
      if (!user) return { ok: false, error: "Not signed in", signedOut: true };
      const PROFILE_ID = user.id;
      // Reset schedules live in Neon: daily quests flip back at midnight UTC,
      // weekly quests at the start of the week. The resets and the reads run
      // as one transaction, so a reset can never be missed or half-applied.
      const { results } = await neonExecute<{ results: any[] }>([
        {
          query:
            "update public.devup_quest set done = false, completed_at = null " +
            "where user_id = $1 and period = 'daily' and done and completed_at < date_trunc('day', now())",
          params: [PROFILE_ID],
        },
        {
          query:
            "update public.devup_quest set done = false, completed_at = null " +
            "where user_id = $1 and period = 'weekly' and done and completed_at < date_trunc('week', now())",
          params: [PROFILE_ID],
        },
        {
          query:
            "select name, title, xp, roast, reduced_motion, skills, student, job_prefs, resume " +
            "from public.devup_profile where id = $1 limit 1",
          params: [PROFILE_ID],
        },
        {
          query:
            "select id, title, xp, category, done, period " +
            "from public.devup_quest where user_id = $1 order by sort_order asc, id asc limit 200",
          params: [PROFILE_ID],
        },
      ]);
      const profile = results[2]?.rows?.[0];
      const questPeriod = (v: unknown): QuestPeriod => (v === "daily" || v === "weekly" ? v : "once");
      return {
        ok: true,
        email: user.email,
        skills: Array.isArray(profile?.skills) ? profile.skills.map(String) : [],
        student: (profile?.student ?? {}) as StudentInfo,
        jobPrefs: (profile?.job_prefs ?? {}) as JobPrefs,
        resume: (profile?.resume ?? null) as ResumeInfo,
        name: String(profile?.name ?? "Alex Rivera"),
        title: String(profile?.title ?? "Junior Full-Stack Developer"),
        xp: Number(profile?.xp ?? 0),
        roast: Boolean(profile?.roast ?? false),
        reducedMotion: Boolean(profile?.reduced_motion ?? false),
        quests: (results[3]?.rows ?? []).map((r: any) => ({
          id: String(r.id),
          title: String(r.title),
          xp: Number(r.xp),
          category: String(r.category),
          done: Boolean(r.done),
          period: questPeriod(r.period),
        })),
      };
    } catch (err) {
      const { message } = neonUserError(err);
      console.error(err);
      return { ok: false, error: message };
    }
  },
);

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export const saveProfile = createServerFn({ method: "POST" })
  .inputValidator((input: { name: unknown; title: unknown }) => {
    const name = clean(input.name, 80);
    const title = clean(input.title, 120);
    if (!name || !title) throw new Error("Name and title are both required.");
    return { name, title };
  })
  .handler(async ({ data }): Promise<SaveResult> => {
    try {
      const PROFILE_ID = (await requireUser()).id;
      await neonExecute(
        "update public.devup_profile set name = $1, title = $2, updated_at = now() where id = $3",
        [data.name, data.title, PROFILE_ID],
      );
      return { ok: true };
    } catch (err) {
      return fail(err);
    }
  });

export const saveRoast = createServerFn({ method: "POST" })
  .inputValidator((input: { roast: unknown }) => {
    if (typeof input.roast !== "boolean") throw new Error("Roast must be true or false.");
    return { roast: input.roast };
  })
  .handler(async ({ data }): Promise<SaveResult> => {
    try {
      const PROFILE_ID = (await requireUser()).id;
      await neonExecute(
        "update public.devup_profile set roast = $1, updated_at = now() where id = $2",
        [data.roast, PROFILE_ID],
      );
      return { ok: true };
    } catch (err) {
      return fail(err);
    }
  });

export const saveReducedMotion = createServerFn({ method: "POST" })
  .inputValidator((input: { reducedMotion: unknown }) => {
    if (typeof input.reducedMotion !== "boolean") throw new Error("Motion preference must be true or false.");
    return { reducedMotion: input.reducedMotion };
  })
  .handler(async ({ data }): Promise<SaveResult> => {
    try {
      const PROFILE_ID = (await requireUser()).id;
      await neonExecute(
        "update public.devup_profile set reduced_motion = $1, updated_at = now() where id = $2",
        [data.reducedMotion, PROFILE_ID],
      );
      return { ok: true };
    } catch (err) {
      return fail(err);
    }
  });

/**
 * Marks one quest done and awards its XP in a single transaction. The CTE only
 * returns a row when the quest flips from not-done to done, so a double click
 * can never award XP twice.
 */
export const completeQuest = createServerFn({ method: "POST" })
  .inputValidator((input: { id: unknown }) => {
    const id = questId(input.id);
    if (!id) throw new Error("Unknown quest.");
    return { id };
  })
  .handler(async ({ data }): Promise<SaveResult> => {
    try {
      const PROFILE_ID = (await requireUser()).id;
      const { rows } = await neonExecute(
        `with q as (
           update public.devup_quest
              set done = true, completed_at = now()
            where id = $1 and user_id = $2 and done = false
            returning xp
         ),
         e as (
           insert into public.devup_xp_event (amount, reason, user_id)
           select xp, 'quest:' || $1, $2 from q
         ),
         p as (
           update public.devup_profile
              set xp = xp + (select coalesce(sum(xp), 0) from q), updated_at = now()
            where id = $2
            returning xp
         )
         select (select coalesce(sum(xp), 0) from q)::int as awarded,
                (select xp from p)::int as xp`,
        [data.id, PROFILE_ID],
      );
      const awarded = Number(rows[0]?.["awarded"] ?? 0);
      if (awarded === 0) return { ok: true }; // already done — nothing to award
      return { ok: true, xp: Number(rows[0]?.["xp"] ?? 0) };
    } catch (err) {
      return fail(err);
    }
  });

export const addQuest = createServerFn({ method: "POST" })
  .inputValidator((input: { id: unknown; title: unknown; xp: unknown; category: unknown; period?: unknown }) => {
    const id = questId(input.id);
    const title = clean(input.title, 120);
    const category = clean(input.category, 40);
    let xp = int(input.xp, 1, 5000);
    const period = input.period === "daily" || input.period === "weekly" ? input.period : "once";
    if (!id || !title || !category || xp === null) throw new Error("Invalid quest.");
    // Custom quests are user-written, so they earn reduced XP.
    if (id.startsWith("custom-")) xp = Math.min(xp, 75);
    return { id, title, category, xp, period };
  })
  .handler(async ({ data }): Promise<SaveResult> => {
    try {
      const PROFILE_ID = (await requireUser()).id;
      await neonExecute(
        `insert into public.devup_quest (id, title, xp, category, period, sort_order, user_id)
         values ($1, $2, $3, $4, $5, -1, $6)
         on conflict (user_id, id) do nothing`,
        [data.id, data.title, data.xp, data.category, data.period, PROFILE_ID],
      );
      return { ok: true };
    } catch (err) {
      return fail(err);
    }
  });

export const removeQuest = createServerFn({ method: "POST" })
  .inputValidator((input: { id: unknown }) => {
    const id = questId(input.id);
    if (!id) throw new Error("Invalid quest.");
    return { id };
  })
  .handler(async ({ data }): Promise<SaveResult> => {
    try {
      const PROFILE_ID = (await requireUser()).id;
      await neonExecute("delete from public.devup_quest where user_id = $1 and id = $2", [PROFILE_ID, data.id]);
      return { ok: true };
    } catch (err) {
      return fail(err);
    }
  });

export const gainXp = createServerFn({ method: "POST" })
  .inputValidator((input: { amount: unknown; reason: unknown }) => {
    const amount = int(input.amount, 1, 2000);
    const reason = clean(input.reason, 80);
    if (amount === null || !reason) throw new Error("Invalid XP award.");
    return { amount, reason };
  })
  .handler(async ({ data }): Promise<SaveResult> => {
    try {
      const PROFILE_ID = (await requireUser()).id;
      const { results } = await neonExecute<{ results: any[] }>([
        {
          query: "insert into public.devup_xp_event (amount, reason, user_id) values ($1, $2, $3)",
          params: [data.amount, data.reason, PROFILE_ID],
        },
        {
          query:
            "update public.devup_profile set xp = xp + $1, updated_at = now() where id = $2 returning xp",
          params: [data.amount, PROFILE_ID],
        },
      ]);
      return { ok: true, xp: Number(results[1]?.rows?.[0]?.xp ?? 0) };
    } catch (err) {
      return fail(err);
    }
  });

const obj = (v: unknown, keys: string[]): Record<string, string> => {
  const out: Record<string, string> = {};
  if (v && typeof v === "object") for (const k of keys) {
    const x = (v as Record<string, unknown>)[k];
    if (typeof x === "string" && x.trim()) out[k] = x.trim().slice(0, 200);
  }
  return out;
};

/** Saves the profile details the MVP needs: skills, student info, job preferences, current resume. */
export const saveDetails = createServerFn({ method: "POST" })
  .inputValidator((input: { skills?: unknown; student?: unknown; jobPrefs?: unknown; resume?: unknown }) => {
    const skills = Array.isArray(input.skills)
      ? [...new Set(input.skills.map((x) => clean(x, 40)).filter((x): x is string => !!x))].slice(0, 60)
      : null;
    const student = input.student === undefined ? null : obj(input.student, ["school", "degree", "major", "gradYear"]);
    const jobPrefs = input.jobPrefs === undefined ? null : obj(input.jobPrefs, ["roles", "locations", "workMode", "salary"]);
    let resume: unknown = undefined;
    if (input.resume !== undefined) {
      const r = input.resume as { fileName?: unknown; text?: unknown } | null;
      resume = r === null ? null : {
        fileName: clean(r.fileName, 200) ?? "resume",
        text: typeof r.text === "string" ? r.text.slice(0, 50_000) : "",
        uploadedAt: new Date().toISOString(),
      };
    }
    return { skills, student, jobPrefs, resume };
  })
  .handler(async ({ data }): Promise<SaveResult> => {
    try {
      const PROFILE_ID = (await requireUser()).id;
      await neonExecute(
        `update public.devup_profile set
           skills = coalesce($2::text[], skills),
           student = coalesce($3::jsonb, student),
           job_prefs = coalesce($4::jsonb, job_prefs),
           resume = case when $5::boolean then $6::jsonb else resume end,
           updated_at = now()
         where id = $1`,
        [PROFILE_ID, data.skills, data.student, data.jobPrefs, data.resume !== undefined, data.resume ?? null],
      );
      return { ok: true };
    } catch (err) {
      return fail(err);
    }
  });
