// Job Radar — real job listings (Adzuna) scored against the user's resume profile.
// Matches are cached in Neon (devup_job_radar) so statuses, viewed flags and XP
// survive reloads; XP rewards are idempotent via unique radar:* reasons.
import { createServerFn } from "@tanstack/react-start";
import { neonExecute } from "./neon.server";
import { requireUser } from "./auth.server";
import type { JobPrefs } from "./devup.functions";
import type { SaveResult } from "./devup.functions";

export type RadarStatus = "new" | "saved" | "applied" | "interviewing" | "dismissed";
export const RADAR_STATUSES: RadarStatus[] = ["new", "saved", "applied", "interviewing", "dismissed"];

export type RadarJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  salaryMin: number | null;
  salaryMax: number | null;
  postedAt: string;
  skills: string[];
  match: number;
  matchWhy: string[];
  status: RadarStatus;
  viewed: boolean;
};

type AdzunaListing = {
  id: number;
  title: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  description: string;
  redirect_url: string;
  salary_min?: number;
  salary_max?: number;
  created: string;
  contract_time?: string;
};

// ---------------- skill extraction & normalization ----------------

const EXTRA_SKILLS = [
  "Figma", "Product Design", "UX", "Prototyping", "Design Systems", "Copywriting", "SEO", "Content Marketing",
  "Excel", "Tableau", "Power BI", "Salesforce", "HubSpot", "Jira", "Linear", "Notion", "Swift", "Kotlin",
  "Android", "iOS", "Flutter", "React Native", "Data Analysis", "A/B Testing", "Customer Success",
  "Stakeholder Management", "Presentation", "Negotiation", "Project Management", "Scrum",
];

// Lazily imported server-only module keeps the skill dictionary in one place.
let skillsModule: { SKILLS: string[]; canonicalSkill: (s: string) => string } | null = null;
async function skillTools() {
  if (!skillsModule) {
    const m = await import("./interview/agents.server");
    skillsModule = { SKILLS: m.SKILLS, canonicalSkill: m.canonicalSkill };
  }
  return skillsModule;
}

async function extractSkills(text: string): Promise<string[]> {
  const { SKILLS, canonicalSkill } = await skillTools();
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const s of [...SKILLS, ...EXTRA_SKILLS]) {
    const re = new RegExp(`\\b${s.replace(/[.+*?()]/g, "\\$&").replace(/\s+/g, "\\s+")}\\b`, "i");
    if (re.test(lower)) found.push(canonicalSkill(s));
  }
  return [...new Set(found)];
}

// ---------------- match scoring ----------------

const tokens = (s: string) =>
  (s ?? "").toLowerCase().split(/[,;\n/|]+/).map((x) => x.trim()).filter((x) => x.length > 2);

function parseSalary(v: string | undefined): number | null {
  if (!v) return null;
  const digits = v.replace(/[^0-9]/g, "");
  if (!digits) return null;
  let n = Number(digits);
  if (/k/i.test(v) && n < 1000) n *= 1000;
  return n >= 5000 ? n : null; // ignore tiny numbers like "3" (3 roles)
}

function scoreJob(job: { title: string; description: string; location: string; salaryMin: number | null; salaryMax: number | null; skills: string[] }, profile: { skills: string[]; prefs: JobPrefs }) {
  const userSkills = new Set(profile.skills.map((s) => s.toLowerCase()));
  const overlap = job.skills.filter((s) => userSkills.has(s.toLowerCase()));
  const why: string[] = [];
  let score = 10; // a live listing that passed the search

  if (overlap.length) { score += Math.min(45, overlap.length * 9); why.push(`${overlap.length} of your skills`); }

  const roleTokens = tokens(profile.prefs.roles);
  const titleLower = job.title.toLowerCase();
  const descLower = job.description.toLowerCase();
  const roleHits = roleTokens.filter((t) => titleLower.includes(t)).length;
  if (roleHits) { score += 25; why.push("Matches your target role"); }
  else if (roleTokens.some((t) => descLower.includes(t))) score += 8;

  const wantRemote = /remote/i.test(profile.prefs.workMode ?? "");
  const jobRemote = /remote|work from home|anywhere/i.test(`${job.location} ${descLower}`);
  if (wantRemote && jobRemote) { score += 12; why.push("Remote-friendly"); }

  const locTokens = tokens(profile.prefs.locations).filter((t) => !/^remote/.test(t));
  if (locTokens.some((t) => job.location.toLowerCase().includes(t))) { score += 10; why.push("In your area"); }

  const prefSalary = parseSalary(profile.prefs.salary);
  if (prefSalary && (job.salaryMax ?? job.salaryMin ?? 0) >= prefSalary) { score += 8; why.push("Meets your salary goal"); }

  return {
    match: Math.max(5, Math.min(99, Math.round(score))),
    overlap,
    why: why.slice(0, 3),
  };
}

