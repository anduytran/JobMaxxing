import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, FileText, Flame, LineChart, Mic } from "lucide-react";
import { Mascot, PanelHead } from "@/components/AppShell";
import { useGame } from "@/lib/game";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ResumeScoreCard } from "@/components/ResumeScoreCard";
import { XpCareerCard } from "@/components/DashboardProgressCards";
import { getLatestResumeReview } from "@/lib/resume.functions";
import type { StoredReview } from "@/lib/resume";

export const Route = createFileRoute("/progress")({
  head: () => ({
    meta: [
      { title: "Career Progress — JobMaxxing" },
      { name: "description", content: "Your resume score, next improvements, interview shortcuts, XP and career milestones in one place." },
      { property: "og:title", content: "Career Progress — JobMaxxing" },
      { property: "og:description", content: "Your resume score, next improvements, interview shortcuts, XP and career milestones in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { name, title, xp, level, levelXp, quests, details, lastGain } = useGame();
  const done = quests.filter((q) => q.done).length;
  const first = name.split(" ")[0] || "there";
  const [review, setReview] = useState<StoredReview | null>(null);
  const [reviewLoading, setReviewLoading] = useState(true);
  useEffect(() => { getLatestResumeReview().then((r) => { if (r.ok) setReview(r.review); }).catch(() => {}).finally(() => setReviewLoading(false)); }, []);
  const resumeScore = review?.score ?? (details.resume as { score?: number } | undefined)?.score;
  const reducedMotion = useReducedMotion();
  const [tip, setTip] = useState(0);
  const tips = [
    "You don't have to have it all figured out. You just have to take the next step.",
    "A good interview is a conversation, not a performance. Take a breath. You've got this.",
    "That thing you think is 'just part of the job'? It might be your best resume story.",
    "Some days, one small step is plenty. Progress still counts.",
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="space-y-8 pb-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Let's make your next move count</p>
            <h1 className="mt-2 text-4xl font-bold md:text-5xl">Looking good, {first} <span className="text-accent">✦</span></h1>
            <p className="mt-2 text-lg text-muted-foreground">{done > 0 ? `${done} quests behind you. Take a moment to appreciate that.` : "Glad you're here. Let's start with one small win."}</p>
          </div>
          <div className="panel flex items-center gap-3 px-5 py-3 text-sm transition-shadow hover:shadow-md">
            <Flame className="animate-flame h-5 w-5 text-primary" /><b>{done} quests done</b><span className="border-l pl-3 text-muted-foreground">Keep it going!</span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link to="/interview" search={{ radar: undefined }} className="hover-lift flex items-center gap-4 rounded-2xl border bg-card p-5">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary"><Mic className="h-6 w-6" /></span>
            <span className="flex-1"><span className="block font-semibold">Interviews</span><span className="text-sm text-muted-foreground">Jump into a mock interview</span></span>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </Link>
          <Link to="/setup" className="hover-lift flex items-center gap-4 rounded-2xl border bg-card p-5">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent/20 text-accent-foreground"><FileText className="h-6 w-6" /></span>
            <span className="flex-1"><span className="block font-semibold">Resume Lab</span><span className="text-sm text-muted-foreground">Grade and polish your resume</span></span>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </Link>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2">
          <ResumeScoreCard review={review} score={resumeScore} loading={reviewLoading} />
          <XpCareerCard xp={xp} level={level} levelXp={levelXp} lastGain={lastGain} title={title} />
        </div>

        <div className="flex items-center gap-5 rounded-2xl border bg-hero/60 p-6">
          <Button variant="ghost" aria-label="Another thought from Max" title="Another thought from Max" className="h-20 w-20 shrink-0 p-0 hover:bg-transparent" onClick={() => setTip((t) => (t + 1) % tips.length)}><Mascot className="h-20 w-20" /></Button>
          <div className="min-w-0"><div className="font-semibold">Max says</div><motion.p key={tip} initial={reducedMotion ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="min-h-12 text-muted-foreground" aria-live="polite">{tips[tip]}</motion.p></div>
        </div>
      </div>
      <div className="panel">
        <PanelHead title="Look how far you've come" level={level} />
        <div className="px-8 pb-10 pt-6 md:px-12">
          <div className="hover-lift rounded-2xl bg-success/10 px-8 py-12 text-center">
            <LineChart className="animate-bob h-8 w-8 text-success" strokeWidth={1.5} />
            <div className="mt-4 text-3xl font-bold text-success md:text-4xl">{xp.toLocaleString()} XP earned</div>
            <div className="mt-2 text-success/80">Level {level} · {done} quest{done === 1 ? "" : "s"} completed</div>
          </div>
          <div>
            {done === 0 && (
              <p className="border-t py-6 text-sm text-muted-foreground">Complete quests and interviews to fill in your milestones.</p>
            )}
            {quests.filter((q) => q.done).map((q) => (
              <div key={q.id} className="flex items-center gap-4 border-t py-6">
                <Check className="h-5 w-5" />
                <span className="text-muted-foreground">{q.title} · +{q.xp} XP</span>
              </div>
            ))}
            <div className="flex items-center gap-4 border-t py-6">
              <Check className="h-5 w-5" />
              <span className="text-muted-foreground">Started your career journey · Level 1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
