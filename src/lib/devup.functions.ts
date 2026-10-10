import { createServerFn } from "@tanstack/react-start";
import { neonExecute, neonQuery, neonUserError } from "./neon.server";

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

export type Quest = {
  id: string;
  title: string;
  xp: number;
  category: string;
  done: boolean;
};

export type GameState = {
  ok: true;
  name: string;
  title: string;
  xp: number;
  roast: boolean;
  quests: Quest[];
};

export type SaveResult = { ok: true; xp?: number } | { ok: false; error: string };

const PROFILE_ID = "default";

function fail(err: unknown): SaveResult {
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
  async (): Promise<GameState | { ok: false; error: string }> => {
    try {
      const { results } = await neonQuery<{ results: any[] }>([
        {
          query:
            "select name, title, xp, roast from public.devup_profile where id = $1 limit 1",
          params: [PROFILE_ID],
        },
        {
          query:
            "select id, title, xp, category, done from public.devup_quest order by sort_order asc, id asc limit 200",
        },
      ]);
      const profile = results[0]?.rows?.[0];
      return {
        ok: true,
        name: String(profile?.name ?? "Alex Rivera"),
        title: String(profile?.title ?? "Junior Full-Stack Developer"),
        xp: Number(profile?.xp ?? 0),
        roast: Boolean(profile?.roast ?? false),
        quests: (results[1]?.rows ?? []).map((r: any) => ({
          id: String(r.id),
          title: String(r.title),
          xp: Number(r.xp),
          category: String(r.category),
          done: Boolean(r.done),
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
      await neonExecute(
        "update public.devup_profile set roast = $1, updated_at = now() where id = $2",
        [data.roast, PROFILE_ID],
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
      const { rows } = await neonExecute(
        `with q as (
           update public.devup_quest
              set done = true, completed_at = now()
            where id = $1 and done = false
            returning xp
         ),
         e as (
           insert into public.devup_xp_event (amount, reason)
           select xp, 'quest:' || $1 from q
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
  .inputValidator((input: { id: unknown; title: unknown; xp: unknown; category: unknown }) => {
    const id = questId(input.id);
    const title = clean(input.title, 120);
    const category = clean(input.category, 40);
    const xp = int(input.xp, 1, 5000);
    if (!id || !title || !category || xp === null) throw new Error("Invalid quest.");
    return { id, title, category, xp };
  })
  .handler(async ({ data }): Promise<SaveResult> => {
    try {
      await neonExecute(
        `insert into public.devup_quest (id, title, xp, category, sort_order)
         values ($1, $2, $3, $4, -1)
         on conflict (id) do nothing`,
        [data.id, data.title, data.xp, data.category],
      );
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
      const { results } = await neonExecute<{ results: any[] }>([
        {
          query: "insert into public.devup_xp_event (amount, reason) values ($1, $2)",
          params: [data.amount, data.reason],
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
