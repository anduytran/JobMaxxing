import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Award, Flame, Trophy, Users } from "lucide-react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { ACHIEVEMENTS, levelTitle, useGame, XP_PER_LEVEL } from "@/lib/game";
import { QuestList } from "@/components/QuestList";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — DevUp" },
      { name: "description", content: "Your RPG-style career hub: level, XP, stats and active quests." },
      { property: "og:title", content: "DevUp — Gamified Career Progression" },
      { property: "og:description", content: "Level up your job hunt with quests, XP and AI mock interviews." },
    ],
  }),
  component: Dashboard,
});

const STATS = [
  { stat: "Frontend", v: 78 }, { stat: "Backend", v: 62 }, { stat: "System Design", v: 41 },
  { stat: "Communication", v: 70 }, { stat: "Confidence", v: 55 }, { stat: "Algorithms", v: 64 },
];
const ICONS = [Trophy, Flame, Award, Users];

function Dashboard() {
  const { name, title, level, levelXp, xp } = useGame();
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="panel relative overflow-hidden p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <motion.div initial={{ scale: 0.6, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring" }}
            className="grid h-28 w-28 shrink-0 place-items-center bg-primary text-primary-foreground glow clip-corner">
            <div className="text-center">
              <div className="font-mono text-xs">LEVEL</div>
              <div className="font-display text-5xl font-bold">{level}</div>
            </div>
          </motion.div>
          <div className="flex-1">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{title}</p>
            <h1 className="text-3xl font-bold md:text-4xl">{name}</h1>
            <p className="mt-1 font-display text-xl text-primary text-glow">Level {level}: {levelTitle(level)}</p>
            <div className="mt-4">
              <div className="mb-1 flex justify-between font-mono text-xs text-muted-foreground">
                <span>{levelXp} / {XP_PER_LEVEL} XP</span><span>Total {xp} XP</span>
              </div>
              <div className="h-4 overflow-hidden rounded-full bg-muted">
                <motion.div className="h-full xp-fill" initial={{ width: 0 }} animate={{ width: `${(levelXp / XP_PER_LEVEL) * 100}%` }} transition={{ type: "spring", stiffness: 50 }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="panel p-6 lg:col-span-3">
          <h2 className="mb-2 text-lg font-semibold">Career Stats</h2>
          <div className="h-80">
            <ResponsiveContainer>
              <RadarChart data={STATS} outerRadius="75%">
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="stat" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                <Radar dataKey="v" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.3} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel p-6 lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold">Active Quest Log</h2>
          <QuestList limit={3} showDone={false} />
        </section>
      </div>

      <section className="panel p-6">
        <h2 className="mb-4 text-lg font-semibold">Recent Achievements</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {ACHIEVEMENTS.map((a, i) => {
            const Icon = ICONS[i];
            return (
              <motion.div key={a.id} whileHover={{ y: -4 }} className="flex items-center gap-3 rounded-lg border bg-secondary/40 p-3">
                <div className="grid h-10 w-10 place-items-center rounded-full border border-accent/60 bg-accent/15 text-accent"><Icon className="h-5 w-5" /></div>
                <div><div className="text-sm font-semibold">{a.name}</div><div className="text-xs text-muted-foreground">{a.desc}</div></div>
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
