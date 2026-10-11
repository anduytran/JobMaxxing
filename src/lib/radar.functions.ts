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

/** Source-agnostic listing. id is prefixed ("adz_", "rem_", "muse_", "joo_") so rows
 *  from different job boards never collide in devup_job_radar. */
type RawListing = {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  salaryMin: number | null;
  salaryMax: number | null;
  postedAt: string;
  contractTime: string | null;
};

const stripHtml = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();

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

const STOP = new Set(["and", "the", "for", "with", "sr", "jr", "i", "ii", "iii", "of", "a", "an", "to", "in"]);
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#]+/g, " ").split(" ").filter((w) => w && !STOP.has(w));
/** 1 = exact phrase in title, 0.75 = every key word in title, 0.4 = most, 0 = weak. */
function titleFit(title: string, role: string): number {
  const t = title.toLowerCase();
  if (t.includes(role.toLowerCase())) return 1;
  const tw = new Set(words(title));
  const rw = words(role);
  if (!rw.length) return 0;
  // Exact word, or a prefix match where both words are long enough to be meaningful
  // ("architect" ~ "architecture"). Short words like "ai" must match exactly, so
  // "aide"/"airport" never count as "ai".
  const hit = rw.filter((w) => tw.has(w) || (w.length > 3 && [...tw].some((x) => x.length > 3 && (x.startsWith(w) || w.startsWith(x))))).length / rw.length;
  return hit === 1 ? 0.75 : hit >= 0.5 && rw.length > 2 ? 0.4 : 0;
}

const tokens = (s: string | undefined) =>
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
  const descLower = job.description.toLowerCase();
  const fit = Math.max(0, ...roleTokens.map((t) => titleFit(job.title, t)));
  if (fit >= 0.75) { score += fit === 1 ? 35 : 28; why.push("Matches your target role"); }
  else if (fit > 0) { score += 12; why.push("Close to your target role"); }
  else if (roleTokens.some((t) => descLower.includes(t))) score += 4;

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

async function fetchAdzuna(roles: string[], where: string | undefined): Promise<RawListing[]> {
  const appId = process.env["ADZUNA_APPLICATION_ID"];
  const appKey = process.env["ADZUNA_API_KEY"];
  if (!appId || !appKey) return [];
  const seen = new Set<string>();
  const jobs: AdzunaListing[] = [];
  // Title-only search per target role: plain "what" matches any word anywhere in the
  // description, which is why "AI Architect" pulled warehouse and sales roles.
  const search = async (params: Record<string, string>, page: number) => {
    const url = new URL(`https://api.adzuna.com/v1/api/jobs/us/search/${page}`);
    url.searchParams.set("app_id", appId);
    url.searchParams.set("app_key", appKey);
    url.searchParams.set("results_per_page", "25");
    url.searchParams.set("max_days_old", "30");
    url.searchParams.set("sort_by", "relevance");
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    if (where) url.searchParams.set("where", where);
    url.searchParams.set("content-type", "application/json");
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) { console.error("Adzuna search failed", res.status, (await res.text()).slice(0, 300)); return; }
      const body = (await res.json()) as { results?: AdzunaListing[] };
      for (const l of body.results ?? []) if (!seen.has(String(l.id))) { seen.add(String(l.id)); jobs.push(l); }
    } catch (err) { console.error("Adzuna fetch error", err); }
  };
  for (const role of roles) {
    await search({ title_only: role }, 1);
    if (jobs.length < 20) await search({ title_only: role }, 2);
  }
  // Too few exact titles (rare roles): widen to the exact phrase anywhere.
  if (jobs.length < 8) for (const role of roles) await search({ what_phrase: role }, 1);
  return jobs.map((l) => ({
    id: `adz_${l.id}`,
    title: String(l.title ?? ""),
    company: l.company?.display_name ?? "Unknown company",
    location: l.location?.display_name ?? "",
    description: l.description ?? "",
    url: l.redirect_url ?? "",
    salaryMin: typeof l.salary_min === "number" ? Math.round(l.salary_min) : null,
    salaryMax: typeof l.salary_max === "number" ? Math.round(l.salary_max) : null,
    postedAt: l.created ?? "",
    contractTime: l.contract_time ?? null,
  }));
}

