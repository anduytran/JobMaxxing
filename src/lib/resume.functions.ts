// Server functions for resume grading. Neon is the source of truth: every scan or
// editor save is a row in devup_resume_version, every grade a devup_resume_review
// linked to its version, and XP (first scan, each fix, score above 80) pays once.
import { createServerFn } from "@tanstack/react-start";
import { neonExecute, neonQuery, neonUserError } from "./neon.server";
import { requireUser } from "./auth.server";
import {
  EMPTY_FIELDS, GRADES, SUGGESTION_BATCH, XP_RULES,
  type Grade, type ResumeFields, type ResumeReview, type ResumeSection, type ResumeSuggestion, type ResumeVersion, type StoredReview,
} from "./resume";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s && s.length <= max ? s : null;
};

const fail = (err: unknown): { ok: false; error: string } => {
  console.error(err);
  if (err instanceof Error && (err.message === "Please sign in." || err.message.startsWith("Resume:"))) {
    return { ok: false, error: err.message.replace(/^Resume:\s*/, "") };
  }
  return { ok: false, error: neonUserError(err).message };
};

const FILE_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX_FILE_BYTES = 8 * 1024 * 1024;

/** Accept only well-formed sections from the browser; ids stay stable across versions. */
function cleanSections(v: unknown): ResumeSection[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 20).map((s: any, si: number) => ({
    id: clean(s?.id, 20) ?? `s${si + 1}`,
    heading: (typeof s?.heading === "string" ? s.heading.trim().slice(0, 80) : "") || "Section",
    lines: (Array.isArray(s?.lines) ? s.lines : []).slice(0, 60).map((l: any, li: number) => ({
      id: clean(l?.id, 20) ?? `s${si + 1}l${li + 1}`,
      text: typeof l?.text === "string" ? l.text.trim().slice(0, 600) : "",
    })).filter((l: { text: string }) => l.text),
  }));
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Pays a one-time milestone; returns the amount actually awarded (0 when already paid). */
async function milestone(userId: string, name: string, amount: number): Promise<number> {
  const { rows } = await neonExecute(
    `with e as (
       insert into public.devup_xp_event (amount, reason, user_id) values ($2, 'milestone:' || $3, $1)
       on conflict (user_id, reason) where reason like 'milestone:%' do nothing
       returning amount
     ), p as (
       update public.devup_profile set xp = xp + (select coalesce(sum(amount), 0) from e), updated_at = now()
        where id = $1 and exists (select 1 from e)
     )
     select coalesce((select sum(amount) from e), 0)::int as awarded`,
    [userId, amount, name],
  );
  return Number(rows[0]?.["awarded"] ?? 0);
}

async function currentXp(userId: string): Promise<number> {
  const { rows } = await neonQuery("select xp from public.devup_profile where id = $1", [userId]);
  return Number(rows[0]?.["xp"] ?? 0);
}

/**
 * Scans a resume: an uploaded file (PDF or image — the Resume Agent reads it,
 * scans included), pasted text, or the editor's current sections. Saves a new
 * version, the review, the fields it found, and pays first-scan / score-80 XP.
 */
