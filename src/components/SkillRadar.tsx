import { useEffect, useState } from "react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { RefreshCw } from "lucide-react";
import { getSkillRatings, refreshSkillRatings } from "@/lib/interview.functions";
import { Button } from "@/components/ui/button";
import { RATING_MIN, RATING_MAX } from "@/lib/mmr.shared";

type Rating = { skill: string; rating: number; answered: number; evidence?: string | null };

/** Spider-web radar chart of the user's skill ratings (Career page). Ratings come from
 *  interview grading and the Skill Expert agent, and never go down. */
export function SkillRadar() {
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const update = () => {
    setUpdating(true);
    refreshSkillRatings()
      .then((r) => setRatings(r as Rating[]))
      .catch(() => {})
      .finally(() => setUpdating(false));
  };
  useEffect(() => {
    getSkillRatings()
      .then((r) => setRatings(r as Rating[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="panel p-6">
        <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Skill web</div>
        <div className="mt-4 grid h-64 animate-pulse place-items-center rounded-2xl bg-muted/40 text-sm text-muted-foreground">Loading your skills…</div>
      </div>
    );
  }
  if (ratings.length === 0) {
    return (
      <div className="panel p-6">
        <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Skill web</div>
        <p className="mt-4 text-sm text-muted-foreground">
          Finish an interview and your skill web starts growing here — each axis is a skill rated from {RATING_MIN} to {RATING_MAX}.
        </p>
      </div>
    );
  }

  const data = ratings.map((r) => ({ skill: r.skill, rating: r.rating, answered: r.answered }));
  const best = ratings[0]!;

  return (
    <div className="panel p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Skill web</div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>Strongest: <span className="font-semibold text-foreground">{best.skill}</span> · {best.rating}</span>
          <Button size="sm" variant="ghost" onClick={update} disabled={updating} title="Skills only ever go up">
            <RefreshCw className={updating ? "animate-spin" : ""} /> {updating ? "Rating…" : "Update"}
          </Button>
        </div>
      </div>
      <div className="mt-2 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="72%">
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis dataKey="skill" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
            <PolarRadiusAxis domain={[RATING_MIN, RATING_MAX]} tick={false} axisLine={false} />
            <Radar dataKey="rating" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.25} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-2">
        {ratings.map((r) => (
          <span key={r.skill} className="rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
            {r.skill} <b className="text-foreground">{r.rating}</b>
            {r.evidence ? <span className="ml-1 opacity-80">· {r.evidence}</span> : r.answered ? <> · {r.answered} answered</> : null}
          </span>
        ))}
      </div>
    </div>
  );
}