/** Remotive: free, keyless, remote tech jobs. One search per target role. */
async function fetchRemotive(roles: string[]): Promise<RawListing[]> {
  const out: RawListing[] = [];
  for (const role of roles) {
    try {
      const res = await fetch(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(role)}&limit=50`, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) { console.error("Remotive search failed", res.status); continue; }
      const body = (await res.json()) as { jobs?: any[] };
      for (const j of body.jobs ?? []) {
        out.push({
          id: `rem_${j.id}`,
          title: String(j.title ?? ""),
          company: String(j.company_name ?? "Unknown company"),
          location: String(j.candidate_required_location ?? "Remote") || "Remote",
          description: stripHtml(String(j.description ?? "")),
          url: String(j.url ?? ""),
          salaryMin: null,
          salaryMax: null,
          postedAt: String(j.publication_date ?? ""),
          contractTime: j.job_type ? String(j.job_type) : null,
        });
      }
    } catch (err) { console.error("Remotive fetch error", err); }
  }
  return out;
}

/** The Muse: free public API, no key. Searches by location, so the title gate does the
 *  role filtering. Skipped when the user only wants remote (The Muse is location-based). */
async function fetchTheMuse(where: string | undefined): Promise<RawListing[]> {
  if (!where) return [];
  const out: RawListing[] = [];
  for (let page = 1; page <= 2; page++) {
    try {
      const url = new URL("https://www.themuse.com/api/public/jobs");
      url.searchParams.set("location", where);
      url.searchParams.set("page", String(page));
      url.searchParams.set("descending", "true");
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15_000),
        // The Muse's CDN rejects requests without a browser-like user agent.
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", Accept: "application/json" },
      });
      if (!res.ok) { console.error("The Muse search failed", res.status); break; }
      const body = (await res.json()) as { results?: any[] };
      for (const j of body.results ?? []) {
        out.push({
          id: `muse_${j.id}`,
          title: String(j.name ?? ""),
          company: String(j.company?.name ?? "Unknown company"),
          location: Array.isArray(j.locations) ? j.locations.map((l: any) => l?.name).filter(Boolean).join(", ") : "",
          description: stripHtml(String(j.contents ?? "")),
          url: String(j.refs?.landing_page ?? ""),
          salaryMin: null,
          salaryMax: null,
          postedAt: String(j.publication_date ?? ""),
          contractTime: null,
        });
      }
    } catch (err) { console.error("The Muse fetch error", err); break; }
  }
  return out;
}

/** Jooble: broad aggregator, free API key required. Skipped until JOOBLE_API_KEY is set. */
async function fetchJooble(roles: string[], where: string | undefined): Promise<RawListing[]> {
  const apiKey = process.env["JOOBLE_API_KEY"];
  if (!apiKey) return [];
  const out: RawListing[] = [];
  for (const role of roles) {
    try {
      const res = await fetch(`https://jooble.org/api/${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: role, ...(where ? { location: where } : {}) }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) { console.error("Jooble search failed", res.status, (await res.text()).slice(0, 300)); continue; }
      const body = (await res.json()) as { jobs?: any[] };
      for (const j of body.jobs ?? []) {
        // Jooble has no stable id — hash the link so refreshes dedupe correctly.
        const link = String(j.link ?? "");
        let h = 0;
        for (let i = 0; i < link.length; i++) h = (h * 31 + link.charCodeAt(i)) >>> 0;
        out.push({
          id: `joo_${h.toString(36)}`,
          title: String(j.title ?? ""),
          company: String(j.company ?? "Unknown company"),
          location: String(j.location ?? ""),
          description: stripHtml(String(j.snippet ?? "")),
          url: link,
          salaryMin: parseSalary(String(j.salary ?? "")),
          salaryMax: null,
          postedAt: String(j.updated ?? ""),
          contractTime: j.type ? String(j.type) : null,
        });
      }
    } catch (err) { console.error("Jooble fetch error", err); }
  }
  return out;
}

