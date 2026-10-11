import { useEffect, useState } from "react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { Check, Pencil, Plus, RefreshCw } from "lucide-react";
import { checkCustomSkill, getSkillChanges, getSkillRatings, getTrackedSkills, refreshSkillRatings, saveTrackedSkills } from "@/lib/interview.functions";
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
export function SkillRadar({ onPractice }: { onPractice?: (skill: string) => void }) {
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [tracked, setTracked] = useState<string[]>([]);
  const [draft, setDraft] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [changes, setChanges] = useState<Change[]>([]);
  const [custom, setCustom] = useState<string[]>([]);
  const [phrase, setPhrase] = useState("");
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<string | null>(null);

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
  const addCustom = () => {
    const p = phrase.trim();
    if (!p || checking) return;
    setChecking(true);
    setNote(null);
    checkCustomSkill({ data: { phrase: p } })
      .then((r) => {
        if (!r.ok) return setNote(r.reason);
        setCustom((c) => (c.some((x) => x.toLowerCase() === r.skill.toLowerCase()) ? c : [...c, r.skill]));
        setDraft((d) => {
          const cur = d ?? [];
          if (cur.some((x) => x.toLowerCase() === r.skill.toLowerCase())) return cur;
          return cur.length >= MAX_TRACKED ? cur : [...cur, r.skill];
        });
        setNote(`Added "${r.skill}".`);
        setPhrase("");
      })
      .catch(() => setNote("Couldn't check that skill — try again."))
      .finally(() => setChecking(false));
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
          {[...SKILL_CATALOG, ...[...tracked, ...custom].filter((t, i, a) =>
            !(SKILL_CATALOG as readonly string[]).some((c) => c.toLowerCase() === t.toLowerCase()) && a.findIndex((x) => x.toLowerCase() === t.toLowerCase()) === i)].map((s) => {
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
        <form className="mt-4 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); addCustom(); }}>
          <input
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            maxLength={40}
            placeholder="Add a custom skill, e.g. Rust or Figma"
            aria-label="Custom skill"
            className="h-9 min-w-0 flex-1 rounded-md border bg-card px-3 text-sm"
          />
          <Button type="submit" size="sm" variant="outline" disabled={checking || !phrase.trim()}>
            {checking ? "Checking…" : <><Plus /> Add skill</>}
          </Button>
          {note && <p className="w-full text-xs text-muted-foreground" role="status">{note}</p>}
        </form>
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
        <div className="mt-2 flex flex-col gap-4 lg:flex-row">
          <div className="h-80 min-w-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={rows} outerRadius="72%">
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="skill" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                <PolarRadiusAxis domain={[RATING_MIN, RATING_MAX]} tick={false} axisLine={false} />
                <Radar dataKey="rating" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.25} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
            {rows.map((r) => (
              <div key={r.skill}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate font-medium">{r.skill}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{"unrated" in r && r.unrated ? "not rated yet" : r.rating}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, ((r.rating - RATING_MIN) / (RATING_MAX - RATING_MIN)) * 100)}%` }} />
                </div>
              </div>
            ))}
            {onPractice && (() => {
              const rated = rows.filter((r) => !("unrated" in r && r.unrated));
              if (!rated.length) return null;
              const lowest = rated.reduce((a, b) => (a.rating <= b.rating ? a : b));
              return (
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-sm">
                  <span className="text-muted-foreground">Your lowest-rated skill is <b className="text-foreground">{lowest.skill}</b>. Practice it next.</span>
                  <Button size="sm" variant="outline" onClick={() => onPractice(lowest.skill)}>Practice</Button>
                </div>
              );
            })()}
          </div>
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
