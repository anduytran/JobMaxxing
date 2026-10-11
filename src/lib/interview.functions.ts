import { createServerFn } from "@tanstack/react-start";
import type { InterviewLength, InterviewQuestion, InterviewType, ParsedJob, TranscriptTurn } from "./interview/types";

const TYPES = ["technical", "behavioral", "mixed"] as const;
const LENS = ["short", "standard", "long"] as const;

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

export const generateInterviewQuestions = createServerFn({ method: "POST" })
  .inputValidator((i: { job: ParsedJob; type: unknown; length: unknown; roast: unknown }) => ({
    job: i.job,
    type: (TYPES.includes(i.type as InterviewType) ? i.type : "mixed") as InterviewType,
    length: (LENS.includes(i.length as InterviewLength) ? i.length : "standard") as InterviewLength,
    roast: i.roast === true,
  }))
  .handler(async ({ data }) => {
    const { generateQuestions } = await import("./interview/agents.server");
    return generateQuestions(data.job, data.type, data.length, data.roast);
  });

export const gradeInterviewTranscript = createServerFn({ method: "POST" })
  .inputValidator((i: { transcript: TranscriptTurn[]; job: ParsedJob; plan?: InterviewQuestion[] }) => {
    if (!Array.isArray(i.transcript) || i.transcript.length > 200) throw new Error("Invalid transcript.");
    return {
      job: i.job,
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
