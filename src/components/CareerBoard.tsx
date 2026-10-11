// Career board cards for /progress: career progress with level ladder, streak
// week view, recent XP feed, application tracker by status, saved interviews
// with per-metric bars.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { Briefcase, Calendar, Flame, Mic, Snowflake, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { levelTitle, XP_PER_LEVEL } from "@/lib/game";
import { STREAK_BONUS_XP, nextStreakBonus } from "@/lib/streak.shared";
import { trashInterview, type CareerDashboard, type SoloInterview } from "@/lib/career.functions";
import { cn } from "@/lib/utils";

function Meter({ value, fill = "bg-primary" }: { value: number; fill?: string }) {
  const reduced = useReducedMotion();
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <motion.div className={cn("h-full rounded-full", fill)} initial={reduced ? false : { width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: reduced ? 0 : 0.5 }} />
    </div>
  );
}

/** Ring + XP + stat tiles + rank ladder + actions. */
export function CareerProgressCard({
  xp, level, levelXp, activeTitle, questsDone, interviews, rolesSaved,
}: {
  xp: number; level: number; levelXp: number; activeTitle: string | null;
  questsDone: number; interviews: number; rolesSaved: number;
}) {
  const reduced = useReducedMotion();
  const toNext = XP_PER_LEVEL - levelXp;
  const dailyQuests = Math.max(1, Math.ceil(toNext / 25));
  // Ladder: a few earned ranks, the current one, and the next milestones.
  const ladder = [...new Set([1, 2, level, level + 1, level + 5, level + 10])].sort((a, b) => a - b);
  return (
    <section aria-label="Career progress" className="panel hover-lift flex min-w-0 flex-col p-6">
      <div className="mb-5 flex min-w-0 items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-normal text-muted-foreground"><Briefcase className="h-5 w-5 shrink-0" />Career progress</h2>
        {activeTitle && <span className="text-xs text-muted-foreground">Equipped title: <b className="text-foreground">{activeTitle}</b></span>}
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <div className="relative h-32 w-32 shrink-0">
          <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r="44" fill="none" stroke="var(--muted)" strokeWidth="5" />
            <motion.circle cx="50" cy="50" r="44" fill="none" stroke="var(--success)" strokeWidth="5" strokeLinecap="round" strokeDasharray={276.5}
              initial={reduced ? false : { strokeDashoffset: 276.5 }} animate={{ strokeDashoffset: 276.5 * (1 - levelXp / XP_PER_LEVEL) }} transition={{ duration: reduced ? 0 : 0.7 }} />
          </svg>
          <div className="absolute inset-0 grid place-content-center text-center">
            <span className="text-xs text-muted-foreground">Level</span>
            <span className="text-4xl font-bold tabular-nums">{level}</span>
            <span className="max-w-[7rem] truncate text-xs font-semibold">{levelTitle(level)}</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="break-words text-4xl font-bold tabular-nums">{xp.toLocaleString()}<span className="ml-2 text-sm font-medium text-muted-foreground">XP earned</span></p>
          <p className="mt-1 text-sm text-muted-foreground">{toNext.toLocaleString()} XP to level {level + 1}. That's about {dailyQuests} daily quest{dailyQuests === 1 ? "" : "s"}.</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { n: questsDone, label: "quests done" },
              { n: interviews, label: "mock interviews" },
              { n: rolesSaved, label: "roles saved" },
            ].map((t) => (
              <div key={t.label} className="rounded-xl bg-muted/60 px-3 py-2 text-center">
                <div className="text-xl font-bold tabular-nums">{t.n}</div>
                <div className="text-xs text-muted-foreground">{t.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6 border-t pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider">Your progression</h3>
          <span className="text-xs text-muted-foreground">Each level unlocks a title you can equip</span>
        </div>
        <ol className="mt-3 flex flex-wrap items-start gap-x-6 gap-y-3">
          {ladder.map((l) => {
            const state = l < level ? "earned" : l === level ? "current" : "next";
            return (
              <li key={l} className="flex flex-col items-center gap-1 text-center">
                <span className={cn(
                  "grid h-9 w-9 place-items-center rounded-lg border text-sm font-bold tabular-nums",
                  state === "current" ? "border-primary bg-primary text-primary-foreground" : state === "earned" ? "border-accent bg-accent/20 text-accent-foreground" : "bg-muted/60 text-muted-foreground",
                )}>{l}</span>
                <span className="max-w-[5.5rem] truncate text-xs font-medium">{levelTitle(l)}</span>
                <span className="text-[11px] text-muted-foreground">
                  {state === "earned" ? "Earned" : state === "current" ? "Current" : l === level + 1 ? `${toNext.toLocaleString()} XP away` : `Level ${l}`}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button asChild className="min-w-0 flex-1"><Link to="/quests/add">Find your next win</Link></Button>
        <Button asChild variant="outline" className="min-w-0 flex-1"><Link to="/store">Spend XP</Link></Button>
        <Button asChild variant="outline" className="min-w-0 flex-1"><Link to="/settings">Set career direction</Link></Button>
      </div>
    </section>
  );
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** Streak card with a Mon–Sun dot row. The dots are an approximation: we know
 *  the streak length and last active day, not the full daily history. */
export function StreakCard({ streak }: { streak: CareerDashboard["streak"] }) {
  const last = streak.lastActivity ? new Date(streak.lastActivity + "T00:00:00Z") : null;
  // Monday = 0 … Sunday = 6
  const lastIdx = last ? (last.getUTCDay() + 6) % 7 : 6;
  const filled = new Set<number>();
  for (let i = 0; i < Math.min(streak.current, 7); i++) filled.add(((lastIdx - i) % 7 + 7) % 7);
  return (
    <section aria-label="Streak" className="panel hover-lift p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-normal text-muted-foreground"><Flame className="animate-flame h-5 w-5 shrink-0 text-primary" />{streak.current}-day streak</h2>
        {streak.freezes > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground" title="Streak freezes keep your streak alive through one missed day">
            <Snowflake className="h-3.5 w-3.5" />{streak.freezes} freeze{streak.freezes === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <div className="mt-4 flex justify-between">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className={cn("h-7 w-7 rounded-full", filled.has(i) ? "bg-primary" : "bg-muted")} aria-label={filled.has(i) ? `${d} active` : `${d} not yet`} />
            <span className="text-[11px] text-muted-foreground">{d}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        {streak.current > 0 ? "Clear one quest each day to keep it going." : "Clear one quest today to start a streak."} Best: <b className="text-foreground">{streak.longest} day{streak.longest === 1 ? "" : "s"}</b>.
      </p>
      {(() => {
        const next = nextStreakBonus(streak.current);
        const left = next - streak.current;
        return (
          <p className="mt-2 text-xs text-muted-foreground">
            {streak.bonusPaid > 0 && <span>Day {streak.bonusPaid} bonus paid (+{STREAK_BONUS_XP} XP). </span>}
            {left} more day{left === 1 ? "" : "s"} to bank the next +{STREAK_BONUS_XP} XP.
          </p>
        );
      })()}
    </section>
  );
}

export function RecentXpCard({ events }: { events: CareerDashboard["xpEvents"] }) {
  return (
    <section aria-label="Recent XP" className="panel hover-lift p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-normal text-muted-foreground"><Zap className="h-5 w-5 shrink-0" />Recent XP</h2>
        <span className="text-xs text-muted-foreground">Latest</span>
      </div>
      {events.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Earn XP from quests, interviews and the Job Radar and it lands here.</p>
      ) : (
        <ul className="mt-3 divide-y">
          {events.map((e, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
              <span className="min-w-0 truncate">{e.label}</span>
              <span className="shrink-0 font-semibold text-success">+{e.amount}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const TRACKER_STATUSES = [
  { key: "saved", label: "Saved" },
  { key: "applied", label: "Applied" },
  { key: "interviewing", label: "Interviewing" },
  { key: "offer", label: "Offer" },
] as const;

export function ApplicationTracker({ rows }: { rows: CareerDashboard["radar"] }) {
  const byStatus = new Map<string, CareerDashboard["radar"]>();
  for (const r of rows) {
    const list = byStatus.get(r.status) ?? [];
    list.push(r);
    byStatus.set(r.status, list);
  }
  return (
    <section aria-label="Application tracker" className="panel hover-lift flex min-w-0 flex-col p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-normal text-muted-foreground"><Briefcase className="h-5 w-5 shrink-0" />Application tracker</h2>
        <Button asChild size="sm" variant="ghost" className="text-muted-foreground hover:text-primary"><Link to="/market">Open Job Radar</Link></Button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TRACKER_STATUSES.map((s) => {
          const list = byStatus.get(s.key) ?? [];
          return (
            <div key={s.key} className="min-w-0 rounded-xl bg-muted/40 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</span>
                <span className="text-xs font-bold tabular-nums">{list.length}</span>
              </div>
              <div className="mt-2 space-y-2">
                {list.slice(0, 3).map((r) => (
                  <div key={r.jobId} className="rounded-lg border bg-card p-2.5">
                    <div className="truncate text-sm font-medium" title={r.title}>{r.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{r.company || "—"}</div>
                    <div className="mt-1 text-xs font-semibold text-primary">{r.match}% match</div>
                  </div>
                ))}
                {list.length === 0 && (
                  <div className="grid min-h-20 place-items-center rounded-lg border border-dashed p-2.5 text-center text-xs text-muted-foreground">
                    {s.key === "offer" ? "Move a role here when you get an offer" : `No ${s.label.toLowerCase()} roles yet`}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Roles you save in Job Radar land in Saved with their match score. Move them along as you apply.</p>
    </section>
  );
}

function MetricBar({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-1 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{value ?? "—"}</span>
      </div>
      <div className="mt-1"><Meter value={value ?? 0} /></div>
    </div>
  );
}

export function SavedInterviewsCard({ items, onChanged }: { items: SoloInterview[]; onChanged: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [full, setFull] = useState<string | null>(null);
  const trash = (id: string) => { trashInterview({ data: { id } }).then(onChanged).catch(() => {}); };
  return (
    <section aria-label="Saved interviews" className="panel hover-lift flex min-w-0 flex-col p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-normal text-muted-foreground"><Mic className="h-5 w-5 shrink-0" />Saved interviews</h2>
        <Button asChild size="sm" variant="outline"><Link to="/interview" search={{ radar: undefined }}>New interview</Link></Button>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Finish a solo interview and its score, feedback and transcript are saved here.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((s) => (
            <li key={s.id} className="rounded-xl bg-muted/40 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="min-w-0 font-medium">{s.job ? <b>{s.job}</b> : "Practice interview"}</span>
                {s.overall != null && <b className="text-lg tabular-nums text-success">{s.overall}%</b>}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                {s.at && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(s.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
                {s.type && <span className="capitalize">· {s.type}</span>}
              </div>
              {(s.metrics.quality != null || s.metrics.conciseness != null || s.metrics.questions != null) && (
                <div className="mt-3 flex gap-3">
                  <MetricBar label="Quality" value={s.metrics.quality} />
                  <MetricBar label="Concise" value={s.metrics.conciseness} />
                  <MetricBar label="Questions" value={s.metrics.questions} />
                </div>
              )}
              <div className="mt-3 flex items-center gap-3 text-xs">
                <button type="button" className="font-medium text-primary underline" onClick={() => setOpen(open === s.id ? null : s.id)}>
                  {open === s.id ? "Hide score and feedback" : "Open score, feedback and transcript"}
                </button>
                <button type="button" aria-label="Trash this interview" title="Trash this interview"
                  className="ml-auto text-muted-foreground transition-colors hover:text-destructive"
                  onClick={() => trash(s.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {open === s.id && (
                <div className="mt-3 space-y-1.5 border-t pt-3 text-sm text-muted-foreground">
                  {s.strengths.map((x, i) => <p key={`s${i}`}>+ {x}</p>)}
                  {s.improvements.map((x, i) => <p key={`i${i}`}>→ {x}</p>)}
                  {s.transcript.length > 0 && (
                    <button type="button" className="text-xs underline" onClick={() => setFull(full === s.id ? null : s.id)}>{full === s.id ? "Hide transcript" : "Show transcript"}</button>
                  )}
                  {full === s.id && (
                    <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl bg-muted/50 p-3 text-xs">
                      {s.transcript.map((t, i) => <p key={i}><b className="capitalize text-foreground">{t.speaker === "candidate" ? "You" : "Interviewer"}:</b> {t.text}</p>)}
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
