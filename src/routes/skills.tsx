import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Network } from "lucide-react";
import { PageHeader, Mascot } from "@/components/AppShell";
import { useGame } from "@/lib/game";

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

function Page() {
  const { details } = useGame(); const skills = details.skills ?? [];
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Grow your strengths" title="Skill Tree" sub="Unlock skills as you complete quests, interviews and resume fixes." />
      <div className="panel flex flex-col items-center px-6 py-20 text-center">
        <Network className="h-12 w-12 text-primary" />
        <h2 className="mt-6 text-3xl font-bold md:text-4xl">Unlock skills as you complete quests, interviews and resume fixes.</h2>
        <p className="mt-4 max-w-lg text-muted-foreground">Your skill tree grows from the skills on your profile.</p>
        <Link to="/quests" className="mt-8 inline-flex items-center gap-3 rounded-xl bg-primary px-7 py-4 font-semibold text-primary-foreground hover:opacity-90">Explore quests <ArrowRight className="h-5 w-5" /></Link>
        <Mascot className="mt-10 h-24 w-24" />
      </div>
      {skills.length > 0 && (
        <div className="panel mt-6 flex flex-wrap gap-2 p-6">
          {skills.map((s) => <span key={s} className="rounded-full border border-primary/20 bg-sidebar-accent px-3 py-1 text-sm text-primary">{s}</span>)}
        </div>
      )}
    </div>
  );
}
