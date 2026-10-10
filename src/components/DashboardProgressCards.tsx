import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Compass, Flag, LockKeyhole, Sparkles, Target, Trophy, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { levelTitle, XP_PER_LEVEL, type Quest } from "@/lib/game";
import { featuredQuestTitle } from "@/lib/quest-titles";
import { cn } from "@/lib/utils";

function Card({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section aria-label={title} className="panel hover-lift flex min-w-0 flex-col p-6"><div className="mb-5 flex min-w-0 items-center gap-2 text-muted-foreground">{icon}<h2 className="text-base font-normal">{title}</h2></div>{children}</section>;
}

export function ProgressMeter({ value, label, fill = "bg-primary" }: { value: number; label: string; fill?: string }) {
  const reduced = useReducedMotion();
  const pct = Math.max(0, Math.min(100, value));
  return <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} className="h-2 overflow-hidden rounded-full bg-muted"><motion.div className={cn("h-full rounded-full", fill)} initial={reduced ? false : { width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: reduced ? 0 : 0.5 }} /></div>;
}

export function QuestsProgressCard({ quests }: { quests: Quest[] }) {
  const [period, setPeriod] = useState<"daily" | "weekly">("daily");
  const reduced = useReducedMotion();
  const current = quests.filter((quest) => quest.period === period);
  const completed = current.filter((quest) => quest.done).length;
  const available = quests.filter((quest) => !quest.done);
  const next = [...current.filter((quest) => !quest.done)].sort((a, b) => a.xp - b.xp)[0];
  const allDone = current.length > 0 && completed === current.length;
  return <Card title="Your quests" icon={<Flag className="h-5 w-5 shrink-0" />}>
    <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Quest period">{(["daily", "weekly"] as const).map((item) => <Button key={item} variant="ghost" size="sm" aria-pressed={period === item} className={cn("h-8 min-w-0 rounded-md text-xs capitalize", period === item && "bg-card shadow-sm")} onClick={() => setPeriod(item)}>{item}</Button>)}</div>
    <p className="mt-5"><span className="text-4xl font-bold tabular-nums">{completed}</span><span className="text-sm text-muted-foreground"> / {current.length} complete</span></p>
    <div className="mt-4"><ProgressMeter value={current.length ? completed / current.length * 100 : 0} label={`${period} quests completed`} fill="bg-success" /></div>
    <p className="mt-2 text-xs text-muted-foreground">{allDone ? "You showed up. That's a win." : current.length ? "One manageable challenge at a time." : `No ${period} quests yet. Choose your own challenge.`}</p>
    <div className="mt-5 flex-1 border-t pt-4"><h3 className="text-xs font-semibold uppercase tracking-wider">{allDone ? "Mission complete" : "Start small"}</h3><AnimatePresence mode="wait"><motion.div key={period} initial={reduced ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.15 }} className="mt-3">
      {next ? <><p className="text-sm font-medium leading-relaxed">{featuredQuestTitle(next.title)}</p><p className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary"><Zap className="h-3.5 w-3.5" />+{next.xp} XP</p></> : <p className="text-sm leading-relaxed text-muted-foreground">{allDone ? "Explore a different skill or take a well-earned break." : "Find a quest that fits the career you want."}</p>}
    </motion.div></AnimatePresence></div>
    <p className="mt-4 text-xs text-muted-foreground">{available.length} open across your quest log</p>
    <Button asChild variant="outline" className="mt-4 w-full justify-between"><Link to={current.length ? "/quests" : "/quests/add"}>{current.length ? "Choose a quest" : "Discover quests"}<ArrowRight className="h-4 w-4 shrink-0" /></Link></Button>
  </Card>;
}