// ---------------- Adzuna fetch ----------------

async function fetchAdzuna(prefs: JobPrefs): Promise<{ listings: AdzunaListing[]; error?: string }> {
  const appId = process.env["ADZUNA_APPLICATION_ID"];
  const appKey = process.env["ADZUNA_API_KEY"];
  if (!appId || !appKey) return { listings: [], error: "Job listings aren't connected yet. Add the Adzuna Application ID and API key in project settings." };
  const what = tokens(prefs.roles)[0] ?? "developer";
  const where = tokens(prefs.locations).filter((t) => !/^remote/.test(t))[0];
  const jobs: AdzunaListing[] = [];
  for (const page of [1, 2]) {
    try {
      const url = new URL(`https://api.adzuna.com/v1/api/jobs/us/search/${page}`);
      url.searchParams.set("app_id", appId);
      url.searchParams.set("app_key", appKey);
      url.searchParams.set("results_per_page", "20");
      url.searchParams.set("max_days_old", "30");
      url.searchParams.set("what", what);
      if (where) url.searchParams.set("where", where);
      url.searchParams.set("content-type", "application/json");
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) { console.error("Adzuna search failed", res.status, (await res.text()).slice(0, 300)); break; }
      const body = (await res.json()) as { results?: AdzunaListing[] };
      jobs.push(...(body.results ?? []));
    } catch (err) {
      console.error("Adzuna fetch error", err);
      break;
    }
  }
  return { listings: jobs };
}

const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s && s.length <= max ? s : null;
};

// ---------------- server functions ----------------

/** Loads the radar: refreshes listings from Adzuna when asked, scores everything
 *  against the live profile, and returns entries with their saved statuses. */