export const scanResume = createServerFn({ method: "POST" })
  .inputValidator((i: { fileName: unknown; contentType?: unknown; fileBase64?: unknown; text?: unknown; sections?: unknown; note?: unknown }) => {
    const fileName = clean(i.fileName, 200) ?? "resume";
    const contentType = typeof i.contentType === "string" && FILE_TYPES.includes(i.contentType) ? i.contentType : null;
    const fileBase64 = typeof i.fileBase64 === "string" && contentType ? i.fileBase64 : null;
    if (fileBase64 && fileBase64.length > (MAX_FILE_BYTES * 4) / 3 + 8) throw new Error("Resume: That file is over 8 MB.");
    const text = typeof i.text === "string" ? i.text.replace(/\r/g, "").trim().slice(0, 60_000) : "";
    const sections = cleanSections(i.sections);
    if (!fileBase64 && !sections.length && text.length < 80) throw new Error("Resume: That resume is too short to grade — paste the full text.");
    return { fileName, contentType, fileBase64, text, sections, note: clean(i.note, 120) };
  })
  .handler(async ({ data }): Promise<Result<{
    review: StoredReview; awarded: { firstScan: number; levelUp: number }; xp: number;
  }>> => {
    try {
      const user = await requireUser();
      const { reviewResume } = await import("./interview/agents.server");
      const review = await reviewResume({
        text: data.text || undefined,
        sections: data.sections.length ? data.sections : undefined,
        file: data.fileBase64 && data.contentType
          ? { name: data.fileName, type: data.contentType, bytes: base64ToBytes(data.fileBase64) }
          : undefined,
      });
      const sections = review.sections?.length ? review.sections : data.sections;
      const f = review.fields;
      const { results } = await neonExecute<{ results: any[] }>([
        {
          query: `insert into public.devup_resume_version (user_id, version, file_name, sections, note)
                  values ($1, coalesce((select max(version) from public.devup_resume_version where user_id = $1), 0) + 1, $2, $3::jsonb, $4)
                  returning id::text as id, version`,
          params: [user.id, data.fileName, JSON.stringify(sections), data.note ?? (data.fileBase64 ? "Uploaded" : data.sections.length ? "Edited in Resume Lab" : "Pasted text")],
        },
        {
          query: `insert into public.devup_resume_review
                    (file_name, grade, overall_score, summary, details, xp_awarded, user_id, version_id)
                  values ($1, $2, $3, $4, $5::jsonb, 0, $6,
                          (select id from public.devup_resume_version where user_id = $6 order by version desc limit 1))
                  returning id::text as id, to_json(created_at) as created_at_iso`,
          params: [
            data.fileName, review.grade, review.score, review.summary,
            JSON.stringify({ suggestions: review.suggestions, fields: f, source: review.source, ats: review.ats ?? null }),
            user.id,
          ],
        },
        {
          query: `update public.devup_profile set
                    skills = case when cardinality($2::text[]) > 0
                                  then array(select distinct unnest(coalesce(skills, '{}'::text[]) || $2::text[]))
                                  else skills end,
                    name = case when name is null or btrim(name) = '' or name = 'Alex Rivera'
                                then coalesce($3, name) else name end,
                    title = case when title is null or btrim(title) = ''
                                  or title in ('Aspiring Developer', 'Junior Full-Stack Developer')
                                then coalesce($4, title) else title end,
                    resume = coalesce(resume, '{}'::jsonb) || jsonb_build_object('fields', $5::jsonb, 'fileName', $6::text, 'uploadedAt', now()),
                    updated_at = now()
                  where id = $1`,
          params: [user.id, [...f.skills, ...(f.frameworks ?? [])], f.name, f.title, JSON.stringify(f), data.fileName],
        },
      ]);
      const v = results[0]?.rows?.[0];
      const r = results[1]?.rows?.[0];
      if (!v || !r) throw new Error("The review could not be saved.");
      const firstScan = await milestone(user.id, "first_scan", XP_RULES.firstScan);
      const levelUp = review.score > XP_RULES.levelUpScore ? await milestone(user.id, "resume_80", XP_RULES.levelUp) : 0;
      const { bumpStreak } = await import("./career.functions");
      await bumpStreak(user.id).catch((e) => console.error("streak update failed", e));
      return {
        ok: true,
        review: {
          ...review, sections, id: String(r.id), fileName: data.fileName, xpAwarded: 0,
          createdAt: String(r.created_at_iso ?? ""), versionId: String(v.id), version: Number(v.version),
        },
        awarded: { firstScan, levelUp },
        xp: await currentXp(user.id),
      };
    } catch (err) {
      return fail(err);
    }
  });

/**
 * Accepts one suggestion: when `lineText` is given the matching line is replaced
 * and a new version is saved, then the fix pays its XP once. The guard in the
 * UPDATE (only flip suggestions not already applied) makes a double click award nothing.
 */
