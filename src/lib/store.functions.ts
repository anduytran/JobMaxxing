import { createServerFn } from "@tanstack/react-start";
import { neonExecute } from "./neon.server";
import { requireUser } from "./auth.server";

// ---------------------------------------------------------------------------
// Store economy: spendable points = lifetime XP earned minus points spent.
// Purchases, boosters, streak freeze/repair, titles and themes live here.
// ---------------------------------------------------------------------------

export type StoreItem = {
  id: string;
  name: string;
  description: string;
  category: "consumable" | "customization" | "content_pack";
  cost: number;
  badgeColor: string;
};

export type StoreState = {
  ok: true;
  balance: number;
  items: StoreItem[];
  owned: string[]; // non-consumables already bought
  freezeCount: number;
  boosterExpiresAt: string | null;
  activeTitle: string | null;
  activeTheme: string;
};

export type StoreResult =
  | { ok: true; balance?: number; xp?: number }
  | { ok: false; error: string };

const fail = (err: unknown): { ok: false; error: string } => {
  console.error(err);
  return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
};

const THEMES = ["default", "cyberpunk", "terminal", "slate"] as const;
export type StoreTheme = (typeof THEMES)[number];

export const TITLE_BADGES: Record<string, string> = {
  title_faang: "FAANG Bound",
  title_sysdesign: "System Design Guru",
  title_algo: "Algo Master",
};

export const THEME_ITEMS: Record<string, StoreTheme> = {
  theme_cyberpunk: "cyberpunk",
  theme_terminal: "terminal",
  theme_slate: "slate",
};

/** Points balance: every XP event also earns a point; purchases subtract. */
const BALANCE_SQL =
  "select (coalesce((select sum(amount) from public.devup_xp_event where user_id = $1), 0) - " +
  "coalesce((select sum(cost) from public.devup_purchase where user_id = $1), 0))::int as balance";

export const getStore = createServerFn({ method: "GET" }).handler(
  async (): Promise<StoreState | { ok: false; error: string }> => {
    try {
      const userId = (await requireUser()).id;
      const { results } = await neonExecute<{ results: any[] }>([
        { query: BALANCE_SQL, params: [userId] },
        {
          query:
            "select id, name, description, category, cost, badge_color from public.devup_store_item order by category, cost",
          params: [],
        },
        {
          // Non-consumables are one-time owns.
          query:
            "select distinct p.item_id from public.devup_purchase p join public.devup_store_item i on i.id = p.item_id " +
            "where p.user_id = $1 and i.category <> 'consumable'",
          params: [userId],
        },
        {
          query: "select streak_freeze_count from public.devup_activity_streak where user_id = $1",
          params: [userId],
        },
        {
          query:
            "select expires_at from public.devup_booster where user_id = $1 and expires_at > now() order by expires_at desc limit 1",
          params: [userId],
        },
        {
          query: "select active_title, active_theme from public.devup_profile where id = $1",
          params: [userId],
        },
      ]);
      return {
        ok: true,
        balance: Number(results[0]?.rows?.[0]?.balance ?? 0),
        items: (results[1]?.rows ?? []).map((r: any) => ({
          id: String(r.id),
          name: String(r.name),
          description: String(r.description ?? ""),
          category: r.category as StoreItem["category"],
          cost: Number(r.cost),
          badgeColor: String(r.badge_color ?? "blue"),
        })),
        owned: (results[2]?.rows ?? []).map((r: any) => String(r.item_id)),
        freezeCount: Number(results[3]?.rows?.[0]?.streak_freeze_count ?? 0),
        boosterExpiresAt: results[4]?.rows?.[0]?.expires_at
          ? new Date(String(results[4].rows[0].expires_at)).toISOString()
          : null,
        activeTitle: results[5]?.rows?.[0]?.active_title
          ? String(results[5].rows[0].active_title)
          : null,
        activeTheme: String(results[5]?.rows?.[0]?.active_theme ?? "default"),
      };
    } catch (err) {
      return fail(err);
    }
  },
);

