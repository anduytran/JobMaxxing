import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useGame } from "@/lib/game";
import { cn } from "@/lib/utils";

export function QuestList({ limit, showDone = true }: { limit?: number; showDone?: boolean }) {
  const { quests, completeQuest } = useGame();
  const list = quests.filter((q) => showDone || !q.done).slice(0, limit);
  return (
    <ul className="space-y-2">
      {list.map((q) => (
        <motion.li layout key={q.id} className={cn("flex items-center gap-3 rounded-lg border p-3", q.done ? "bg-success/5 opacity-60" : "bg-secondary/40")}>
          <button onClick={() => completeQuest(q.id)} disabled={q.done} aria-label={`Complete ${q.title}`}
            className={cn("grid h-6 w-6 shrink-0 place-items-center rounded border-2 transition", q.done ? "border-success bg-success text-background" : "border-primary hover:bg-primary/20")}>
            {q.done && <Check className="h-4 w-4" />}
          </button>
          <div className="min-w-0 flex-1">
            <div className={cn("truncate text-sm", q.done && "line-through")}>{q.title}</div>
            <div className="font-mono text-[10px] uppercase text-muted-foreground">
              {q.category}{q.period !== "once" && <span className="ml-1 text-primary/80">· resets {q.period}</span>}
            </div>
          </div>
          {(q.id.startsWith("resume-ai-") || q.category === "resume") ? null : <span className="font-mono text-xs font-bold text-success">+{q.xp} XP</span>}
        </motion.li>
      ))}
      {list.length === 0 && <li className="text-sm text-muted-foreground">All quests cleared. Legendary.</li>}
    </ul>
  );
}
