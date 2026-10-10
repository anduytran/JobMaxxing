import { ShieldAlert } from "lucide-react";
import { useState } from "react";
import type { ParsedJob } from "@/lib/interview/types";
import { cn } from "@/lib/utils";

const FULL_NOTICE: [string, string][] = [
  ["No company affiliation", "DevUp is an independent practice tool. It is not affiliated with, authorized, endorsed by, sponsored by, or acting on behalf of the company named in your job description, and this interview is not conducted by, watched by, or shared with that company."],
  ["You are talking to an AI", "The interviewer is an automated AI agent with a synthetic name and, if voice is on, a synthetic voice. It is not a recruiter, hiring manager, or any real person, and it has no access to the company's real interview process, questions, or interviewers."],
  ["Not a real interview or evaluation", "The questions, score, feedback, and XP are AI-generated practice estimates. They are not an employer assessment, a hiring decision, a job offer, or a prediction of how a real interview will go, and must not be presented to an employer as interview results."],
  ["Your job description is user-supplied", "The job text is entered by you and is not verified, licensed, or provided by the company. All company names, trademarks, and posting content remain the property of their respective owners and are used only to label your own practice session."],
  ["Where your data goes", "The job text, your answers, and the transcript are sent to DevUp's AI providers for parsing, question generation, and grading, then saved to your DevUp account. Nothing is sent to the company. Don't enter personal details about other people."],
  ["Voice features", "Speaking and hearing use your browser's built-in speech recognition and speech synthesis while the interview is open. DevUp does not record or store audio."],
  ["AI can be wrong", "AI output may be inaccurate, incomplete, or biased. Treat it as practice, not as professional career, legal, or employment advice."],
];

/** Always-visible notice on the AI Mock Interview screen, with the full disclosure expandable. */
export function InterviewDisclosure({ job, className }: { job: ParsedJob | null; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section className={cn("rounded-lg border border-primary/40 bg-primary/5 p-4", className)} aria-label="AI mock interview disclosure">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="space-y-1 text-sm">
          <p className="font-semibold">AI practice interview — no company affiliation</p>
          <p className="text-foreground/85">
            {job?.title ? `The "${job.title}" interviewer` : "The interviewer"} is an AI, not a person or a recruiter. DevUp isn't
            affiliated with, endorsed by, or acting for the company in your job description, and nothing you say here is
            shared with them.
          </p>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="font-mono text-[11px] text-primary underline underline-offset-4 hover:text-primary/80"
          >
            {open ? "Hide the full disclosure" : "Read the full disclosure"}
          </button>
        </div>
      </div>
      {open && (
        <dl className="mt-3 space-y-2 border-t border-primary/20 pt-3 text-sm">
          {FULL_NOTICE.map(([t, d]) => (
            <div key={t} className="grid gap-1 sm:grid-cols-[12rem_1fr]">
              <dt className="font-mono text-[11px] uppercase text-primary/90">{t}</dt>
              <dd className="text-foreground/80">{d}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}


/** Required acknowledgment before a practice interview can start. */
export function AcknowledgeDisclosure({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded border border-border bg-secondary/40 p-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
      />
      <span className="text-foreground/85">
        I understand this is an <b className="text-foreground">AI practice interview</b>, not a real interview with the company in
        the job description, and that the score and feedback are practice estimates, not an employer evaluation.
      </span>
    </label>
  );
}

