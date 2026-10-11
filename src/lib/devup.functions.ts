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
  largeText: boolean;
  highContrast: boolean;
  dyslexiaFont: boolean;
  captions: boolean;
  activeTitle: string | null;
  activeTheme: string;
  avatarUrl: string | null;
  quests: Quest[];
};

export type SaveResult = { ok: true; xp?: number; paid?: number } | { ok: false; error: string };


/** Active 1.5x store booster, if any — multiplies XP (and therefore points). */
async function xpBoost(userId: string): Promise<number> {
  const { rows } = await neonExecute(
    "select multiplier from public.devup_booster where user_id = $1 and expires_at > now() order by expires_at desc limit 1",
    [userId],
  );
  return Number(rows[0]?.["multiplier"] ?? 1) || 1;
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
            "select name, title, xp, roast, reduced_motion, large_text, high_contrast, dyslexia_font, captions, skills, student, job_prefs, resume, active_title, active_theme, avatar_url " +
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
        largeText: Boolean(profile?.large_text ?? false),
        highContrast: Boolean(profile?.high_contrast ?? false),
        dyslexiaFont: Boolean(profile?.dyslexia_font ?? false),
        captions: profile?.captions == null ? true : Boolean(profile.captions),
        activeTitle: profile?.active_title ? String(profile.active_title) : null,
        activeTheme: String(profile?.active_theme ?? "default"),
        avatarUrl: profile?.avatar_url ? String(profile.avatar_url) : null,
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

// Profile picture: stored as a small data URL (the client pre-resizes to
// 256px), so no file storage is needed. Null clears it back to initials.
export const saveAvatar = createServerFn({ method: "POST" })
  .inputValidator((input: { avatarUrl: unknown }) => {
    const v = input.avatarUrl;
    if (v === null) return { avatarUrl: null };
    if (typeof v !== "string" || !/^data:image\/(png|jpeg|webp);base64,/.test(v) || v.length > 400_000) {
      throw new Error("Choose a PNG, JPG, or WebP image.");
    }
    return { avatarUrl: v };
  })
  .handler(async ({ data }): Promise<SaveResult> => {
    try {
      const PROFILE_ID = (await requireUser()).id;
      await neonExecute(
        "update public.devup_profile set avatar_url = $1, updated_at = now() where id = $2",
        [data.avatarUrl, PROFILE_ID],
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

export const saveLargeText = createServerFn({ method: "POST" })
  .inputValidator((input: { largeText: unknown }) => {
    if (typeof input.largeText !== "boolean") throw new Error("Text size preference must be true or false.");
    return { largeText: input.largeText };
  })
  .handler(async ({ data }): Promise<SaveResult> => {
    try {
      const PROFILE_ID = (await requireUser()).id;
      await neonExecute(
        "update public.devup_profile set large_text = $1, updated_at = now() where id = $2",
        [data.largeText, PROFILE_ID],
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

// The remaining accessibility switches travel together: high contrast,
// dyslexia-friendly text, and interview captions.
export const saveAccessibility = createServerFn({ method: "POST" })
  .inputValidator((input: { highContrast: unknown; dyslexiaFont: unknown; captions: unknown }) => {
    for (const k of ["highContrast", "dyslexiaFont", "captions"] as const) {
      if (typeof input[k] !== "boolean") throw new Error("Accessibility preferences must be true or false.");
    }
    return { highContrast: input.highContrast, dyslexiaFont: input.dyslexiaFont, captions: input.captions };
  })
  .handler(async ({ data }): Promise<SaveResult> => {
    try {
      const PROFILE_ID = (await requireUser()).id;
      await neonExecute(
        "update public.devup_profile set high_contrast = $1, dyslexia_font = $2, captions = $3, updated_at = now() where id = $4",
        [data.highContrast, data.dyslexiaFont, data.captions, PROFILE_ID],
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
      const boost = await xpBoost(PROFILE_ID);
      const { rows } = await neonExecute(
        `with q as (
           update public.devup_quest
              set done = true, completed_at = now()
            where id = $1 and user_id = $2 and done = false
            returning xp
         ),
         e as (
           insert into public.devup_xp_event (amount, reason, user_id)
           select (xp * $3)::int, 'quest:' || $1, $2 from q
         ),
         p as (
           update public.devup_profile
              set xp = xp + (select coalesce(sum((xp * $3)::int), 0) from q), updated_at = now()
            where id = $2
            returning xp
         )
         select (select coalesce(sum((xp * $3)::int), 0) from q)::int as awarded,
                (select xp from p)::int as xp`,
        [data.id, PROFILE_ID, boost],
      );
      const awarded = Number(rows[0]?.["awarded"] ?? 0);
      if (awarded === 0) return { ok: true }; // already done — nothing to award
      // Clearing a quest is career activity: it keeps the streak alive and can pay the 7-day bonus.
      const { bumpStreak } = await import("./career.functions");
      const st = await bumpStreak(PROFILE_ID).catch((e) => {
        console.error("streak update failed", e);
        return { streak: 0, bonus: 0 };
      });
      return { ok: true, xp: Number(rows[0]?.["xp"] ?? 0) + st.bonus };
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

/** Pays interview XP from the grade stored on the server — never from a number the
 *  browser sends. Each interview pays once per person: the partial unique index on
 *  `iv:%` reasons turns a replay into a no-op. */
export const claimInterviewXp = createServerFn({ method: "POST" })
  .inputValidator((input: { kind: unknown; id: unknown }) => {
    const kind = input.kind === "peer" ? "peer" : input.kind === "solo" ? "solo" : null;
    const id = typeof input.id === "string" && /^[0-9a-f-]{36}$/i.test(input.id) ? input.id : null;
    if (!kind || !id) throw new Error("Invalid interview.");
    return { kind, id };
  })
  .handler(async ({ data }): Promise<SaveResult> => {
    try {
      const PROFILE_ID = (await requireUser()).id;
      let base = 0;
      if (data.kind === "solo") {
        const { rows } = await neonExecute(
          "select grade from public.devup_interview where id = $1::uuid and user_id = $2 and grade is not null",
          [data.id, PROFILE_ID],
        );
        base = Number((rows[0]?.["grade"] as { xp?: unknown } | undefined)?.xp ?? 0);
      } else {
        const { rows } = await neonExecute(
          `select host_id::text as host_id, host_role, grade, interviewer_grade from public.devup_peer_session
            where id = $1::uuid and (host_id = $2::uuid or guest_id = $2::uuid)`,
          [data.id, PROFILE_ID],
        );
        const r = rows[0];
        if (r) {
          const isHost = String(r["host_id"]) === PROFILE_ID;
          const candidate = (r["host_role"] === "interviewer") !== isHost;
          const g = (candidate ? r["grade"] : r["interviewer_grade"]) as { xp?: unknown; pending?: unknown } | null;
          base = g && !g.pending ? Number(g.xp ?? 0) : 0;
        }
      }
      base = Math.max(0, Math.min(400, Math.round(base) || 0));
      if (base <= 0) return { ok: true };
      const amount = Math.round(base * (await xpBoost(PROFILE_ID)));
      const { rows } = await neonExecute(
        `with e as (
           insert into public.devup_xp_event (amount, reason, user_id) values ($1, $2, $3)
           on conflict (user_id, reason) where reason like 'iv:%' do nothing returning amount
         )
         update public.devup_profile set xp = xp + (select coalesce(sum(amount), 0) from e), updated_at = now()
          where id = $3 returning xp, (select coalesce(sum(amount), 0) from e)::int as paid`,
        [amount, `iv:${data.kind}:${data.id}`, PROFILE_ID],
      );
      return { ok: true, xp: Number(rows[0]?.["xp"] ?? 0), paid: Number(rows[0]?.["paid"] ?? 0) } as SaveResult;
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