export const getRadar = createServerFn({ method: "POST" })
  .inputValidator((i: { refresh: unknown }) => ({ refresh: i?.refresh === true }))
  .handler(async ({ data }): Promise<{ ok: true; jobs: RadarJob[]; error?: string } | { ok: false; error: string }> => {
    try {
      const user = await requireUser();
      const uid = user.id;
      const { results } = await neonExecute<{ results: any[] }>([
        { query: "select skills, job_prefs, resume from public.devup_profile where id = $1", params: [uid] },
      ]);
      const profile = results[0]?.rows?.[0] ?? {};
      const prefs = (profile.job_prefs ?? {}) as JobPrefs;
      const profileSkills: string[] = Array.isArray(profile.skills) ? profile.skills.map(String) : [];
      const resumeText = typeof (profile.resume as any)?.text === "string" ? (profile.resume as any).text : "";
      const userSkills = [...new Set([...profileSkills, ...(await extractSkills(resumeText))] )];

      let fetchError: string | undefined;
      if (data.refresh) {
        const { listings, error } = await fetchAdzuna(prefs);
        fetchError = error;
        if (listings.length) {
          const statements = listings.slice(0, 40).map((l) => ({
            query:
              "insert into public.devup_job_radar (user_id, job_id, data) values ($1, $2, $3::jsonb) " +
              "on conflict (user_id, job_id) do update set data = excluded.data, updated_at = now()",
            params: [uid, String(l.id), JSON.stringify({
              title: clean(l.title, 200) ?? "Untitled role",
              company: clean(l.company?.display_name, 120) ?? "Unknown company",
              location: clean(l.location?.display_name, 160) ?? "",
              description: (l.description ?? "").replace(/\s+/g, " ").slice(0, 6000),
              url: clean(l.redirect_url, 600) ?? "",
              salaryMin: typeof l.salary_min === "number" ? Math.round(l.salary_min) : null,
              salaryMax: typeof l.salary_max === "number" ? Math.round(l.salary_max) : null,
              postedAt: clean(l.created, 40) ?? "",
              contractTime: clean(l.contract_time, 40) ?? null,
            })],
          }));
          await neonExecute(statements);
        }
      }

      const { rows } = await neonExecute(
        "select job_id, data, status, viewed from public.devup_job_radar where user_id = $1",
        [uid],
      );
      const jobs: RadarJob[] = [];
      for (const r of rows) {
        const d = (r.data ?? {}) as Record<string, any>;
        const title = String(d.title ?? "Untitled role");
        const description = String(d.description ?? "");
        const jdSkills = await extractSkills(`${title} ${description}`);
        const s = scoreJob(
          { title, description, location: String(d.location ?? ""), salaryMin: d.salaryMin ?? null, salaryMax: d.salaryMax ?? null, skills: jdSkills },
          { skills: userSkills, prefs },
        );
        const status = RADAR_STATUSES.includes(r.status as RadarStatus) ? (r.status as RadarStatus) : "new";
        jobs.push({
          id: String(r.job_id),
          title,
          company: String(d.company ?? "Unknown company"),
          location: String(d.location ?? ""),
          description,
          url: String(d.url ?? ""),
          salaryMin: typeof d.salaryMin === "number" ? d.salaryMin : null,
          salaryMax: typeof d.salaryMax === "number" ? d.salaryMax : null,
          postedAt: String(d.postedAt ?? ""),
          skills: jdSkills.slice(0, 12),
          match: s.match,
          matchWhy: s.why,
          status,
          viewed: Boolean(r.viewed),
        });
      }
      jobs.sort((a, b) => (a.status === "dismissed") - (b.status === "dismissed") || b.match - a.match);
      return { ok: true, jobs, error: fetchError };
    } catch (err) {
      console.error("getRadar failed", err);
      const { neonUserError } = await import("./neon.server");
      return { ok: false, error: neonUserError(err).message };
    }
  });

/** One row: change a role's pipeline status. Saving a matched role pays +25 XP once. */
export const setRadarStatus = createServerFn({ method: "POST" })
  .inputValidator((i: { jobId: unknown; status: unknown }) => {
    const jobId = clean(i.jobId, 40);
    if (!jobId || !/^[0-9]+$/.test(jobId)) throw new Error("Invalid role.");
    if (!RADAR_STATUSES.includes(i.status as RadarStatus)) throw new Error("Invalid status.");
    return { jobId, status: i.status as RadarStatus };
  })
  .handler(async ({ data }): Promise<SaveResult & { awarded?: number }> => {
    try {
      const uid = (await requireUser()).id;
      const { rows } = await neonExecute(
        `with r as (
           update public.devup_job_radar set status = $3, updated_at = now()
           where user_id = $1 and job_id = $2 and status <> $3
           returning job_id
         ),
         e as (
           insert into public.devup_xp_event (amount, reason, user_id)
           select 25, 'radar:save:' || $2, $1
           where $3 = 'saved' and exists (select 1 from r)
           on conflict do nothing
           returning amount
         ),
         p as (
           update public.devup_profile set xp = xp + (select coalesce(sum(amount), 0) from e), updated_at = now()
           where id = $1 returning xp
         )
         select (select coalesce(sum(amount), 0) from e)::int as awarded, (select xp from p)::int as xp`,
        [uid, data.jobId, data.status],
      );
      const awarded = Number(rows[0]?.["awarded"] ?? 0);
      return { ok: true, awarded: awarded > 0 ? awarded : undefined, xp: Number(rows[0]?.["xp"] ?? 0) };
    } catch (err) {
      console.error("setRadarStatus failed", err);
      const { neonUserError } = await import("./neon.server");
      return { ok: false, error: neonUserError(err).message };
    }
  });

