import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, FileText, Shuffle, Trophy, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GRADE_META, gradeFromScore, XP_RULES, type StoredReview } from "@/lib/resume";
import { cn } from "@/lib/utils";

export function ResumeScoreCard({ review, score, loading = false }: { review: StoredReview | null; score: number | undefined; loading?: boolean }) {
  const reducedMotion = useReducedMotion();
  const pending = (review?.suggestions ?? []).filter((item) => !item.applied);
  const pendingKey = pending.map((item) => item.id).join("|");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    const ids = pendingKey ? pendingKey.split("|") : [];
    setSelectedId(ids[Math.floor(Math.random() * ids.length)] ?? null);
  }, [pendingKey]);
  const action = pending.find((item) => item.id === selectedId) ?? pending[0];
  const value = typeof score === "number" && Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : null;
  const grade = value === null ? null : gradeFromScore(value);
  const meta = grade ? GRADE_META[grade] : null;
  const target = value === null ? null : [55, 68, 80, 90, 100].find((threshold) => threshold > value);
  const completed = (review?.suggestions ?? []).filter((item) => item.applied).length;
  const shuffle = () => {
    const alternatives = pending.filter((item) => item.id !== action?.id);
    setSelectedId(alternatives[Math.floor(Math.random() * alternatives.length)]?.id ?? null);
  };

  return (
    <section aria-label="Resume score" aria-busy={loading} className="panel hover-lift flex min-w-0 flex-col p-6">
      <div className="mb-4 flex min-w-0 items-center gap-2 text-muted-foreground"><FileText className="h-5 w-5 shrink-0" /><h2 className="text-base font-normal">Resume score</h2></div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <p className="min-w-0 whitespace-nowrap"><span className="text-4xl font-bold tabular-nums">{value ?? "—"}</span><span className="text-sm text-muted-foreground"> / 100</span></p>
        {grade && meta && <span title={meta.label} className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg border text-xl font-bold", meta.bg, meta.border, meta.text)}>{grade}</span>}
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Resume score out of 100" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? 0}>
        <motion.div className={cn("h-full rounded-full", meta?.fill ?? "bg-success")} initial={reducedMotion ? false : { width: 0 }} animate={{ width: `${value ?? 0}%` }} transition={{ duration: reducedMotion ? 0 : 0.6 }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{loading ? "Loading your latest review…" : value === null ? "Your first scan starts here." : target ? <><b className="text-foreground">{target - value} points</b> to {target === 100 ? "a perfect score" : `${GRADE_META[gradeFromScore(target)].label} · ${gradeFromScore(target)} rank`}</> : "Perfect score. Keep your story fresh."}</p>

      <div className="mt-5 flex-1 border-t pt-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <h3 className="min-w-0 text-xs font-semibold uppercase tracking-wider">{action ? "Next small win" : review ? "Quest progress" : "First quest"}</h3>
          {pending.length > 1 && <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground" onClick={shuffle} aria-label="Show another resume improvement" title="Show another resume improvement"><Shuffle className="h-3.5 w-3.5" /></Button>}
        </div>
        {action ? <ul className="mt-2 list-disc space-y-1 pl-4 marker:text-primary" aria-live="polite"><li className="text-sm leading-relaxed"><span className="font-medium">{action.title}</span>{action.detail && <p title={action.detail} className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{action.detail}</p>}</li></ul> : <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{loading ? "Finding your next improvement…" : review ? "All suggested fixes complete. Rescan for your next challenge." : "Scan your resume to unlock personalized improvements."}</p>}
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{action?.type === "metric" ? "Make your impact measurable, so recruiters see the difference you made." : action?.type === "ats" ? "Help your experience reach a recruiter—not get lost in a parser." : "Turn real experience into a story recruiters can recognize."}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
          {action && <span className="flex items-center gap-1 font-semibold text-primary"><Zap className="h-3.5 w-3.5" />+{XP_RULES.perFix} XP per fix</span>}
          {review && <span className="flex items-center gap-1 text-muted-foreground"><Check className="h-3.5 w-3.5 text-success" />{completed}/{review.suggestions.length} fixes</span>}
          {!review && !loading && <span className="flex items-center gap-1 font-semibold text-primary"><Zap className="h-3.5 w-3.5" />+{XP_RULES.firstScan} XP first scan</span>}
        </div>
      </div>
      {value !== null && <p className={cn("mt-4 flex items-start gap-2 text-xs", value > XP_RULES.levelUpScore ? "text-success" : "text-muted-foreground")}><Trophy className="h-4 w-4 shrink-0" /><span>{value > XP_RULES.levelUpScore ? "80+ score milestone reached" : `First score above ${XP_RULES.levelUpScore}: +${XP_RULES.levelUp} XP`}</span></p>}
      <Button asChild variant="outline" className="mt-4 h-auto w-full justify-between gap-2 whitespace-normal py-2 text-sm"><Link to="/setup">{action ? "Improve resume" : review ? "Open Resume Lab" : "Scan resume"}<ArrowRight className="h-4 w-4 shrink-0" /></Link></Button>
    </section>
  );
}