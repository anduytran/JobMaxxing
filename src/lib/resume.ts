// Browser-safe resume review types, shared by the server functions and the UI.

export type Grade = "S" | "A" | "B" | "C" | "D" | "F";

export const GRADES: Grade[] = ["S", "A", "B", "C", "D", "F"];

export type ResumeSuggestion = {
  id: string;
  title: string;
  detail: string;
  category: string;
  xp: number;
  applied: boolean;
};

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
};

export type StoredReview = ResumeReview & {
  id: string;
  fileName: string;
  xpAwarded: number;
  createdAt: string;
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