export const applyResumeSuggestion = createServerFn({ method: "POST" })
  .inputValidator((i: { reviewId: unknown; suggestionId: unknown; sections?: unknown }) => {
    const reviewId = String(i.reviewId ?? "");
    if (!/^\d{1,19}$/.test(reviewId)) throw new Error("Unknown review.");
    const suggestionId = clean(i.suggestionId, 60);
    if (!suggestionId) throw new Error("Unknown suggestion.");
    return { reviewId, suggestionId, sections: cleanSections(i.sections) };
  })
  .handler(async ({ data }): Promise<Result<{ xp: number; awarded: number; version: number | null }>> => {
    try {
      const user = await requireUser();
      const { rows } = await neonExecute(
        `with u as (
           update public.devup_resume_review
              set details = jsonb_set(details, '{suggestions}',
                    (select jsonb_agg(
                              case when x.value->>'id' = $3
                                   then jsonb_set(x.value, '{applied}', 'true')
                                   else x.value end
                              order by x.ord)
                       from jsonb_array_elements(details->'suggestions') with ordinality as x(value, ord))),
                  xp_awarded = xp_awarded + $4
            where id = $1::bigint and user_id = $2
              and exists (
                select 1 from jsonb_array_elements(details->'suggestions') s
                 where s->>'id' = $3
                   and coalesce((s->>'applied')::boolean, false) = false)
            returning $4::int as awarded
         ),
         e as (
           insert into public.devup_xp_event (amount, reason, user_id)
           select awarded, 'resume:' || $3, $2 from u
         ),
         p as (
           update public.devup_profile
              set xp = xp + (select coalesce(sum(awarded), 0) from u), updated_at = now()
            where id = $2
            returning xp
         )
         select (select coalesce(sum(awarded), 0) from u)::int as awarded,
                coalesce((select xp from p), (select xp from public.devup_profile where id = $2))::int as xp`,
        [data.reviewId, user.id, data.suggestionId, XP_RULES.perFix],
      );
      let version: number | null = null;
      if (data.sections.length) {
        const saved = await neonExecute(
          `insert into public.devup_resume_version (user_id, version, file_name, sections, note)
           select $1, coalesce(max(version), 0) + 1,
                  coalesce((select file_name from public.devup_resume_version where user_id = $1 order by version desc limit 1), 'resume'),
                  $2::jsonb, $3
             from public.devup_resume_version where user_id = $1
           returning version`,
          [user.id, JSON.stringify(data.sections), `Accepted fix: ${data.suggestionId}`],
        );
        version = Number(saved.rows[0]?.["version"] ?? 0) || null;
      }
      return { ok: true, xp: Number(rows[0]?.["xp"] ?? 0), awarded: Number(rows[0]?.["awarded"] ?? 0), version };
    } catch (err) {
      return fail(err);
    }
  });

/**
 * Unlocks the next batch of fixes. It only opens once every suggestion on this
 * review is integrated — the check runs here, not in the browser, so the queue
 * can't be skipped — and the agent is told what it already said so the new
 * batch is genuinely new.
 */
export const moreResumeSuggestions = createServerFn({ method: "POST" })
  .inputValidator((i: { reviewId: unknown; sections?: unknown }) => {
    const reviewId = String(i.reviewId ?? "");
    if (!/^\d{1,19}$/.test(reviewId)) throw new Error("Unknown review.");
    return { reviewId, sections: cleanSections(i.sections) };
  })
  .handler(async ({ data }): Promise<Result<{ suggestions: ResumeSuggestion[]; added: number }>> => {
    try {
      const user = await requireUser();
      const { rows } = await neonQuery(
        `select id::text as id, file_name, grade, overall_score, summary, details, xp_awarded, version_id::text as version_id,
                to_json(created_at) as created_at_iso
           from public.devup_resume_review where id = $1::bigint and user_id = $2`,
        [data.reviewId, user.id],
      );
      if (!rows[0]) return { ok: false, error: "That review wasn't found." };
      const stored = toStored(rows[0]);
      const open = stored.suggestions.filter((s) => !s.applied).length;
      if (open) {
        const word = open === 1 ? "your open fix" : `your ${open} open fixes`;
        return { ok: false, error: `Integrate ${word} first — the next ${SUGGESTION_BATCH} unlock once they're in.` };
      }
      const { nextSuggestions } = await import("./interview/agents.server");
      const fresh = await nextSuggestions({
        sections: data.sections.length ? data.sections : undefined,
        already: stored.suggestions,
      });
      if (!fresh.length) return { ok: false, error: "No new fixes came back — re-scan to grade the current version." };
      await neonExecute(
        `update public.devup_resume_review
            set details = jsonb_set(coalesce(details, '{}'::jsonb), '{suggestions}',
                  coalesce(details->'suggestions', '[]'::jsonb) || $3::jsonb)
          where id = $1::bigint and user_id = $2`,
        [data.reviewId, user.id, JSON.stringify(fresh)],
      );
      return { ok: true, suggestions: fresh, added: fresh.length };
    } catch (err) {
      return fail(err);
    }
  });

/** Saves the editor's sections as a new version without grading. */
export const saveResumeVersion = createServerFn({ method: "POST" })
  .inputValidator((i: { sections: unknown; note?: unknown }) => {
    const sections = cleanSections(i.sections);
    if (!sections.length) throw new Error("Resume: Nothing to save.");
    return { sections, note: clean(i.note, 120) ?? "Edited in Resume Lab" };
  })
  .handler(async ({ data }): Promise<Result<{ version: number }>> => {
    try {
      const user = await requireUser();
      const { rows } = await neonExecute(
        `insert into public.devup_resume_version (user_id, version, file_name, sections, note)
         select $1, coalesce(max(version), 0) + 1,
                coalesce((select file_name from public.devup_resume_version where user_id = $1 order by version desc limit 1), 'resume'),
                $2::jsonb, $3
           from public.devup_resume_version where user_id = $1
         returning version`,
        [user.id, JSON.stringify(data.sections), data.note],
      );
      return { ok: true, version: Number(rows[0]?.["version"] ?? 0) };
    } catch (err) {
      return fail(err);
    }
  });

