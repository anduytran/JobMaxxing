// Server functions for resume grading: the review row in Neon is the source of
// truth for a candidate's grade and feedback, and each suggestion pays XP once.
import { createServerFn } from "@tanstack/react-start";
import { neonExecute, neonQuery, neonUserError } from "./neon.server";
import { requireUser } from "./auth.server";
import { EMPTY_FIELDS, GRADES, type Grade, type ResumeFields, type ResumeReview, type StoredReview } from "./resume";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s && s.length <= max ? s : null;
};

const fail = (err: unknown): { ok: false; error: string } => {
  console.error(err);
  if (err instanceof Error && err.message === "Please sign in.") return { ok: false, error: err.message };
  return { ok: false, error: neonUserError(err).message };
};

/**
 * Grades a resume with the Raia Resume Agent (or the offline checker when that
 * agent is unreachable), then stores the review and folds the fields it found
 * back into the profile — skills always merge, name/title only fill an empty
 * or still-default profile.
 */
export const reviewResume = createServerFn({ method: "POST" })
  .inputValidator((i: { fileName: unknown; text: unknown }) => {
    const fileName = clean(i.fileName, 200) ?? "resume";
    const text = typeof i.text === "string" ? i.text.replace(/\r/g, "").trim().slice(0, 60_000) : "";
    if (text.length < 80) throw new Error("That resume is too short to grade — paste the full text.");
    return { fileName, text };
  })
  .handler(async ({ data }): Promise<Result<{ id: string; review: ResumeReview }>> => {
    try {
      const user = await requireUser();
      const { reviewResume: grade } = await import("./interview/agents.server");
      const review = await grade(data.text);
      const { results } = await neonExecute<{ results: any[] }>([
        {
          query: `insert into public.devup_resume_review
                    (file_name, grade, overall_score, summary, details, xp_awarded, user_id)
                  values ($1, $2, $3, $4, $5::jsonb, 0, $6)
                  returning id::text as id`,
          params: [
            data.fileName,
            review.grade,
            review.score,
            review.summary,
            JSON.stringify({ suggestions: review.suggestions, fields: review.fields, source: review.source }),
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
                    updated_at = now()
                  where id = $1`,
          params: [user.id, review.fields.skills, review.fields.name, review.fields.title],
        },
      ]);
      const id = String(results[0]?.rows?.[0]?.id ?? "");
      if (!id) throw new Error("The review could not be saved.");
      return { ok: true, id, review };
    } catch (err) {
      return fail(err);
    }
  });

/**
 * Marks one suggestion integrated and pays its XP. The guard in the UPDATE
 * (only flip suggestions that are not already applied) makes a double click
 * award nothing the second time.
 */
export const applyResumeSuggestion = createServerFn({ method: "POST" })
  .inputValidator((i: { reviewId: unknown; suggestionId: unknown }) => {
    const reviewId = String(i.reviewId ?? "");
    if (!/^\d{1,19}$/.test(reviewId)) throw new Error("Unknown review.");
    const suggestionId = clean(i.suggestionId, 60);
    if (!suggestionId) throw new Error("Unknown suggestion.");
    return { reviewId, suggestionId };
  })
  .handler(async ({ data }): Promise<Result<{ xp: number; awarded: number }>> => {
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
                  xp_awarded = xp_awarded + (
                    select coalesce(sum((s->>'xp')::int), 0)
                      from jsonb_array_elements(details->'suggestions') s
                     where s->>'id' = $3
                       and coalesce((s->>'applied')::boolean, false) = false)
            where id = $1::bigint and user_id = $2
              and exists (
                select 1 from jsonb_array_elements(details->'suggestions') s
                 where s->>'id' = $3
                   and coalesce((s->>'applied')::boolean, false) = false)
            returning (
              select coalesce(sum((s->>'xp')::int), 0)
                from jsonb_array_elements(details->'suggestions') s
               where s->>'id' = $3) as awarded
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
                (select xp from p)::int as xp`,
        [data.reviewId, user.id, data.suggestionId],
      );
      return {
        ok: true,
        xp: Number(rows[0]?.["xp"] ?? 0),
        awarded: Number(rows[0]?.["awarded"] ?? 0),
      };
    } catch (err) {
      return fail(err);
    }
  });

/** Newest stored review, so the grade and feedback survive a page reload. */
export const getLatestResumeReview = createServerFn({ method: "GET" })
  .handler(async (): Promise<Result<{ review: StoredReview | null }>> => {
    try {
      const user = await requireUser();
      const { rows } = await neonQuery(
        `select id::text as id, file_name, grade, overall_score, summary, details, xp_awarded,
                to_json(created_at) as created_at_iso
           from public.devup_resume_review
          where user_id = $1
          order by id desc
          limit 1`,
        [user.id],
      );
      const r = rows[0];
      if (!r) return { ok: true, review: null };
      const d = (r["details"] ?? {}) as {
        suggestions?: StoredReview["suggestions"];
        fields?: ResumeFields;
        source?: string;
      };
      const grade = String(r["grade"]);
      return {
        ok: true,
        review: {
          id: String(r["id"]),
          fileName: String(r["file_name"] ?? "resume"),
          grade: (GRADES as string[]).includes(grade) ? (grade as Grade) : "C",
          score: Number(r["overall_score"] ?? 0),
          summary: String(r["summary"] ?? ""),
          suggestions: Array.isArray(d.suggestions) ? d.suggestions : [],
          fields: d.fields ?? EMPTY_FIELDS,
          source: d.source === "fallback" ? "fallback" : "raia",
          xpAwarded: Number(r["xp_awarded"] ?? 0),
          createdAt: String(r["created_at_iso"] ?? ""),
        },
      };
    } catch (err) {
      return fail(err);
    }
  });