async function fetchJobs(prefs: JobPrefs, userId?: string): Promise<{ listings: RawListing[]; error?: string }> {
  const roles = tokens(prefs.roles).slice(0, 3);
  if (!roles.length) roles.push("software developer");
  const where = tokens(prefs.locations).filter((t) => !/^remote/.test(t))[0];
  const wantRemote = /remote/i.test(prefs.workMode ?? "") || /remote/i.test(prefs.locations ?? "");

  const [adzuna, remotive, muse, jooble] = await Promise.all([
    fetchAdzuna(roles, where),
    fetchRemotive(roles),
    fetchTheMuse(where),
    fetchJooble(roles, where),
  ]);
  const seen = new Set<string>();
  const jobs: RawListing[] = [];
  for (const l of [...adzuna, ...(wantRemote ? remotive : []), ...muse, ...jooble]) {
    if (seen.has(l.id)) continue;
    seen.add(l.id);
    jobs.push(l);
  }
  const error = jobs.length ? undefined : "No listings came back from any job board — try again in a moment.";

  // Cheap regex pre-filter first (no API calls): drop titles that share nothing with a
  // target role. Then one batched agent call makes the relevance call on the
  // survivors; if the agent is unreachable, the regex survivors stand.
  const filtered = jobs.filter((l) => roles.some((r) => titleFit(l.title, r) > 0));
  const { filterRadarTitles } = await import("./interview/agents.server");
  const keep = await filterRadarTitles(filtered.map((l) => l.title), roles, userId);
  return { listings: keep ? keep.map((i) => filtered[i]!) : filtered, ...(error ? { error } : {}) };
}

const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s && s.length <= max ? s : null;
};

/** One generation keeps only this many best-scoring roles; the rest are never saved. */
const MATCHES_PER_GENERATION = 5;

