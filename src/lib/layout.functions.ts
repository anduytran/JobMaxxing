import { createServerFn } from "@tanstack/react-start";
import { neonExecute, neonQuery } from "./neon.server";
import { currentUser, requireUser } from "./auth.server";

// Featured-quest card layout (Max + backdrop offsets), shared by every user and
// editable only by the layout editor account.
export const LAYOUT_EDITOR_EMAIL = "dylan@raiaai.com";
export type SceneLayout = { maxX: number; maxY: number; maxSize: number; bgX: number; bgY: number; bgScale: number };
export const DEFAULT_LAYOUT: SceneLayout = { maxX: 0, maxY: 0, maxSize: 240, bgX: 0, bgY: 0, bgScale: 1 };
const KINDS = ["branding", "skills", "hunt", "interview", "resume"];

const num = (v: unknown, min: number, max: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};
const normalize = (v: Record<string, unknown> = {}): SceneLayout => ({
  maxX: num(v["maxX"], -600, 600, 0),
  maxY: num(v["maxY"], -400, 400, 0),
  maxSize: num(v["maxSize"], 80, 480, 240),
  bgX: num(v["bgX"], -800, 800, 0),
  bgY: num(v["bgY"], -600, 600, 0),
  bgScale: num(v["bgScale"], 0.3, 3, 1),
});

export const getFeaturedLayouts = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const [user, res] = await Promise.all([
      currentUser(),
      neonQuery("select kind, layout from public.devup_featured_layout", []),
    ]);
    const layouts: Record<string, SceneLayout> = {};
    for (const r of res.rows) layouts[String(r["kind"])] = normalize(r["layout"] as Record<string, unknown>);
    return { layouts, canEdit: user?.email.toLowerCase() === LAYOUT_EDITOR_EMAIL };
  } catch {
    return { layouts: {} as Record<string, SceneLayout>, canEdit: false };
  }
});

export const saveFeaturedLayout = createServerFn({ method: "POST" })
  .inputValidator((input: { kind: unknown; layout: unknown }) => {
    const kind = String(input.kind);
    if (!KINDS.includes(kind)) throw new Error("Unknown card type.");
    return { kind, layout: normalize((input.layout ?? {}) as Record<string, unknown>) };
  })
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (user.email.toLowerCase() !== LAYOUT_EDITOR_EMAIL) return { ok: false as const, error: "Only the layout editor can change this." };
    await neonExecute(
      `insert into public.devup_featured_layout (kind, layout, updated_by, updated_at) values ($1, $2::jsonb, $3, now())
       on conflict (kind) do update set layout = excluded.layout, updated_by = excluded.updated_by, updated_at = now()`,
      [data.kind, JSON.stringify(data.layout), user.email],
    );
    return { ok: true as const, layout: data.layout };
  });
