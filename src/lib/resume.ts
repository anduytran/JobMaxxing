// Browser-safe resume review types, shared by the server functions and the UI.

export type Grade = "S" | "A" | "B" | "C" | "D" | "F";

export const GRADES: Grade[] = ["S", "A", "B", "C", "D", "F"];

/** rewrite = weak action verb with a suggested fix; metric = bullet missing numbers;
 *  ats = parsing/formatting risk; general = anything else. */
export type SuggestionType = "rewrite" | "metric" | "ats" | "general";

export type ResumeSuggestion = {
  id: string;
  title: string;
  detail: string;
  category: string;
  xp: number;
  applied: boolean;
  type?: SuggestionType;
  /** Line in the resume this targets (matches ResumeLine.id). */
  lineId?: string | null;
  before?: string | null;
  after?: string | null;
  question?: string | null;
};

export type ResumeLine = { id: string; text: string };
export type ResumeSection = { id: string; heading: string; lines: ResumeLine[] };

export type AtsCheck = {
  /** 0-100 compatibility estimate. */
  score: number;
  usesTablesOrColumns: boolean;
  headers: { experience: boolean; education: boolean; projects: boolean };
  issues: string[];
};

export const XP_RULES = { firstScan: 20, perFix: 15, levelUp: 50, levelUpScore: 80 } as const;

/** Fixes come in batches this size: the grader always shows the highest-impact few,
 *  and the next batch only unlocks once every one of these is integrated. */
export const SUGGESTION_BATCH = 3;


export type ResumeVersion = { id: string; version: number; fileName: string; note: string | null; createdAt: string; score: number | null; grade: Grade | null };

export type ResumeExperience = {
  company: string | null;
  role: string | null;
  start: string | null;
  end: string | null;
};

export type ResumeEducation = {
  school: string | null;
  degree: string | null;
  year: string | null;
};

export type ResumeFields = {
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  title: string | null;
  linkedin: string | null;
  github: string | null;
  yearsExperience: number | null;
  skills: string[];
  experience: ResumeExperience[];
  education: ResumeEducation[];
  major?: string | null;
  degreeLevel?: string | null;
  graduationYear?: string | null;
  graduated?: boolean | null;
  qualifications?: string[];
  frameworks?: string[];
};

export const EMPTY_FIELDS: ResumeFields = {
  name: null, email: null, phone: null, location: null, title: null, linkedin: null, github: null,
  yearsExperience: null, skills: [], experience: [], education: [],
};

export type ResumeReview = {
  grade: Grade;
  score: number;
  summary: string;
  suggestions: ResumeSuggestion[];
  fields: ResumeFields;
  /** "raia" when the real Resume Agent graded it, "fallback" when the offline checker did. */
  source: "raia" | "fallback";
  ats?: AtsCheck | null;
  sections?: ResumeSection[];
};

export type StoredReview = ResumeReview & {
  id: string;
  fileName: string;
  xpAwarded: number;
  createdAt: string;
  versionId?: string | null;
  version?: number | null;
};

/** Grade styling, always through semantic tokens so theming and dark mode keep working. */
export const GRADE_META: Record<Grade, { label: string; text: string; border: string; bg: string; fill: string }> = {
  S: { label: "Exceptional", text: "text-success", border: "border-success/60", bg: "bg-success/10", fill: "bg-success" },
  A: { label: "Strong", text: "text-success", border: "border-success/50", bg: "bg-success/10", fill: "bg-success" },
  B: { label: "Solid", text: "text-primary", border: "border-primary/50", bg: "bg-primary/10", fill: "bg-primary" },
  C: { label: "Needs work", text: "text-accent", border: "border-accent/50", bg: "bg-accent/10", fill: "bg-accent" },
  D: { label: "Weak", text: "text-destructive", border: "border-destructive/50", bg: "bg-destructive/10", fill: "bg-destructive" },
  F: { label: "Not competitive", text: "text-destructive", border: "border-destructive/60", bg: "bg-destructive/10", fill: "bg-destructive" },
};

export const gradeFromScore = (score: number): Grade =>
  score >= 90 ? "S" : score >= 80 ? "A" : score >= 68 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "F";

export const CATEGORY_LABEL: Record<string, string> = {
  impact: "Impact",
  keywords: "Keywords",
  formatting: "Formatting",
  structure: "Structure",
  credibility: "Credibility",
  other: "General",
};
