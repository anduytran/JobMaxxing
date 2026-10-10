import { createFileRoute } from "@tanstack/react-router";
import { QuestList } from "@/components/QuestList";
import { useGame } from "@/lib/game";

export const Route = createFileRoute("/quests")({
  head: () => ({
    meta: [
      { title: "Quests — DevUp" },
      { name: "description", content: "Complete career quests to earn XP and level up." },
      { property: "og:title", content: "Quests — DevUp" },
      { property: "og:description", content: "Complete career quests to earn XP and level up." },
    ],
  }),
  component: Quests,
});

function Quests() {
  const { quests } = useGame();
  const done = quests.filter((q) => q.done).length;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-4xl font-bold md:text-5xl">Quest Log</h1>
        <p className="text-muted-foreground">{done} of {quests.length} completed. Tick a quest to claim its XP.</p>
      </div>
      <div className="panel p-6"><QuestList /></div>
    </div>
  );
}