/** Keeps listings inside the user's areas; remote roles count when they want remote. */
function inArea(id: string, location: string, description: string, locTokens: string[], wantRemote: boolean) {
  if (!locTokens.length) return true;
  if (locTokens.some((t) => location.toLowerCase().includes(t))) return true;
  // Adzuna, The Muse and Jooble were queried with the user's location, so their
  // metro-area results (e.g. "Edgewood, Orange County" for Orlando) count as local.
  if (/^(adz|muse|joo)_/.test(id)) return true;
  return wantRemote && /remote|work from home|anywhere/i.test(`${location} ${description}`);
}

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

      // Area rules and a per-listing skills cache are shared by the refresh below and
      // the read-time scoring further down, so each listing's skills are read once.
      const locTokens = tokens(prefs.locations).filter((t) => !/^remote/.test(t));
      const wantRemote = /remote/i.test(prefs.workMode ?? "") || /remote/i.test(prefs.locations ?? "");
      const skillsCache = new Map<string, string[]>();
      const skillsOf = async (id: string, text: string) => {
        let s = skillsCache.get(id);
        if (!s) { s = await extractSkills(text); skillsCache.set(id, s); }
        return s;
      };
      let fetchError: string | undefined;
      if (data.refresh) {
        const { listings, error } = await fetchJobs(prefs, uid);
        fetchError = error;
        if (listings.length) {
          // Score every candidate that is in the user's areas, then keep only the best
          // few: a generation is five matches, not a wall of listings.
          const pool = listings.filter((l) => inArea(l.id, l.location, l.description, locTokens, wantRemote));
          const scored = await Promise.all(
            pool.map(async (l) => ({
              l,
              match: scoreJob(
                {
                  title: l.title,
                  description: l.description,
                  location: l.location,
                  salaryMin: l.salaryMin,
                  salaryMax: l.salaryMax,
                  skills: await skillsOf(l.id, `${l.title} ${l.description}`),
                },
                { skills: userSkills, prefs },
              ).match,
            })),
          );
          const top = scored.sort((a, b) => b.match - a.match).slice(0, MATCHES_PER_GENERATION).map(({ l }) => l);
          if (top.length) {
            const statements = top.map((l) => ({
              query:
                "insert into public.devup_job_radar (user_id, job_id, data) values ($1, $2, $3::jsonb) " +
                "on conflict (user_id, job_id) do update set data = excluded.data, updated_at = now()",
              params: [uid, l.id, JSON.stringify({
                title: clean(l.title, 200) ?? "Untitled role",
                company: clean(l.company, 120) ?? "Unknown company",
                location: clean(l.location, 160) ?? "",
                description: l.description.replace(/\s+/g, " ").slice(0, 6000),
                url: clean(l.url, 600) ?? "",
                salaryMin: l.salaryMin,
                salaryMax: l.salaryMax,
                postedAt: clean(l.postedAt, 40) ?? "",
                contractTime: clean(l.contractTime, 40) ?? null,
              })],
            }));
            // Drop untouched listings from earlier searches so old titles stop crowding the radar.
            statements.push({
              query: "delete from public.devup_job_radar where user_id = $1 and status = 'new' and not (job_id = any($2::text[]))",
              params: [uid, top.map((l) => l.id)],
            } as never);
            await neonExecute(statements);
          }
        }
      }

      const { rows } = await neonExecute(
        "select job_id, data, status, viewed from public.devup_job_radar where user_id = $1",
        [uid],
      );
      // Area rules were already applied to the listings saved above; re-check here so
      // stale rows from older searches drop out too.
      const jobs: RadarJob[] = [];
      for (const r of rows) {
        const d = (r["data"] ?? {}) as any; // Adzuna snapshot: free-form keys, validated field by field below
        if (!inArea(String(r["job_id"]), String(d.location ?? ""), String(d.description ?? ""), locTokens, wantRemote)) continue;
        const title = String(d.title ?? "Untitled role");
        const description = String(d.description ?? "");
        const jdSkills = await skillsOf(String(r["job_id"]), `${title} ${description}`);
        const s = scoreJob(
          { title, description, location: String(d.location ?? ""), salaryMin: d.salaryMin ?? null, salaryMax: d.salaryMax ?? null, skills: jdSkills },
          { skills: userSkills, prefs },
        );
        const status = RADAR_STATUSES.includes(r["status"] as RadarStatus) ? (r["status"] as RadarStatus) : "new";
        jobs.push({
          id: String(r["job_id"]),
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
          viewed: Boolean(r["viewed"]),
        });
      }
      jobs.sort((a, b) => (a.status === "dismissed" ? 1 : 0) - (b.status === "dismissed" ? 1 : 0) || b.match - a.match);
      return { ok: true, jobs, ...(fetchError ? { error: fetchError } : {}) };
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
    if (!jobId || !/^[a-z0-9_-]{3,48}$/i.test(jobId)) throw new Error("Invalid role.");
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
      return { ok: true, ...(awarded > 0 ? { awarded } : {}), xp: Number(rows[0]?.["xp"] ?? 0) };
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
    if (!jobId || !/^[a-z0-9_-]{3,48}$/i.test(jobId)) throw new Error("Invalid role.");
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
      return { ok: true, ...(awarded > 0 ? { awarded } : {}), xp: Number(rows[0]?.["xp"] ?? 0) };
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
    if (!jobId || !/^[a-z0-9_-]{3,48}$/i.test(jobId)) throw new Error("Invalid role.");
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
      return { ok: true, ...(awarded > 0 ? { awarded } : {}), xp: Number(rows[0]?.["xp"] ?? 0) };
    } catch (err) {
      console.error("awardRadarPracticeXp failed", err);
      const { neonUserError } = await import("./neon.server");
      return { ok: false, error: neonUserError(err).message };
    }
  });
