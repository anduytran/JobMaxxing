import { useEffect, useState } from "react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { Check, Pencil, Plus, RefreshCw } from "lucide-react";
import { getSkillChanges, getSkillRatings, getTrackedSkills, refreshSkillRatings, saveTrackedSkills } from "@/lib/interview.functions";
import { Button } from "@/components/ui/button";
import { RATING_MIN, RATING_MAX, DEFAULT_RATING, SKILL_CATALOG, MAX_TRACKED } from "@/lib/mmr.shared";
import { cn } from "@/lib/utils";

type Rating = { skill: string; rating: number; answered: number; evidence?: string | null };
type Change = { skill: string; from: number; to: number; delta: number; at: string };

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

/** Spider-web chart of the skills the user chose to track (up to MAX_TRACKED).
 *  Tracked skills are what the Skill Expert grades; ratings never go down. */
export function SkillRadar() {
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [tracked, setTracked] = useState<string[]>([]);
  const [draft, setDraft] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [changes, setChanges] = useState<Change[]>([]);

  useEffect(() => {
    Promise.all([getSkillRatings(), getTrackedSkills(), getSkillChanges()])
      .then(([r, t, c]) => { setRatings(r as Rating[]); setTracked(t); setChanges(c as Change[]); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const update = () => {
    setBusy(true);
    Promise.all([refreshSkillRatings().then((r) => r as Rating[]), getSkillChanges().then((c) => c as Change[])])
      .then(([r, c]) => { setRatings(r); setChanges(c); })
      .catch(() => {})
      .finally(() => setBusy(false));
  };
  const save = () => {
    if (!draft) return;
    setBusy(true);
    Promise.all([saveTrackedSkills({ data: { skills: draft } }), getSkillChanges()])
      .then(([r, c]) => {
        setTracked(r.skills);
        setRatings(r.ratings as Rating[]);
        setChanges(c as Change[]);
        setDraft(null);
      })
      .catch(() => {})
      .finally(() => setBusy(false));
  };
  const toggle = (s: string) =>
    setDraft((d) => (d ?? []).includes(s) ? d!.filter((x) => x !== s) : (d ?? []).length >= MAX_TRACKED ? d : [...(d ?? []), s]);

  const header = (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Skill web</div>
      {!loading && !draft && (
        <div className="flex items-center gap-1 text-sm">
          <Button size="sm" variant="ghost" onClick={() => setDraft(tracked)}><Pencil /> Choose skills</Button>
          <Button size="sm" variant="ghost" onClick={update} disabled={busy || !tracked.length} title="Skills only ever go up">
            <RefreshCw className={busy ? "animate-spin" : ""} /> {busy ? "Rating…" : "Update"}
          </Button>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="panel p-6">
        {header}
        <div className="mt-4 grid h-64 animate-pulse place-items-center rounded-2xl bg-muted/40 text-sm text-muted-foreground">Loading your skills…</div>
      </div>
    );
  }

  if (draft) {
    return (
      <div className="panel p-6">
        {header}
        <p className="mt-3 text-sm text-muted-foreground">
          Pick up to {MAX_TRACKED} skills to track. These are the skills you'll be graded on. <b className="text-foreground">{draft.length}/{MAX_TRACKED}</b>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {SKILL_CATALOG.map((s) => {
            const on = draft.includes(s);
            const full = !on && draft.length >= MAX_TRACKED;
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggle(s)}
                disabled={full}
                aria-pressed={on}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-colors",
                  on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground hover:border-primary",
                  full && "cursor-not-allowed opacity-40 hover:border-border",
                )}
              >
                {on ? <Check className="size-3.5" /> : <Plus className="size-3.5" />} {s}
              </button>
            );
          })}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDraft(null)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy || draft.length === 0}>{busy ? "Saving & rating…" : "Save skills"}</Button>
        </div>
      </div>
    );
  }

  if (!tracked.length) {
    return (
      <div className="panel p-6">
        {header}
        <p className="mt-4 text-sm text-muted-foreground">Choose up to {MAX_TRACKED} skills to track and your skill web will appear here.</p>
      </div>
    );
  }

  const byKey = new Map(ratings.map((r) => [r.skill.toLowerCase(), r]));
  const rows = tracked.map((s) => byKey.get(s.toLowerCase()) ?? { skill: s, rating: DEFAULT_RATING, answered: 0, evidence: null, unrated: true });
  const best = [...rows].sort((a, b) => b.rating - a.rating)[0]!;

  return (
    <div className="panel p-6">
      {header}
      <div className="mt-1 text-sm text-muted-foreground">
        Strongest: <span className="font-semibold text-foreground">{best.skill}</span> · {best.rating}
      </div>
      {rows.length >= 3 ? (
        <div className="mt-2 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={rows} outerRadius="72%">
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="skill" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
              <PolarRadiusAxis domain={[RATING_MIN, RATING_MAX]} tick={false} axisLine={false} />
              <Radar dataKey="rating" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.25} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="my-6 text-sm text-muted-foreground">Track at least 3 skills to draw the web.</p>
      )}
      {changes.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent changes</div>
          <ul className="mt-2 space-y-1">
            {changes.map((c, i) => (
              <li key={`${c.skill}-${i}`} className="flex items-baseline gap-2 text-sm">
                <span className="font-medium text-foreground">{c.skill}</span>
                <span className="font-semibold text-primary">+{c.delta}</span>
                <span className="text-muted-foreground">→ {c.to}</span>
                <span className="ml-auto text-xs text-muted-foreground">{formatDate(c.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
