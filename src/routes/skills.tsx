import { createFileRoute } from "@tanstack/react-router";
import { Network, ShieldCheck } from "lucide-react";
import { PageHeader, PanelHead } from "@/components/AppShell";
import { useGame } from "@/lib/game";
import { useEffect, useState } from "react";
import { getSkillRatings } from "@/lib/interview.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/skills")({
  head: () => ({
    meta: [
      { title: "Skill Tree — JobMaxxing" },
      { name: "description", content: "Unlock skills as you complete quests, interviews and resume fixes." },
      { property: "og:title", content: "Skill Tree — JobMaxxing" },
      { property: "og:description", content: "Unlock skills as you complete quests, interviews and resume fixes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

const TREE = [
  { name: "Your career foundation", status: "Mastered", open: true },
  { name: "Resume storytelling", status: "In progress", open: true },
  { name: "Behavioral interviews", status: "In progress", open: true },
  { name: "Technical fluency", status: "Unlocks at level 8", open: false },
  { name: "Leadership", status: "Unlocks at level 8", open: false },
  { name: "Career mastery", status: "Unlocks at level 8", open: false },
];

function Page() {
  const { details, level } = useGame();
  const skills = (details.skills ?? []).filter(Boolean);
  const [ratings, setRatings] = useState<{ skill: string; rating: number; answered: number }[]>([]);
  useEffect(() => { getSkillRatings().then(setRatings).catch(() => {}); }, []);
  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader eyebrow="Build your next chapter" title="Skill Tree" sub="Turn your potential into progress, one step at a time." pose="skills" />
      <div className="panel">
        <PanelHead title="Grow in your own direction" level={level} />
        <p className="px-8 pt-3 text-muted-foreground md:px-12">Unlock new skills by completing quests and interview practice.</p>
        <div className="grid gap-5 px-8 py-8 md:grid-cols-3 md:px-12">
          {TREE.map((t) => (
            <div key={t.name} className={cn("hover-lift flex flex-col items-center rounded-2xl px-6 py-12 text-center", t.open ? "bg-success/10" : "bg-muted/60")}>
              {t.open
                ? <Network className="h-8 w-8 text-success" strokeWidth={1.5} />
                : <ShieldCheck className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />}
              <div className={cn("mt-4 font-semibold", t.open ? "text-success" : "text-muted-foreground")}>{t.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">{t.status}</div>
            </div>
          ))}
        </div>
        <div className="border-t px-8 py-6 md:px-12">
          <h3 className="font-semibold">Skill ratings</h3>
          <p className="text-sm text-muted-foreground">Ratings run 800–1600 and adjust after every graded interview answer.</p>
          {ratings.length === 0
            ? <p className="mt-3 text-sm text-muted-foreground">Finish a mock or peer interview to get your first ratings.</p>
            : <div className="mt-4 grid gap-3 md:grid-cols-2">
                {ratings.map((r) => (
                  <div key={r.skill} className="rounded-xl bg-muted p-4">
                    <div className="flex justify-between text-sm"><span className="font-medium">{r.skill}</span><span className="font-mono">{r.rating}</span></div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-primary" style={{ width: `${((r.rating - 800) / 800) * 100}%` }} /></div>
                    <div className="mt-1 text-xs text-muted-foreground">{r.answered} answered{r.answered < 10 ? " · placement" : ""}</div>
                  </div>
                ))}
              </div>}
        </div>
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t px-8 py-6 md:px-12">
            {skills.map((s) => <span key={s} className="rounded-full border border-primary/20 bg-sidebar-accent px-3 py-1 text-sm text-primary">{s}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}
