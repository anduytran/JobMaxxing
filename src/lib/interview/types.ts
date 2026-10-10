// Shared, browser-safe types for the mock interview pipeline.
export type InterviewType = "technical" | "behavioral" | "mixed";
export type InterviewLength = "short" | "standard" | "long";

export const LENGTHS: Record<InterviewLength, { label: string; seconds: number; questions: number }> = {
  short: { label: "Short · ~3 min", seconds: 180, questions: 3 },
  standard: { label: "Standard · ~6 min", seconds: 360, questions: 5 },
  long: { label: "Long · ~10 min", seconds: 600, questions: 8 },
};

export type ParsedJob = {
  title: string | null;
  summary: string;
  skills: string[];
  qualifications: string[];
};

export type InterviewQuestion = {
  id: string;
  kind: "technical" | "behavioral";
  text: string;
  skill: string | null;
};

export type TranscriptTurn = {
  speaker: "interviewer" | "candidate";
  phase: "interview" | "candidate_questions";
  text: string;
  questionId?: string;
};

export type MetricScore = { score: number; feedback: string };

export type InterviewGrade = {
  overall: number;
  xp: number;
  metrics: {
    quality: MetricScore;
    conciseness: MetricScore;
    candidateQuestions: MetricScore;
    tone: MetricScore | null; // stretch goal — null until a tone-capable agent exists
  };
  strengths: string[];
  improvements: string[];
};

/** Which pipeline stage is served by a real agent vs the built-in fallback. */
export type AgentStatus = {
  parser: "raia" | "fallback";
  questions: "raia" | "fallback";
  grader: "raia" | "fallback";
  voice: "elevenlabs" | "browser";
};
