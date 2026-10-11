// Career stats block for /progress: streak badge, Elo progression lines, goals,
// ATS tracker with skill gaps, and the P2P interview hub.
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Briefcase, Flame, Snowflake, Target, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getCareerDashboard, saveCareerGoal, GOAL_LEVELS,
  type CareerDashboard, type GoalLevel,
} from "@/lib/career.functions";
import { cn } from "@/lib/utils";

export function useCareerDashboard() {
  const [data, setData] = useState<CareerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = () => {
    getCareerDashboard().then(setData).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(reload, []);
  return { data, loading, reload };
}

const PALETTE = ["var(--primary)", "var(--accent)", "var(--success)"];

function dayRows(series: CareerDashboard["elo"], days: number) {
  const cutoff = Date.now() - days * 86_400_000;
  const keys: string[] = [];
  const rows = new Map<string, Record<string, number>>();
  for (const s of series) {
    let pts = s.points.filter((p) => new Date(p.t).getTime() >= cutoff);
    if (!pts.length) continue;
    const only = pts[0]!;
    if (pts.length === 1) pts = [{ t: new Date(new Date(only.t).getTime() - 86_400_000).toISOString(), rating: only.rating }, ...pts];
    for (const p of pts) {
      const key = p.t.slice(0, 10);
      if (!rows.has(key)) { rows.set(key, {}); keys.push(key); }
      rows.get(key)![s.skill] = p.rating;
    }
  }
  keys.sort();
  return keys.map((k) => rows.get(k)!);
}

function EloProgressCard({ series }: { series: CareerDashboard["elo"] }) {
  const [days, setDays] = useState(30);
  const rows = useMemo(() => dayRows(series, days), [series, days]);
  const shown = series.slice(0, 6);
  return (
    <div className="panel p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Elo progress</div>
        <div className="flex items-center gap-1 text-xs">
          {[7, 30, 90].map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)}
              className={cn("rounded-full px-3 py-1 transition-colors", days === d ? "bg-primary/15 font-semibold text-primary" : "text-muted-foreground hover:text-foreground")}>
              {d}d
            </button>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Every graded interview moves your skill ratings. Finish one and your Elo lines start climbing here.
        </p>
      ) : (
        <div className="mt-2 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 12, right: 12, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="__t" tickFormatter={(v: string) => v.slice(5)} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis domain={[800, 1600]} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                labelFormatter={(v) => String(v)}
              />
              {shown.map((s, i) => (
                <Line key={s.skill} type="monotone" dataKey={s.skill} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2}
                  dot={false} activeDot={{ r: 3 }} connectNulls isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {rows.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {shown.map((s, i) => (
            <span key={s.skill} className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
              {s.skill} <b className="text-foreground">{s.points[s.points.length - 1]?.rating}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const LEVEL_LABEL: Record<GoalLevel, string> = { internship: "Internship", new_grad: "New grad", experienced: "Experienced" };

function GoalsCard({ goal, onSaved }: { goal: CareerDashboard["goal"]; onSaved: () => void }) {
  const [role, setRole] = useState(goal?.targetRole ?? "");
  const [level, setLevel] = useState<GoalLevel>(goal?.targetLevel ?? "new_grad");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setRole(goal?.targetRole ?? ""); setLevel(goal?.targetLevel ?? "new_grad"); }, [goal?.targetRole, goal?.targetLevel]);
  const save = async () => {
    setSaving(true);
    try { await saveCareerGoal({ data: { targetRole: role, targetLevel: level } }); onSaved(); } catch {} finally { setSaving(false); }
  };
  return (
    <div className="panel p-6">
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground"><Target className="h-4 w-4" />Goals & target roles</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Target role</span>
          <Input className="mt-1" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Software Engineer" list="career-roles" maxLength={100} />
          <datalist id="career-roles">
            <option value="Software Engineer" /><option value="Data Scientist" /><option value="Product Manager" />
            <option value="Data Analyst" /><option value="Product Designer" /><option value="Machine Learning Engineer" />
          </datalist>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Career level</span>
          <select className="mt-1 h-9 w-full rounded-md border bg-card px-3 text-sm" value={level} onChange={(e) => setLevel(e.target.value as GoalLevel)} aria-label="Career level">
            {GOAL_LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
          </select>
        </label>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Your practice target rating: <b className="text-foreground">{goal?.targetElo ?? 1000 + ({ internship: 50, new_grad: 125, experienced: 150 } as Record<GoalLevel, number>)[level]}</b> —
        interviews nudge you toward it, and skill-gap badges below show how far each skill has to climb.
      </p>
      <div className="mt-4 flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save goal"}</Button>
        {goal && <span className="text-xs text-muted-foreground">Saved · {LEVEL_LABEL[goal.targetLevel]}</span>}
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = { saved: "Saved", applied: "Applied", interviewing: "Interviewing" };

function AtsTracker({ rows }: { rows: CareerDashboard["radar"] }) {
  return (
    <div className="panel p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground"><Briefcase className="h-4 w-4" />Application tracker</div>
        <Button asChild size="sm" variant="ghost" className="text-muted-foreground hover:text-primary"><Link to="/market">Open Job Radar</Link></Button>
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Save roles from Job Radar and they show up here with a match score and the exact skills to close.
        </p>
      ) : (
        <ul className="mt-3 divide-y">
          {rows.map((r) => (
            <li key={r.jobId} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="min-w-0 font-medium"><span className="text-muted-foreground">{r.company || "—"}</span> · {r.title}</span>
                <span className="flex items-center gap-2 text-xs">
                  <b className="text-primary">{r.match}% match</b>
                  <span className={cn("rounded-full px-2 py-0.5",
                    r.status === "interviewing" ? "bg-accent/20 text-accent-foreground" : r.status === "applied" ? "bg-success/10 text-success" : "bg-primary/10 text-primary")}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </span>
              </div>
              {(r.missing.length > 0 || r.gaps.length > 0) && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {r.gaps.map((g) => <span key={g} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{g}</span>)}
                  {r.missing.map((m) => <span key={m} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Missing: {m}</span>)}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PeerHub({ active, recent }: { active: CareerDashboard["peerActive"]; recent: CareerDashboard["peerRecent"] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="panel p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground"><Users className="h-4 w-4" />Peer interview hub</div>
        <Button asChild size="sm"><Link to="/peers">Find an interview partner</Link></Button>
      </div>
      {active.length > 0 && (
        <ul className="mt-3 space-y-2">
          {active.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-primary/5 px-4 py-3 text-sm">
              <span>{s.job ? <b>{s.job}</b> : "Practice session"} · <span className="font-mono tracking-widest text-primary">{s.code}</span></span>
              <span className="text-xs text-muted-foreground">{s.status === "live" ? "Live now" : "Waiting for partner"} · <Link to="/peers" className="underline">Open</Link></span>
            </li>
          ))}
        </ul>
      )}
      {recent.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Run a peer interview with a friend — both sides get graded, and your sessions log here.</p>
      ) : (
        <ul className="mt-3 divide-y">
          {recent.map((s) => (
            <li key={s.id} className="py-3">
              <button type="button" className="flex w-full flex-wrap items-baseline justify-between gap-2 text-left" onClick={() => setOpen(open === s.id ? null : s.id)}>
                <span className="min-w-0 font-medium">
                  {s.role === "interviewer" ? "You interviewed" : "You interviewed for"} {s.job ? <b>{s.job}</b> : "a role"}
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {s.overall != null && <b className="text-success">{s.overall}%</b>}
                  {s.at && <span>{new Date(s.at).toLocaleDateString()}</span>}
                  <span className="underline">{open === s.id ? "Hide" : "Summary"}</span>
                </span>
              </button>
              {open === s.id && (
                <div className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                  {s.strengths.map((x, i) => <p key={`s${i}`}>+ {x}</p>)}
                  {s.improvements.map((x, i) => <p key={`i${i}`}>→ {x}</p>)}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SavedInterviews({ items }: { items: CareerDashboard["solo"] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [full, setFull] = useState<string | null>(null);
  return (
    <div className="panel p-6 lg:col-span-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Saved interviews</div>
        <Button asChild size="sm" variant="outline"><Link to="/interview" search={{} as never}>New interview</Link></Button>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Finish a solo interview and its score, feedback and transcript are saved here.</p>
      ) : (
        <ul className="mt-3 divide-y">
          {items.map((s) => (
            <li key={s.id} className="py-3">
              <button type="button" className="flex w-full flex-wrap items-baseline justify-between gap-2 text-left" onClick={() => setOpen(open === s.id ? null : s.id)}>
                <span className="min-w-0 font-medium">{s.job ? <b>{s.job}</b> : "Practice interview"}{s.type && <span className="ml-2 text-xs capitalize text-muted-foreground">{s.type}</span>}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {s.overall != null && <b className="text-success">{s.overall}%</b>}
                  {s.at && <span>{new Date(s.at).toLocaleDateString()}</span>}
                  <span className="underline">{open === s.id ? "Hide" : "Details"}</span>
                </span>
              </button>
              {open === s.id && (
                <div className="mt-2 space-y-1.5 text-sm text-muted-foreground">
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
    </div>
  );
}

export function StreakBadge({ streak }: { streak: CareerDashboard["streak"] }) {
  if (!streak) return null;
  return (
    <div className="panel flex items-center gap-3 px-5 py-3 text-sm transition-shadow hover:shadow-md">
      <Flame className="animate-flame h-5 w-5 text-primary" />
      <b>{streak.current} day{streak.current === 1 ? "" : "s"} streak</b>
      {streak.freezes > 0 && (
        <span className="flex items-center gap-1 border-l pl-3 text-muted-foreground" title="Streak freezes keep your streak alive through one missed day">
          <Snowflake className="h-4 w-4" />{streak.freezes}
        </span>
      )}
      <span className="border-l pl-3 text-muted-foreground">Best: {streak.longest}</span>
    </div>
  );
}

export function CareerStats({ data, onGoalSaved }: { data: CareerDashboard; onGoalSaved: () => void }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <EloProgressCard series={data.elo} />
      <GoalsCard goal={data.goal} onSaved={onGoalSaved} />
      <AtsTracker rows={data.radar} />
      <SavedInterviews items={data.solo ?? []} />
      <PeerHub active={data.peerActive} recent={data.peerRecent} />
    </div>
  );
}
