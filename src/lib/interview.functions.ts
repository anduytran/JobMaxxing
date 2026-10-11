import { createServerFn } from "@tanstack/react-start";
import type { InterviewLength, InterviewQuestion, InterviewType, ParsedJob, TranscriptTurn } from "./interview/types";

const TYPES = ["technical", "behavioral", "mixed", "resume"] as const;
const LENS = ["quick", "short", "standard", "long"] as const;

export const getInterviewAgents = createServerFn({ method: "GET" }).handler(async () => {
  const { agentStatus } = await import("./interview/agents.server");
  return agentStatus();
});

export const parseJobDescription = createServerFn({ method: "POST" })
  .inputValidator((i: { jd: unknown }) => {
    const jd = typeof i.jd === "string" ? i.jd.trim().slice(0, 12000) : "";
    if (jd.length < 40) throw new Error("Paste a longer job description.");
    return { jd };
  })
  .handler(async ({ data }) => {
    const { parseJob } = await import("./interview/agents.server");
    return parseJob(data.jd);
  });

// Fetches a public job posting URL server-side and extracts readable text so
// the Job Parser can work from the live posting instead of a pasted description.
export const fetchJobPosting = createServerFn({ method: "POST" })
  .inputValidator((i: { url: unknown }) => {
    const url = typeof i.url === "string" ? i.url.trim() : "";
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new Error("That job link doesn't look valid."); }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("That job link doesn't look valid.");
    return { url: parsed.toString() };
  })
  .handler(async ({ data }) => {
    const res = await fetch(data.url, {
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; JobMaxxing/1.0)", accept: "text/html,*/*" },
    });
    if (!res.ok) throw new Error(`Couldn't open that posting (${res.status}). Paste the description instead.`);
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 12000);
    if (text.length < 200) throw new Error("That posting didn't have readable text. Paste the description instead.");
    return { text };
  });

// URL mode: when the direct fetch can't read a posting (JS-heavy boards, bot
// walls), the Job Parser agent itself web-searches the URL and parses what it
// finds. Returns null when the agent can't find the posting either.
export const parseJobUrl = createServerFn({ method: "POST" })
  .inputValidator((i: { url: unknown; hint?: unknown }) => {
    const url = typeof i.url === "string" ? i.url.trim() : "";
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new Error("That job link doesn't look valid."); }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("That job link doesn't look valid.");
    const hint = typeof i.hint === "string" ? i.hint.trim().slice(0, 400) : "";
    return { url: parsed.toString(), hint };
  })
  .handler(async ({ data }) => {
    const { parseJobFromUrl } = await import("./interview/agents.server");
    const job = await parseJobFromUrl(data.url, data.hint || undefined);
    if (!job) throw new Error("Couldn't read that posting, even with a web search. Paste the description instead.");
    return job;
  });

export const generateInterviewQuestions = createServerFn({ method: "POST" })
  .inputValidator((i: { job: ParsedJob; type: unknown; length: unknown; roast: unknown }) => ({
    job: i.job,
    type: (TYPES.includes(i.type as InterviewType) ? i.type : "mixed") as InterviewType,
    length: (LENS.includes(i.length as InterviewLength) ? i.length : "standard") as InterviewLength,
    roast: i.roast === true,
  }))
  .handler(async ({ data }) => {
    const { generateQuestions } = await import("./interview/agents.server");
    let resumeText: string | undefined;
    if (data.type === "resume") {
      try {
        const { currentUser } = await import("./auth.server");
        const user = await currentUser();
        if (user) {
          const { neonExecute } = await import("./neon.server");
          const r = await neonExecute(
            `select sections from public.devup_resume_version where user_id = $1 order by version desc limit 1`,
            [user.id],
          );
          const sections = (r.rows[0]?.["sections"] as { heading?: string; lines?: { text?: string }[] }[] | null) ?? [];
          resumeText = sections
            .map((s) => [s.heading ?? "", ...(s.lines ?? []).map((l) => l.text ?? "")].filter(Boolean).join("\n"))
            .filter(Boolean)
            .join("\n\n") || undefined;
        }
      } catch (e) { console.error("resume fetch for interview failed", e); }
    }
    return generateQuestions(data.job, data.type, data.length, data.roast, resumeText);
  });

// Saves the interview the moment it starts (score 0, empty transcript) so it
// always lands in Career; grading upserts the same row with the real result.
export const saveSoloSession = createServerFn({ method: "POST" })
  .inputValidator((i: { job: ParsedJob; type: unknown }) => ({
    job: i.job,
    type: (TYPES.includes(i.type as InterviewType) ? i.type : "mixed") as InterviewType,
  }))
  .handler(async ({ data }) => {
    const { currentUser } = await import("./auth.server");
    const user = await currentUser();
    if (!user) return { ok: false };
    const { neonExecute } = await import("./neon.server");
    const r = await neonExecute(
      `insert into public.devup_interview (user_id, job, type, overall, grade, transcript)
       values ($1, $2, $3, 0, null, '[]'::jsonb) returning id::text as id`,
      [user.id, data.job?.title ?? null, data.type],
    ).catch((e) => { console.error("interview start save failed", e); return { rows: [] as Record<string, unknown>[] }; });
    return { id: (r.rows[0]?.["id"] as string) ?? null };
  });

export const gradeInterviewTranscript = createServerFn({ method: "POST" })
  .inputValidator((i: { transcript: TranscriptTurn[]; job: ParsedJob; plan?: InterviewQuestion[]; sessionId?: unknown; type?: unknown }) => {
    if (!Array.isArray(i.transcript) || i.transcript.length > 200) throw new Error("Invalid transcript.");
    return {
      job: i.job,
      type: (TYPES.includes(i.type as InterviewType) ? i.type : null) as InterviewType | null,
      sessionId: typeof i.sessionId === "string" && /^[0-9a-f-]{36}$/i.test(i.sessionId) ? i.sessionId : null,
      transcript: i.transcript.map((t) => ({ ...t, text: String(t.text).slice(0, 4000) })),
      plan: (Array.isArray(i.plan) ? i.plan.slice(0, 12) : []).map((q) => ({
        id: String(q.id), kind: q.kind === "technical" ? "technical" as const : "behavioral" as const,
        text: String(q.text).slice(0, 2000), skill: q.skill ? String(q.skill).slice(0, 100) : null,
      })),
    };
  })
  .handler(async ({ data }) => {
    const { gradeInterview } = await import("./interview/agents.server");
    const grade = await gradeInterview(data.transcript, data.job);
    let ratings: import("./mmr.server").RatingChange[] = [];
    try {
      const { currentUser } = await import("./auth.server");
      const user = await currentUser();
      const answered = data.transcript.filter((t) => t.speaker === "candidate" && t.phase === "interview").length;
      if (user && answered > 0) {
        const { applySessionRatings, scoredItems } = await import("./mmr.server");
        ratings = await applySessionRatings(user.id, scoredItems(data.plan, answered, grade.metrics.quality.score));
      }
      if (user) {
        const { refreshSkills } = await import("./skills.server");
        await refreshSkills(user.id, {
          kind: "mock interview (candidate)", job: data.job?.title ?? null, skills: data.job?.skills ?? [],
          overall: grade.overall, metrics: Object.fromEntries(Object.entries(grade.metrics).map(([k, v]) => [k, v ? v.score : null])),
          strengths: grade.strengths, improvements: grade.improvements,
        });
        const { neonExecute } = await import("./neon.server");
        const saveArgs = [user.id, data.job?.title ?? null, data.type ?? (data.plan.some((q) => q.kind === "technical") ? (data.plan.every((q) => q.kind === "technical") ? "technical" : "mixed") : "behavioral"),
          Math.round(Number(grade.overall) || 0), JSON.stringify(grade), JSON.stringify(data.transcript)];
        await (data.sessionId
          ? neonExecute(
              `update public.devup_interview set overall = $4, grade = $5::jsonb, transcript = $6::jsonb, deleted_at = null
               where id = $7::uuid and user_id = $1`,
              [...saveArgs, data.sessionId],
            )
          : neonExecute(
              `insert into public.devup_interview (user_id, job, type, overall, grade, transcript) values ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
              saveArgs,
            )
        ).catch((e) => console.error("interview save failed", e));
        const { bumpStreak } = await import("./career.functions");
        await bumpStreak(user.id).catch((e) => console.error("streak update failed", e));
        const { listRatings } = await import("./mmr.server");
        const now = await listRatings(user.id);
        const before = new Map(ratings.map((r) => [r.skill, r]));
        ratings = now.map((r) => ({ skill: r.skill, before: before.get(r.skill)?.before ?? r.rating, after: r.rating, answered: r.answered }));
      }
    } catch (e) { console.error("rating update failed", e); }
    return { ...grade, ratings };
  });

export const getSkillRatings = createServerFn({ method: "GET" }).handler(async () => {
  const { currentUser } = await import("./auth.server");
  const user = await currentUser();
  if (!user) return [];
  const { listRatings } = await import("./mmr.server");
  const { lastRefreshAge, refreshSkills } = await import("./skills.server");
  // First visit: let the Skill Expert backfill ratings from existing activity.
  if ((await lastRefreshAge(user.id)) === null) {
    await refreshSkills(user.id).catch((e) => console.error("skill backfill failed", e));
  }
  return listRatings(user.id);
});

/** Recent skill-rating rises for the skill web (ratings never go down, so only rises exist). */
export const getSkillChanges = createServerFn({ method: "GET" }).handler(async () => {
  const { currentUser } = await import("./auth.server");
  const user = await currentUser();
  if (!user) return [];
  const { listRatingChanges } = await import("./mmr.server");
  return listRatingChanges(user.id);
});

/** Ask the Skill Expert to re-rate now (at most once every 2 minutes). Ratings never go down. */
export const refreshSkillRatings = createServerFn({ method: "POST" }).handler(async () => {
  const { requireUser } = await import("./auth.server");
  const user = await requireUser();
  const { lastRefreshAge, refreshSkills } = await import("./skills.server");
  const age = await lastRefreshAge(user.id);
  if (age === null || age > 120) await refreshSkills(user.id);
  const { listRatings } = await import("./mmr.server");
  return listRatings(user.id);
});

/** Tracked skills on the skill web; these are what the Skill Expert grades. */
export const getTrackedSkills = createServerFn({ method: "GET" }).handler(async () => {
  const { currentUser } = await import("./auth.server");
  const user = await currentUser();
  const { DEFAULT_TRACKED } = await import("./mmr.shared");
  if (!user) return DEFAULT_TRACKED;
  const { getTracked } = await import("./skills.server");
  return getTracked(user.id);
});

export const saveTrackedSkills = createServerFn({ method: "POST" })
  .inputValidator((i: { skills: unknown }) => ({ skills: Array.isArray(i.skills) ? i.skills.map(String) : [] }))
  .handler(async ({ data }) => {
    const { requireUser } = await import("./auth.server");
    const user = await requireUser();
    const { setTracked, refreshSkills } = await import("./skills.server");
    const skills = await setTracked(user.id, data.skills);
    await refreshSkills(user.id).catch((e) => console.error("skill refresh failed", e));
    const { listRatings } = await import("./mmr.server");
    return { skills, ratings: await listRatings(user.id) };
  });

export const startLiveInterview = createServerFn({ method: "POST" })
  .inputValidator((i: { job: ParsedJob; type: unknown; length: unknown; roast: unknown; plan: InterviewQuestion[] }) => ({
    job: i.job,
    type: (TYPES.includes(i.type as InterviewType) ? i.type : "mixed") as InterviewType,
    length: (LENS.includes(i.length as InterviewLength) ? i.length : "standard") as InterviewLength,
    roast: i.roast === true,
    plan: Array.isArray(i.plan) ? i.plan.slice(0, 12) : [],
  }))
  .handler(async ({ data }) => {
    const { requireUser } = await import("./auth.server");
    const user = await requireUser();
    const { startInterviewConversation } = await import("./interview/agents.server");
    const u = user as { id: string; name?: string; email?: string };
    return startInterviewConversation({ ...data, userId: u.id, name: u.name ?? u.email?.split("@")[0] ?? "Candidate" });
  });

export const sendInterviewTurn = createServerFn({ method: "POST" })
  .inputValidator((i: { conversationId: unknown; text: unknown; phase: unknown; secondsLeft: unknown; lastQuestion: unknown }) => {
    const conversationId = String(i.conversationId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(conversationId)) throw new Error("Invalid conversation.");
    const text = String(i.text ?? "").trim().slice(0, 4000);
    if (!text) throw new Error("Empty answer.");
    return {
      conversationId, text,
      phase: (i.phase === "candidate_questions" ? "candidate_questions" : "interview") as TranscriptTurn["phase"],
      secondsLeft: Number(i.secondsLeft) || 0,
      lastQuestion: i.lastQuestion === true,
    };
  })
  .handler(async ({ data }) => {
    const { requireUser } = await import("./auth.server");
    await requireUser();
    const { continueInterviewConversation } = await import("./interview/agents.server");
    return continueInterviewConversation(data);
  });

export const speakInterviewLine = createServerFn({ method: "POST" })
  .inputValidator((i: { text: unknown }) => {
    const text = String(i.text ?? "").trim().slice(0, 1200);
    if (!text) throw new Error("Nothing to say.");
    return { text };
  })
  .handler(async ({ data }) => {
    const { requireUser } = await import("./auth.server");
    await requireUser();
    const { synthesize } = await import("./interview/agents.server");
    return { audio: await synthesize(data.text) };
  });

/** Single-use ElevenLabs realtime transcription token (15 min). The API key stays on the server. */
export const getScribeToken = createServerFn({ method: "POST" }).handler(async () => {
  const { requireUser } = await import("./auth.server");
  await requireUser();
  const key = process.env["ELEVENLABS_API_KEY"];
  if (!key) return { token: null as string | null };
  const res = await fetch("https://api.elevenlabs.io/v1/single-use-token/realtime_scribe", { method: "POST", headers: { "xi-api-key": key } });
  if (!res.ok) { console.error("Scribe token failed", res.status, await res.text()); return { token: null as string | null }; }
  const data = (await res.json()) as { token?: string };
  return { token: data.token ?? null };
});
