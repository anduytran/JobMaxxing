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
  .inputValidator((i: { transcript: TranscriptTurn[]; job: ParsedJob }) => {
    if (!Array.isArray(i.transcript) || i.transcript.length > 200) throw new Error("Invalid transcript.");
    return {
      job: i.job,
      transcript: i.transcript.map((t) => ({ ...t, text: String(t.text).slice(0, 4000) })),
    };
  })
  .handler(async ({ data }) => {
    const { gradeInterview } = await import("./interview/agents.server");
    return gradeInterview(data.transcript, data.job);
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
