import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Compass, LockKeyhole, Sparkles, Target, Trophy, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { levelTitle, XP_PER_LEVEL } from "@/lib/game";
import { cn } from "@/lib/utils";

function Card({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section aria-label={title} className="panel hover-lift flex min-w-0 flex-col p-6"><div className="mb-5 flex min-w-0 items-center gap-2 text-muted-foreground">{icon}<h2 className="text-base font-normal">{title}</h2></div>{children}</section>;
}

function ProgressMeter({ value, label, fill = "bg-primary" }: { value: number; label: string; fill?: string }) {
  const reduced = useReducedMotion();
  const pct = Math.max(0, Math.min(100, value));
  return <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} className="h-2 overflow-hidden rounded-full bg-muted"><motion.div className={cn("h-full rounded-full", fill)} initial={reduced ? false : { width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: reduced ? 0 : 0.5 }} /></div>;
}

// XP and career rank are one story: the ring is your level, the number is what earned it.
export function XpCareerCard({ xp, level, levelXp, lastGain, title }: { xp: number; level: number; levelXp: number; lastGain: { amount: number; key: number } | null; title: string }) {
  const reduced = useReducedMotion();
  const currentTitle = levelTitle(level);
  const nextTitle = levelTitle(level + 1);
  const titleChanges = currentTitle !== nextTitle;
  const toNext = (XP_PER_LEVEL - levelXp).toLocaleString();
  return <Card title="Career" icon={<Compass className="h-5 w-5 shrink-0" />}>
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative h-32 w-32 shrink-0"><svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full -rotate-90"><circle cx="50" cy="50" r="44" fill="none" stroke="var(--muted)" strokeWidth="5" /><motion.circle cx="50" cy="50" r="44" fill="none" stroke="var(--success)" strokeWidth="5" strokeLinecap="round" strokeDasharray={276.5} initial={reduced ? false : { strokeDashoffset: 276.5 }} animate={{ strokeDashoffset: 276.5 * (1 - levelXp / XP_PER_LEVEL) }} transition={{ duration: reduced ? 0 : 0.7 }} /></svg><div className="absolute inset-0 grid place-content-center text-center"><span className="text-xs text-muted-foreground">LEVEL</span><span className="text-4xl font-bold tabular-nums">{level}</span><span className="max-w-[7rem] truncate text-xs font-semibold">{currentTitle}</span></div></div>
      <div className="min-w-0 flex-1">
        <p className="break-words text-4xl font-bold tabular-nums">{xp.toLocaleString()}<span className="ml-2 text-sm font-medium text-muted-foreground">XP earned</span></p>
        <p className="mt-1 text-xs text-muted-foreground">Through action, not intention.</p>
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs"><span className="font-semibold">Toward level {level + 1}</span><span className="shrink-0 text-muted-foreground">{Math.round(levelXp / XP_PER_LEVEL * 100)}%</span></div>
        <div className="mt-2"><ProgressMeter value={levelXp / XP_PER_LEVEL * 100} label={`Progress to level ${level + 1}`} /></div>
        <p className="mt-2 text-xs text-muted-foreground"><b className="text-foreground">{toNext} XP</b> to go · {title ? `working toward ${title}` : "building your next chapter"}</p>
      </div>
    </div>
    <div className="mt-5 flex-1 border-t pt-4"><h3 className="text-xs font-semibold uppercase tracking-wider">Your progression</h3><ol className="mt-3 flex flex-wrap items-start gap-x-8 gap-y-3"><li className="flex items-start gap-2 text-sm"><Trophy className="mt-0.5 h-4 w-4 shrink-0 text-success" /><span className="min-w-0"><b>{currentTitle}</b><span className="block text-xs text-muted-foreground">Current career rank</span></span></li><li className="flex items-start gap-2 text-sm"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0"><b>{titleChanges ? nextTitle : `Level ${level + 1}`}</b><span className="block text-xs text-muted-foreground">{toNext} XP to reach it</span></span></li></ol></div>
    <div className="mt-4 min-h-7" aria-live="polite"><AnimatePresence mode="wait">{lastGain ? <motion.p key={lastGain.key} initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 text-sm font-semibold text-success"><Sparkles className="h-4 w-4 shrink-0" />+{lastGain.amount} XP · Nice work!</motion.p> : <p className="flex items-center gap-2 text-xs text-muted-foreground"><Target className="h-4 w-4 shrink-0" />Your next win is one action away.</p>}</AnimatePresence></div>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Button asChild variant="outline" className="min-w-0 flex-1 justify-between"><Link to="/quests">Find your next win<ArrowRight className="h-4 w-4 shrink-0" /></Link></Button>
      <Button asChild variant="ghost" className="min-w-0 justify-between text-muted-foreground hover:text-primary"><Link to="/settings">Set career direction<ArrowRight className="h-4 w-4 shrink-0" /></Link></Button>
    </div>
    <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"><Check className="h-4 w-4 shrink-0 text-success" /><span>Your pace. Your path. Progress over comparison.</span></p>
  </Card>;
}
