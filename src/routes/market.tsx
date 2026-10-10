import { createFileRoute } from "@tanstack/react-router";
import { TrendingUp, Plus, Check } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { useGame } from "@/lib/game";

export const Route = createFileRoute("/market")({
  head: () => ({
    meta: [
      { title: "Market Insights — DevUp" },
      { name: "description", content: "Skill gap analysis comparing your skills to market demand." },
      { property: "og:title", content: "Market Insights — DevUp" },
      { property: "og:description", content: "Skill gap analysis comparing your skills to market demand." },
    ],
  }),
  component: Market,
});

const DATA = [
  { skill: "TypeScript", you: 75, market: 88 },
  { skill: "React", you: 80, market: 85 },
  { skill: "Docker", you: 20, market: 78 },
  { skill: "AWS", you: 35, market: 74 },
  { skill: "SQL", you: 60, market: 70 },
];

function Market() {
  const { quests, addQuest } = useGame();
  const added = quests.some((q) => q.id === "docker");
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-primary">Target role · Full-Stack Engineer</p>
        <h1 className="text-3xl font-bold">Skill Gap Analysis</h1>
        <p className="text-muted-foreground">Powered by simulated market data from 12,400 job postings.</p>
      </div>
      <div className="panel p-6">
        <div className="h-96">
          <ResponsiveContainer>
            <BarChart data={DATA}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="skill" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} cursor={{ fill: "var(--muted)" }} />
              <Legend />
              <Bar dataKey="you" name="Your level" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="market" name="Market demand" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="panel flex flex-col gap-4 border-success/40 p-6 md:flex-row md:items-center">
        <TrendingUp className="h-10 w-10 shrink-0 text-success" />
        <div className="flex-1">
          <h3 className="font-semibold">Market Data Suggests</h3>
          <p className="text-muted-foreground">Learning <span className="text-foreground">Docker</span> will increase your match rate by <span className="font-bold text-success">25%</span>.</p>
        </div>
        <Button disabled={added} onClick={() => addQuest({ id: "docker", title: "Containerize a project with Docker", xp: 600, category: "Skills" })}>
          {added ? <><Check /> Added to quest log</> : <><Plus /> Add Docker Quest</>}
        </Button>
      </div>
    </div>
  );
}
