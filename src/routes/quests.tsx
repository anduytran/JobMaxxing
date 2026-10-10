import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuestList } from "@/components/QuestList";
import { useGame } from "@/lib/game";
import { ResetCountdown } from "@/components/ResetCountdown";

export const Route = createFileRoute("/quests")({
  head: () => ({
    meta: [
      { title: "Quests — JobMaxxing" },
      { name: "description", content: "Complete career quests to earn XP and level up." },
      { property: "og:title", content: "Quests — JobMaxxing" },
      { property: "og:description", content: "Complete career quests to earn XP and level up." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Quests,
});

function Quests() {
  const matchRoute = useMatchRoute();
  if (matchRoute({ to: "/quests/add" })) return <Outlet />;
  return <QuestLog />;
}

function QuestLog() {
  const { quests } = useGame();
  const done = quests.filter((q) => q.done).length;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
        <h1 className="text-4xl font-bold md:text-5xl">Quest Log</h1>
        <p className="text-muted-foreground">{done} of {quests.length} completed. Tick a quest to claim its XP.</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs font-medium">
          <ResetCountdown period="daily" label="Daily expiration in" className="text-primary/80" />
          <ResetCountdown period="weekly" label="Weekly expiration in" className="text-primary/80" />
        </div>
        </div>
        <Button asChild><Link to="/quests/add"><Plus className="h-4 w-4" /> Add quests</Link></Button>
      </div>
      <div className="panel p-6"><QuestList /></div>
    </div>
  );
}
