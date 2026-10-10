import { createServerFn } from "@tanstack/react-start";
import type { InterviewLength, InterviewType, ParsedJob, TranscriptTurn } from "./interview/types";

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