export const buyItem = createServerFn({ method: "POST" })
  .inputValidator((input: { itemId: unknown }) => {
    const itemId = typeof input.itemId === "string" ? input.itemId.trim() : "";
    if (!/^[a-z0-9_]+$/i.test(itemId) || itemId.length > 50) throw new Error("Unknown item.");
    return { itemId };
  })
  .handler(async ({ data }): Promise<StoreResult> => {
    try {
      const userId = (await requireUser()).id;
      const { results } = await neonExecute<{ results: any[] }>([
        {
          query: "select id, category, cost from public.devup_store_item where id = $1",
          params: [data.itemId],
        },
        { query: BALANCE_SQL, params: [userId] },
        {
          query:
            "select 1 from public.devup_purchase p join public.devup_store_item i on i.id = p.item_id " +
            "where p.user_id = $1 and p.item_id = $2 and i.category <> 'consumable' limit 1",
          params: [userId, data.itemId],
        },
      ]);
      const item = results[0]?.rows?.[0];
      if (!item) return { ok: false, error: "Unknown item." };
      if (results[2]?.rows?.length) return { ok: false, error: "You already own this." };
      const balance = Number(results[1]?.rows?.[0]?.balance ?? 0);
      const cost = Number(item.cost);
      if (balance < cost) return { ok: false, error: "Not enough points yet — keep earning XP." };

      const effects: { query: string; params: unknown[] }[] = [
        {
          query: "insert into public.devup_purchase (user_id, item_id, cost) values ($1, $2, $3)",
          params: [userId, data.itemId, cost],
        },
      ];
      if (data.itemId === "streak_freeze") {
        effects.push({
          query:
            "insert into public.devup_activity_streak (user_id, streak_freeze_count) values ($1, 1) " +
            "on conflict (user_id) do update set streak_freeze_count = public.devup_activity_streak.streak_freeze_count + 1",
          params: [userId],
        });
      } else if (data.itemId === "streak_repair") {
        // Rewind the last activity to yesterday so the next activity continues the
        // streak. Only works inside the 48-hour grace window.
        effects.push({
          query:
            "update public.devup_activity_streak set last_activity_date = current_date - 1 " +
            "where user_id = $1 and last_activity_date >= current_date - 3 and last_activity_date < current_date",
          params: [userId],
        });
      } else if (data.itemId === "xp_booster") {
        effects.push({
          query:
            "insert into public.devup_booster (user_id, multiplier, expires_at) values ($1, 1.5, now() + interval '24 hours')",
          params: [userId],
        });
      } else if (TITLE_BADGES[data.itemId]) {
        effects.push({
          query: "update public.devup_profile set active_title = $2, updated_at = now() where id = $1",
          params: [userId, TITLE_BADGES[data.itemId]],
        });
      } else if (THEME_ITEMS[data.itemId]) {
        effects.push({
          query: "update public.devup_profile set active_theme = $2, updated_at = now() where id = $1",
          params: [userId, THEME_ITEMS[data.itemId]],
        });
      }
      effects.push({ query: BALANCE_SQL, params: [userId] });
      const done = await neonExecute<{ results: any[] }>(effects);
      if (data.itemId === "streak_repair" && done.results[1]?.rowCount === 0) {
        return { ok: false, error: "No recent streak to repair — the 48-hour window has passed." };
      }
      return { ok: true, balance: Number(done.results.at(-1)?.rows?.[0]?.balance ?? 0) };
    } catch (err) {
      return fail(err);
    }
  });

/** Equip an owned title badge or theme (or clear it with "default"/null). */
export const equipItem = createServerFn({ method: "POST" })
  .inputValidator((input: { kind: unknown; value: unknown }) => {
    const kind = input.kind === "title" || input.kind === "theme" ? input.kind : null;
    const value = typeof input.value === "string" ? input.value.trim().slice(0, 60) : "";
    if (!kind) throw new Error("Invalid equip request.");
    return { kind, value } as { kind: "title" | "theme"; value: string };
  })
  .handler(async ({ data }): Promise<StoreResult> => {
    try {
      const userId = (await requireUser()).id;
      if (data.kind === "title") {
        if (data.value) {
          const owned = Object.entries(TITLE_BADGES).find(([, label]) => label === data.value);
          if (!owned) return { ok: false, error: "Unknown title." };
          const { rows } = await neonExecute(
            "select 1 from public.devup_purchase where user_id = $1 and item_id = $2 limit 1",
            [userId, owned[0]],
          );
          if (!rows.length) return { ok: false, error: "You don't own this title yet." };
        }
        await neonExecute(
          "update public.devup_profile set active_title = $2, updated_at = now() where id = $1",
          [userId, data.value || null],
        );
      } else {
        const theme = data.value || "default";
        if (!THEMES.includes(theme as StoreTheme)) return { ok: false, error: "Unknown theme." };
        if (theme !== "default") {
          const itemId = Object.entries(THEME_ITEMS).find(([, t]) => t === theme)?.[0];
          const { rows } = await neonExecute(
            "select 1 from public.devup_purchase where user_id = $1 and item_id = $2 limit 1",
            [userId, itemId],
          );
          if (!rows.length) return { ok: false, error: "You don't own this theme yet." };
        }
        await neonExecute(
          "update public.devup_profile set active_theme = $2, updated_at = now() where id = $1",
          [userId, theme],
        );
      }
      return { ok: true };
    } catch (err) {
      return fail(err);
    }
  });
