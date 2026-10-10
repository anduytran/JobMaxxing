import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { levelTitle, useGame, XP_PER_LEVEL } from "@/lib/game";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — JobMaxxing" },
      { name: "description", content: "Your resume grade, open quests and level progress in one place." },
      { property: "og:title", content: "JobMaxxing — Practice interviews, fix your resume, track progress" },
      { property: "og:description", content: "Grade your resume, run a timed mock interview against a real job post, and earn XP for every fix." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { name, level, levelXp, xp, quests, completeQuest, details } = useGame();
  const first = name.split(" ")[0] || "there";
  const open = quests.filter((q) => !q.done);
  const done = quests.length - open.length;
  const pct = Math.round((levelXp / XP_PER_LEVEL) * 100);
  const resume = details.resume as { score?: number; grade?: string } | undefined;
  const hasResume = typeof resume?.score === "number";

  const steps = [
    {
      n: "01", to: "/setup" as const, title: "Grade your resume",
      status: hasResume ? `Graded ${resume?.grade ?? ""} · ${resume?.score}/100` : "Not uploaded",
      body: "Upload a PDF. The Resume Agent returns a letter grade and specific fixes, each worth XP.",
      done: hasResume,
    },
    {
      n: "02", to: "/interview" as const, title: "Run a mock interview",
      status: "About 3 min",
      body: "Paste a job post. You'll answer spoken questions based on it, then get a scored transcript.",
      done: false,
    },
    {
      n: "03", to: "/quests" as const, title: "Clear your quests",
      status: `${done} of ${quests.length} done`,
      body: "Small, checkable tasks pulled from your resume review and interview results.",
      done: quests.length > 0 && open.length === 0,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-12">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b pb-8">
        <div>
          <h1 className="text-4xl font-bold">Morning, {first}.</h1>
          <p className="mt-2 text-muted-foreground">
            {open.length > 0 ? `${open.length} quest${open.length === 1 ? "" : "s"} open. Start with the top one.` : "No open quests. Run an interview to get new ones."}
          </p>
        </div>
        <dl className="flex gap-10 text-sm">
          <div><dt className="text-muted-foreground">Level</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{level} <span className="text-sm font-normal text-muted-foreground">{levelTitle(level)}</span></dd></div>
          <div><dt className="text-muted-foreground">Total XP</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{xp.toLocaleString()}</dd></div>
          <div className="w-40">
            <dt className="text-muted-foreground">Next level</dt>
            <dd className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></dd>
            <dd className="mt-2 text-xs text-muted-foreground tabular-nums">{XP_PER_LEVEL - levelXp} XP to go</dd>
          </div>
        </dl>
      </header>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">How it works</h2>
        <ol className="grid border-y md:grid-cols-3 md:divide-x">
          {steps.map((s) => (
            <li key={s.n}>
              <Link to={s.to} className="group flex h-full flex-col gap-2 p-6 transition-colors hover:bg-muted/50">
                <div className="flex items-center justify-between text-xs tabular-nums text-muted-foreground">
                  <span>{s.n}</span>
                  <span className={s.done ? "font-medium text-success" : ""}>{s.status}</span>
                </div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.body}</p>
                <span className="mt-auto flex items-center gap-1 pt-2 text-sm font-medium text-primary">Open <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Open quests</h2>
          <Link to="/quests" className="text-sm text-muted-foreground hover:text-primary">All quests</Link>
        </div>
        <ul className="divide-y border-y">
          {open.slice(0, 5).map((q) => (
            <li key={q.id} className="flex items-center gap-4 py-4">
              <button onClick={() => completeQuest(q.id)} aria-label={`Mark "${q.title}" done`}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 text-transparent transition-colors hover:border-success hover:text-success">
                <Check className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{q.title}</div>
                <div className="text-xs capitalize text-muted-foreground">{q.category}</div>
              </div>
              <span className="text-sm font-medium tabular-nums text-muted-foreground">+{q.xp} XP</span>
            </li>
          ))}
          {open.length === 0 && <li className="py-6 text-sm text-muted-foreground">Nothing open. New quests appear after a resume review or interview.</li>}
        </ul>
      </section>
    </div>
  );
}