/** Marks a role reviewed. Every 5 reviewed roles pays +10 XP. */
export const markRadarViewed = createServerFn({ method: "POST" })
  .inputValidator((i: { jobId: unknown }) => {
    const jobId = clean(i.jobId, 40);
    if (!jobId || !/^[0-9]+$/.test(jobId)) throw new Error("Invalid role.");
    return { jobId };
  })
  .handler(async ({ data }): Promise<SaveResult & { awarded?: number }> => {
    try {
      const uid = (await requireUser()).id;
      const { results } = await neonExecute<{ results: any[] }>([
        {
          query: "update public.devup_job_radar set viewed = true, updated_at = now() where user_id = $1 and job_id = $2 and viewed = false",
          params: [uid, data.jobId],
        },
        {
          query:
            "select (select count(*)::int from public.devup_job_radar where user_id = $1 and viewed) as viewed, " +
            "(select count(*)::int from public.devup_xp_event where user_id = $1 and reason like 'radar:review:%') as batches",
          params: [uid],
        },
      ]);
      const viewed = Number(results[1]?.rows?.[0]?.["viewed"] ?? 0);
      const batches = Number(results[1]?.rows?.[0]?.["batches"] ?? 0);
      const target = Math.floor(viewed / 5);
      if (target <= batches) return { ok: true };
      const { rows } = await neonExecute(
        `with e as (
           insert into public.devup_xp_event (amount, reason, user_id)
           select 10, 'radar:review:' || g, $1 from generate_series($2, $3) as g
           on conflict do nothing
           returning amount
         ),
         p as (
           update public.devup_profile set xp = xp + (select coalesce(sum(amount), 0) from e), updated_at = now()
           where id = $1 returning xp
         )
         select (select coalesce(sum(amount), 0) from e)::int as awarded, (select xp from p)::int as xp`,
        [uid, batches + 1, target],
      );
      const awarded = Number(rows[0]?.["awarded"] ?? 0);
      return { ok: true, awarded: awarded > 0 ? awarded : undefined, xp: Number(rows[0]?.["xp"] ?? 0) };
    } catch (err) {
      console.error("markRadarViewed failed", err);
      const { neonUserError } = await import("./neon.server");
      return { ok: false, error: neonUserError(err).message };
    }
  });

/** +50 XP the first time a mock interview is completed for a saved radar role. */
export const awardRadarPracticeXp = createServerFn({ method: "POST" })
  .inputValidator((i: { jobId: unknown }) => {
    const jobId = clean(i.jobId, 40);
    if (!jobId || !/^[0-9]+$/.test(jobId)) throw new Error("Invalid role.");
    return { jobId };
  })
  .handler(async ({ data }): Promise<SaveResult & { awarded?: number }> => {
    try {
      const uid = (await requireUser()).id;
      const { rows } = await neonExecute(
        `with e as (
           insert into public.devup_xp_event (amount, reason, user_id)
           select 50, 'radar:practice:' || $2, $1
           where exists (select 1 from public.devup_job_radar where user_id = $1 and job_id = $2)
           on conflict do nothing
           returning amount
         ),
         p as (
           update public.devup_profile set xp = xp + (select coalesce(sum(amount), 0) from e), updated_at = now()
           where id = $1 returning xp
         )
         select (select coalesce(sum(amount), 0) from e)::int as awarded, (select xp from p)::int as xp`,
        [uid, data.jobId],
      );
      const awarded = Number(rows[0]?.["awarded"] ?? 0);
      return { ok: true, awarded: awarded > 0 ? awarded : undefined, xp: Number(rows[0]?.["xp"] ?? 0) };
    } catch (err) {
      console.error("awardRadarPracticeXp failed", err);
      const { neonUserError } = await import("./neon.server");
      return { ok: false, error: neonUserError(err).message };
    }
  });