export function XpProgressCard({ xp, level, levelXp, lastGain }: { xp: number; level: number; levelXp: number; lastGain: { amount: number; key: number } | null }) {
  const reduced = useReducedMotion();
  return <Card title="Total XP" icon={<Zap className="h-5 w-5 shrink-0" />}>
    <p className="break-words text-4xl font-bold tabular-nums">{xp.toLocaleString()}</p><p className="mt-2 text-xs text-muted-foreground">Earned through action, not intention.</p>
    <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs"><span className="font-semibold">Level {level}</span><span className="shrink-0 text-muted-foreground">{Math.round(levelXp / XP_PER_LEVEL * 100)}%</span></div>
    <div className="mt-2"><ProgressMeter value={levelXp / XP_PER_LEVEL * 100} label={`Progress to level ${level + 1}`} /></div>
    <p className="mt-2 text-xs text-muted-foreground"><b className="text-foreground">{(XP_PER_LEVEL - levelXp).toLocaleString()} XP</b> to level {level + 1}</p>
    <div className="mt-5 flex-1 border-t pt-4"><h3 className="text-xs font-semibold uppercase tracking-wider">Every step counts</h3><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Practice an answer. Strengthen a bullet. Pursue a role. Build momentum your way.</p><div className="mt-4 min-h-7" aria-live="polite"><AnimatePresence mode="wait">{lastGain ? <motion.p key={lastGain.key} initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 text-sm font-semibold text-success"><Sparkles className="h-4 w-4 shrink-0" />+{lastGain.amount} XP · Nice work!</motion.p> : <p className="flex items-center gap-2 text-xs text-muted-foreground"><Target className="h-4 w-4 shrink-0" />Your next win is one action away.</p>}</AnimatePresence></div></div>
    <Button asChild variant="outline" className="mt-4 w-full justify-between"><Link to="/quests">Find your next win<ArrowRight className="h-4 w-4 shrink-0" /></Link></Button>
  </Card>;
}

export function CareerProgressCard({ level, levelXp, title }: { level: number; levelXp: number; title: string }) {
  const reduced = useReducedMotion();
  const currentTitle = levelTitle(level);
  const nextTitle = levelTitle(level + 1);
  const titleChanges = currentTitle !== nextTitle;
  return <Card title="Your career" icon={<Compass className="h-5 w-5 shrink-0" />}>
    <div className="relative mx-auto h-36 w-36 shrink-0"><svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full -rotate-90"><circle cx="50" cy="50" r="44" fill="none" stroke="var(--muted)" strokeWidth="5" /><motion.circle cx="50" cy="50" r="44" fill="none" stroke="var(--success)" strokeWidth="5" strokeLinecap="round" strokeDasharray={276.5} initial={reduced ? false : { strokeDashoffset: 276.5 }} animate={{ strokeDashoffset: 276.5 * (1 - levelXp / XP_PER_LEVEL) }} transition={{ duration: reduced ? 0 : 0.7 }} /></svg><div className="absolute inset-0 grid place-content-center text-center"><span className="text-xs text-muted-foreground">LEVEL</span><span className="text-4xl font-bold tabular-nums">{level}</span><span className="text-xs font-semibold">{currentTitle}</span></div></div>
    <p className="mt-3 text-center text-sm text-muted-foreground">{title ? `Working toward ${title}` : "Building your next chapter"}</p>
    <div className="mt-5 flex-1 border-t pt-4"><h3 className="text-xs font-semibold uppercase tracking-wider">Your progression</h3><ol className="mt-3 space-y-3"><li className="flex items-start gap-2 text-sm"><Trophy className="mt-0.5 h-4 w-4 shrink-0 text-success" /><span className="min-w-0"><b>{currentTitle}</b><span className="block text-xs text-muted-foreground">Current career rank</span></span></li><li className="flex items-start gap-2 text-sm"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0"><b>{titleChanges ? nextTitle : `Level ${level + 1}`}</b><span className="block text-xs text-muted-foreground">{(XP_PER_LEVEL - levelXp).toLocaleString()} XP to reach it</span></span></li></ol></div>
    <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground"><Check className="h-4 w-4 shrink-0 text-success" /><span>Your pace. Your path. Progress over comparison.</span></p>
    <Button asChild variant="outline" className="mt-4 w-full justify-between"><Link to="/settings">Set career direction<ArrowRight className="h-4 w-4 shrink-0" /></Link></Button>
  </Card>;
}