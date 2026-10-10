import { createFileRoute } from "@tanstack/react-router";
import { Network, ShieldCheck } from "lucide-react";
import { PageHeader, PanelHead } from "@/components/AppShell";
import { useGame } from "@/lib/game";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/skills")({
  head: () => ({
    meta: [
      { title: "Skill Tree — DevUp" },
      { name: "description", content: "Unlock skills as you complete quests, interviews and resume fixes." },
      { property: "og:title", content: "Skill Tree — DevUp" },
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
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Build your next chapter" title="Skill Tree" sub="Turn your potential into progress, one step at a time." />
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
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t px-8 py-6 md:px-12">
            {skills.map((s) => <span key={s} className="rounded-full border border-primary/20 bg-sidebar-accent px-3 py-1 text-sm text-primary">{s}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}