function toStored(r: Record<string, unknown>): StoredReview {
  const d = (r["details"] ?? {}) as { suggestions?: StoredReview["suggestions"]; fields?: ResumeFields; source?: string; ats?: StoredReview["ats"] };
  const grade = String(r["grade"]);
  return {
    id: String(r["id"]),
    fileName: String(r["file_name"] ?? "resume"),
    grade: (GRADES as string[]).includes(grade) ? (grade as Grade) : "C",
    score: Number(r["overall_score"] ?? 0),
    summary: String(r["summary"] ?? ""),
    suggestions: Array.isArray(d.suggestions) ? d.suggestions : [],
    fields: d.fields ?? EMPTY_FIELDS,
    source: d.source === "fallback" ? "fallback" : "raia",
    ats: d.ats ?? null,
    xpAwarded: Number(r["xp_awarded"] ?? 0),
    createdAt: String(r["created_at_iso"] ?? ""),
    versionId: r["version_id"] ? String(r["version_id"]) : null,
  };
}

/** Latest review, the newest version's sections, and the version history. */
export const getResumeState = createServerFn({ method: "POST" })
  .handler(async (): Promise<Result<{ review: StoredReview | null; sections: ResumeSection[]; versions: ResumeVersion[] }>> => {
    try {
      const user = await requireUser();
      const { results } = await neonQuery<{ results: any[] }>([
        {
          query: `select id::text as id, file_name, grade, overall_score, summary, details, xp_awarded, version_id::text as version_id,
                         to_json(created_at) as created_at_iso
                    from public.devup_resume_review r0 where user_id = $1 order by r0.id desc limit 1`,
          params: [user.id],
        },
        {
          query: `select v.id::text as id, v.version, v.file_name, v.note, v.sections, to_json(v.created_at) as created_at_iso,
                         r.overall_score, r.grade
                    from public.devup_resume_version v
                    left join lateral (select overall_score, grade from public.devup_resume_review
                                        where version_id = v.id order by id desc limit 1) r on true
                   where v.user_id = $1 order by v.version desc limit 30`,
          params: [user.id],
        },
      ], [], { "Neon-Batch-Read-Only": "true" });
      const rr = results[0]?.rows?.[0];
      const vrows: any[] = results[1]?.rows ?? [];
      const review = rr ? toStored(rr) : null;
      if (review) {
        const match = vrows.find((v) => v.id === review.versionId);
        review.version = match ? Number(match.version) : null;
      }
      return {
        ok: true,
        review,
        sections: vrows[0] ? cleanSections(vrows[0].sections) : [],
        versions: vrows.map((v) => ({
          id: String(v.id), version: Number(v.version), fileName: String(v.file_name), note: v.note ?? null,
          createdAt: String(v.created_at_iso ?? ""),
          score: v.overall_score == null ? null : Number(v.overall_score),
          grade: v.grade && (GRADES as string[]).includes(v.grade) ? (v.grade as Grade) : null,
        })),
      };
    } catch (err) {
      return fail(err);
    }
  });

/** Sections of one past version, to restore it into the editor. */
export const getResumeVersion = createServerFn({ method: "POST" })
  .inputValidator((i: { id: unknown }) => {
    const id = String(i.id ?? "");
    if (!/^\d{1,19}$/.test(id)) throw new Error("Unknown version.");
    return { id };
  })
  .handler(async ({ data }): Promise<Result<{ sections: ResumeSection[] }>> => {
    try {
      const user = await requireUser();
      const { rows } = await neonQuery(
        "select sections from public.devup_resume_version where id = $1::bigint and user_id = $2",
        [data.id, user.id],
      );
      if (!rows[0]) return { ok: false, error: "That version wasn't found." };
      return { ok: true, sections: cleanSections(rows[0]["sections"]) };
    } catch (err) {
      return fail(err);
    }
  });

/** Kept for the dashboard: newest stored review only. */
export const getLatestResumeReview = createServerFn({ method: "GET" })
  .handler(async (): Promise<Result<{ review: StoredReview | null }>> => {
    try {
      const user = await requireUser();
      const { rows } = await neonQuery(
        `select id::text as id, file_name, grade, overall_score, summary, details, xp_awarded, version_id::text as version_id,
                to_json(created_at) as created_at_iso
           from public.devup_resume_review r0 where user_id = $1 order by r0.id desc limit 1`,
        [user.id],
      );
      return { ok: true, review: rows[0] ? toStored(rows[0]) : null };
    } catch (err) {
      return fail(err);
    }
  });
