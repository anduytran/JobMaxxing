import { createFileRoute } from "@tanstack/react-router";
import { Check, LineChart } from "lucide-react";
import { PageHeader, PanelHead } from "@/components/AppShell";
import { useGame } from "@/lib/game";

export const Route = createFileRoute("/progress")({
  head: () => ({
    meta: [
      { title: "Career Progress — DevUp" },
      { name: "description", content: "Track your level, XP and milestones over time." },
      { property: "og:title", content: "Career Progress — DevUp" },
      { property: "og:description", content: "Track your level, XP and milestones over time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { xp, level, quests } = useGame();
  const done = quests.filter((q) => q.done);
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Build your next chapter" title="Career Progress" sub="Turn your potential into progress, one step at a time." />
      <div className="panel">
        <PanelHead title="Look how far you've come" level={level} />
        <div className="px-8 pb-10 pt-6 md:px-12">
          <div className="hover-lift rounded-2xl bg-success/10 px-8 py-12 text-center">
            <LineChart className="animate-bob h-8 w-8 text-success" strokeWidth={1.5} />
            <div className="mt-4 text-3xl font-bold text-success md:text-4xl">{xp.toLocaleString()} XP earned</div>
            <div className="mt-2 text-success/80">Level {level} · {done.length} quest{done.length === 1 ? "" : "s"} completed</div>
          </div>
          <div>
            {done.length === 0 && (
              <p className="border-t py-6 text-sm text-muted-foreground">Complete quests and interviews to fill in your milestones.</p>
            )}
            {done.map((q) => (
              <div key={q.id} className="flex items-center gap-4 border-t py-6">
                <Check className="h-5 w-5" />
                <span className="text-muted-foreground">{q.title} · +{q.xp} XP</span>
              </div>
            ))}
            <div className="flex items-center gap-4 border-t py-6">
              <Check className="h-5 w-5" />
              <span className="text-muted-foreground">Started your career journey · Level 1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
